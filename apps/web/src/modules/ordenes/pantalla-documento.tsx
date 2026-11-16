import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import type { PedidoCompletoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { BarraDeImpresion, BloqueDeDatos, HojaImprimible, LineaDeFirma, TablaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { normalizarEmpresa } from '../../shared/impresion/logica-impresion.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { verPedido } from './api.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { TITULO_DE_DOCUMENTO, esTipoDeDocumento, filasDelDocumento, sePuedeImprimir, textoDeIgvIncluido, textoDeVigencia, totalesDelDocumento, type TipoDeDocumento } from './documentos.ts';
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
  return <BloqueDeDatos titulo="Datos del pedido" pares={pares} />;
}

function Cuerpo({ p, tipo }: { p: PedidoCompletoDto; tipo: TipoDeDocumento }) {
  const conPrecios = tipo !== 'orden-de-trabajo';
  return (
    <>
      <DatosDelPedido p={p} tipo={tipo} />
      {p.notas ? <BloqueDeDatos titulo="Notas" columnas={1} pares={[{ etiqueta: 'Observaciones', valor: p.notas }]} /> : null}
      <TablaImprimible
        etiqueta={`Detalle: ${TITULO_DE_DOCUMENTO[tipo]}`}
        columnas={[...(conPrecios ? COLUMNAS_CON_PRECIO : COLUMNAS_SIN_PRECIO)]}
        filas={filasDelDocumento(p.detalle, conPrecios)}
        totales={conPrecios ? totalesDelDocumento(p) : undefined}
      />
      {conPrecios ? <p className="text-[9pt]">{textoDeIgvIncluido(p.igvPorcentaje)}.</p> : null}
      {tipo === 'orden-de-trabajo' ? (
        <>
          <section className="evitar-corte" aria-label="Especificaciones a mano">
            <h2 className="mb-1 text-[10pt] font-bold uppercase">Especificaciones</h2>
            <div className="h-40 border border-black" />
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

function Documento({ p, tipo }: { p: PedidoCompletoDto; tipo: TipoDeDocumento }) {
  const navegar = useNavigate();
  const { datos } = useDatosDeEmpresaParaImprimir();
  const empresa = normalizarEmpresa(datos);
  const aviso = tipo === 'proforma' ? AVISO_PROFORMA : null;
  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar(`/m/ordenes/${p.id}`)} etiquetaVolver="Volver al pedido" />
      <AvisoDeEmpresa razonSocial={empresa.razonSocial} ruc={empresa.ruc} />
      <VistaPreviaDeHoja>
        <HojaImprimible titulo={`${TITULO_DE_DOCUMENTO[tipo]} ${p.codigo}`} empresa={datos} aviso={aviso}>
          <Cuerpo p={p} tipo={tipo} />
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}

/** Pantalla de un documento imprimible del pedido: `/m/ordenes/:id/proforma`, `/nota`, `/orden-de-trabajo`. */
export function PantallaDocumentoDePedido({ tipo }: { tipo: string }) {
  const { id = '' } = useParams();
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
  return <Documento p={consulta.data} tipo={tipo} />;
}
