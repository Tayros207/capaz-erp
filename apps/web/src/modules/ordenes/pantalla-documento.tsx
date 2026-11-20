import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { PedidoCompletoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { BarraDeImpresion, BloqueDeDatos, HojaImprimible, LineaDeFirma, TablaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { normalizarEmpresa } from '../../shared/impresion/logica-impresion.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { verPedido } from './api.ts';
import { buscarDeudaDelPedido } from './flujo-adelanto.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { TITULO_DE_DOCUMENTO, correccionVigente, esTipoDeDocumento, filasDelDocumento, formatoDelDocumento, pedidoDeVersion, sePuedeImprimir, textoDeIgvIncluido, textoDeReemplazada, textoDeVersion, textoDeVigencia, totalesConAdelanto, totalesDelDocumento, type AdelantoDelPedido, type TipoDeDocumento } from './documentos.ts';
import { RecuadroQueCambio, SelloDeReemplazada } from './bloques-de-version.tsx';
import { ETIQUETA_DE_ESTADO, formatearDia } from './logica.ts';
import { Cargando } from './marco.tsx';

const AVISO_PROFORMA = 'Proforma, no válida como comprobante de pago';

const COLUMNAS_CON_PRECIO = [
  { clave: 'n', titulo: 'N.º', ancho: '10mm' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cantidad', alineacion: 'derecha' },
  { clave: 'precio', titulo: 'P. unitario', alineacion: 'derecha' },
  { clave: 'importe', titulo: 'Importe', alineacion: 'derecha' },
] as const;

const COLUMNAS_SIN_PRECIO = [
  { clave: 'n', titulo: 'N.º', ancho: '10mm' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cantidad', alineacion: 'derecha', ancho: '30mm' },
] as const;

/** Aviso solo en pantalla (no se imprime) cuando faltan datos de la empresa. */
function AvisoDeEmpresa({ razonSocial, ruc }: { razonSocial: string | null; ruc: string | null }) {
  if (razonSocial && ruc) return null;
  return (
    <p role="status" className="no-imprimir m-2 rounded-md border border-borde bg-superficie p-3 text-sm text-texto">
      Faltan la razón social o el RUC de la empresa; el documento saldrá incompleto.{' '}
      <Link to="/ajustes/empresa" className="font-medium underline">Completar en Ajustes › Empresa</Link>
    </p>
  );
}

function DatosDelPedido({ p, tipo }: { p: PedidoCompletoDto; tipo: TipoDeDocumento }) {
  const version = textoDeVersion(p.version, p.fecha, p.versiones);
  const pares =
    tipo === 'proforma'
      ? [
          { etiqueta: 'Cliente', valor: p.clienteNombre },
          { etiqueta: 'Pedido', valor: p.codigo },
          { etiqueta: 'Fecha', valor: formatearDia(p.fecha) },
          { etiqueta: 'Vigencia', valor: textoDeVigencia(p.fecha) },
        ]
      : [
          { etiqueta: 'Cliente', valor: p.clienteNombre },
          { etiqueta: 'Pedido', valor: p.codigo },
          { etiqueta: 'Fecha del pedido', valor: formatearDia(p.fecha) },
          { etiqueta: 'Fecha de entrega', valor: formatearDia(p.entregaEl) },
          ...(tipo === 'nota' ? [{ etiqueta: 'Estado', valor: ETIQUETA_DE_ESTADO[p.estado] }] : []),
        ];
  return <BloqueDeDatos titulo="Datos del pedido" pares={version ? [...pares, { etiqueta: 'Versión', valor: version }] : pares} />;
}

type Reimpresion = { reemplazadaPor: number } | null;

function Cuerpo({ p, tipo, adelanto, reimpresion, vigente }: { p: PedidoCompletoDto; tipo: TipoDeDocumento; adelanto: AdelantoDelPedido | null; reimpresion: Reimpresion; vigente: ReturnType<typeof correccionVigente> }) {
  const conPrecios = tipo !== 'orden-de-trabajo';
  return (
    <>
      {reimpresion ? <SelloDeReemplazada texto={textoDeReemplazada(reimpresion.reemplazadaPor)} /> : null}
      <DatosDelPedido p={p} tipo={tipo} />
      {p.notas ? <BloqueDeDatos titulo="Notas" columnas={1} pares={[{ etiqueta: 'Observaciones', valor: p.notas }]} /> : null}
      <TablaImprimible
        etiqueta={`Detalle: ${TITULO_DE_DOCUMENTO[tipo]}`}
        columnas={[...(conPrecios ? COLUMNAS_CON_PRECIO : COLUMNAS_SIN_PRECIO)]}
        filas={filasDelDocumento(p.detalle, conPrecios)}
        totales={conPrecios ? totalesConAdelanto(totalesDelDocumento(p), adelanto, p.totalCentimos) : undefined}
      />
      {conPrecios ? <p className="text-[0.9em]">{textoDeIgvIncluido(p.igvPorcentaje)}.</p> : null}
      {conPrecios && vigente ? <RecuadroQueCambio correccion={vigente} /> : null}
      {tipo === 'orden-de-trabajo' ? (
        <>
          <section className="evitar-corte" aria-label="Especificaciones a mano">
            <h2 className="mb-1 text-[10pt] font-bold uppercase">Especificaciones</h2>
            <div className="caja-a-mano border border-black" />
          </section>
          <div className="flex flex-wrap justify-between gap-x-8">
            <LineaDeFirma etiqueta="Recibido por" />
            <LineaDeFirma etiqueta="Entregado por" />
          </div>
        </>
      ) : null}
    </>
  );
}


function Documento({ pedido, tipo, version }: { pedido: PedidoCompletoDto; tipo: TipoDeDocumento; version: number | null }) {
  const navegar = useNavigate();
  // Una versión anterior se arma desde su foto guardada y lleva el sello de reemplazada; la vigente, su «Qué cambió».
  const p = (version === null ? pedido : pedidoDeVersion(pedido, version)) ?? pedido;
  const reimpresion: Reimpresion = version === null ? null : { reemplazadaPor: version + 1 };
  const vigente = version === null ? correccionVigente(pedido) : null;
  const { datos } = useDatosDeEmpresaParaImprimir();
  const empresa = normalizarEmpresa(datos);
  const aviso = reimpresion ? textoDeReemplazada(reimpresion.reemplazadaPor) : tipo === 'proforma' ? AVISO_PROFORMA : null;
  // El adelanto vive en Finanzas (la deuda del pedido). Quien no tiene acceso a Finanzas simplemente no lo ve en el documento.
  const deuda = useQuery({
    queryKey: [...CLAVE_PEDIDOS, 'deuda-del-pedido', p.id],
    queryFn: async () => {
      const r = await buscarDeudaDelPedido(p.id, p.clienteId);
      return r.ok ? r.datos : null;
    },
    enabled: tipo !== 'orden-de-trabajo' && p.estado !== 'borrador' && !reimpresion,
    retry: false,
  });
  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar(`/m/ordenes/${p.id}`)} etiquetaVolver="Volver al pedido" />
      <AvisoDeEmpresa razonSocial={empresa.razonSocial} ruc={empresa.ruc} />
      <VistaPreviaDeHoja>
        <HojaImprimible titulo={`${TITULO_DE_DOCUMENTO[tipo]} ${p.codigo}${p.version > 1 ? ` · versión ${p.version}` : ''}`} empresa={datos} aviso={aviso} formato={formatoDelDocumento(tipo, p)}>
          <Cuerpo p={p} tipo={tipo} adelanto={deuda.data ?? null} reimpresion={reimpresion} vigente={vigente} />
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}

/** Pantalla de un documento imprimible del pedido: `/m/ordenes/:id/proforma`, `/nota`, `/orden-de-trabajo`. */
export function PantallaDocumentoDePedido({ tipo }: { tipo: string }) {
  const { id = '' } = useParams();
  const [busqueda] = useSearchParams();
  const version = Number(busqueda.get('version')) || null;
  const consulta = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'ficha', id], queryFn: async () => datosOError(await verPedido(id)) });
  if (!esTipoDeDocumento(tipo)) return <EstadoVacio titulo="Documento desconocido" descripcion="Ese documento no existe." icono="caja" />;
  if (consulta.isPending) return <Cargando etiqueta="Cargando documento" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos este pedido" descripcion={consulta.error.message} icono="caja" />;
  if (!sePuedeImprimir(tipo, consulta.data.estado)) {
    return (
      <EstadoVacio
        titulo={`${TITULO_DE_DOCUMENTO[tipo]} no disponible`}
        descripcion={`No se puede imprimir con el pedido en estado «${ETIQUETA_DE_ESTADO[consulta.data.estado]}».`}
        icono="caja"
      />
    );
  }
  if (version !== null && !pedidoDeVersion(consulta.data, version)) {
    return <EstadoVacio titulo="Esa versión no existe" descripcion={`El pedido ${consulta.data.codigo} no tiene una versión ${version} guardada.`} icono="caja" />;
  }
  return <Documento pedido={consulta.data} tipo={tipo} version={version} />;
}
