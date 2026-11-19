import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { BarraDeImpresion, BloqueDeDatos, HojaImprimible, TablaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { normalizarEmpresa } from '../../shared/impresion/logica-impresion.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { verCotizacion } from './api-cotizaciones.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import {
  AVISO_DE_COTIZACION, TITULO_DE_DOCUMENTO, condicionesParaDocumento, filasDelDocumento, formatearDia, textoDeIgv, textoDeOpciones, totalesDelDocumento,
} from './documento-cotizacion.ts';
import { ETIQUETA_DE_ESTADO, rutaDeFicha, sePuedeImprimir } from './logica-cotizaciones.ts';
import { Cargando } from './marco.tsx';

const COLUMNAS = [
  { clave: 'n', titulo: 'N.º', ancho: '10mm' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cantidad', alineacion: 'derecha', ancho: '24mm' },
  { clave: 'precio', titulo: 'P. unitario', alineacion: 'derecha', ancho: '27mm' },
  { clave: 'importe', titulo: 'Importe', alineacion: 'derecha', ancho: '29mm' },
  { clave: 'total', titulo: 'Con IGV', alineacion: 'derecha', ancho: '29mm' },
] as const;

function AvisoDeEmpresa({ razonSocial, ruc }: { razonSocial: string | null; ruc: string | null }) {
  if (razonSocial && ruc) return null;
  return (
    <p role="status" className="no-imprimir m-2 rounded-md border border-borde bg-superficie p-3 text-sm text-texto">
      Faltan la razón social o el RUC de la empresa; el documento saldrá incompleto.{' '}
      <Link to="/ajustes/empresa" className="font-medium underline">Completar en Ajustes › Empresa</Link>
    </p>
  );
}

function Documento({ c }: { c: CotizacionCompletaDto }) {
  const navegar = useNavigate();
  const { datos } = useDatosDeEmpresaParaImprimir();
  const empresa = normalizarEmpresa(datos);
  const condiciones = condicionesParaDocumento(c);
  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar(rutaDeFicha(c.id))} etiquetaVolver="Volver a la cotización" />
      <AvisoDeEmpresa razonSocial={empresa.razonSocial} ruc={empresa.ruc} />
      <VistaPreviaDeHoja>
        <HojaImprimible titulo={`${TITULO_DE_DOCUMENTO} ${c.codigo}`} empresa={datos} aviso={AVISO_DE_COTIZACION}>
          <BloqueDeDatos titulo="Datos de la cotización" pares={[
            { etiqueta: 'Cliente', valor: c.clienteNombre ?? '' },
            { etiqueta: 'Cotización', valor: c.codigo },
            { etiqueta: 'Referencia', valor: c.titulo },
            { etiqueta: 'Emitida', valor: c.emitidaEn ? formatearDia(c.emitidaEn.slice(0, 10)) : '' },
          ]} />
          <TablaImprimible etiqueta={`Detalle: ${TITULO_DE_DOCUMENTO}`} columnas={[...COLUMNAS]} filas={filasDelDocumento(c.lineas)} totales={totalesDelDocumento(c)} />
          <p className="text-[9pt]">{c.conOpciones ? textoDeOpciones : textoDeIgv(c.igvPorcentaje)}</p>
          {condiciones.length > 0 ? <BloqueDeDatos titulo="Condiciones" columnas={1} pares={condiciones.map((p) => ({ etiqueta: p.etiqueta, valor: p.valor }))} /> : null}
          {c.notas ? <BloqueDeDatos titulo="Notas" columnas={1} pares={[{ etiqueta: 'Observaciones', valor: c.notas }]} /> : null}
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}

/** `/m/cotizador/cotizaciones/:id/documento`: la cotización imprimible, sin costos ni margen. */
export function PantallaDocumentoDeCotizacion() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'ficha', id], queryFn: async () => datosOError(await verCotizacion(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando documento" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta cotización" descripcion={consulta.error.message} icono="caja" />;
  if (!sePuedeImprimir(consulta.data.estado)) {
    return <EstadoVacio titulo="Cotización no disponible" descripcion={`No se puede imprimir con la cotización en estado «${ETIQUETA_DE_ESTADO[consulta.data.estado]}».`} icono="caja" />;
  }
  return <Documento c={consulta.data} />;
}
