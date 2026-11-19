import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router';
import { formatearSoles, type OrdenDeProduccionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { BarraDeImpresion, BloqueDeDatos, HojaImprimible, LineaDeFirma, TablaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { normalizarEmpresa, type FilaDeTotal } from '../../shared/impresion/logica-impresion.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { verOrden } from './api.ts';
import { CLAVE_PRODUCCION } from './claves.ts';
import { Cargando } from './marco.tsx';
import { ETIQUETA_DE_ESTADO } from './logica.ts';

// Documento imprimible de una orden de trabajo del taller: lo que se le pasa al cliente (qué pidió, la receta, cuánto dejó
// a cuenta y cuánto falta) y a quien produce. Se imprime o se guarda como PDF desde el navegador.

const COLUMNAS = [
  { clave: 'n', titulo: 'N.º', ancho: '10mm' },
  { clave: 'trabajo', titulo: 'Trabajo' },
  { clave: 'cantidad', titulo: 'Cantidad', alineacion: 'derecha', ancho: '28mm' },
  { clave: 'valor', titulo: 'V. unitario', alineacion: 'derecha', ancho: '28mm' },
  { clave: 'subtotal', titulo: 'Subtotal', alineacion: 'derecha', ancho: '30mm' },
] as const;

const dia = (d: string | null): string => {
  if (!d) return '—';
  const [a, m, x] = d.split('-');
  return a && m && x ? `${x}/${m}/${a}` : d;
};
const valorUnitario = (milesimas: number): string => `S/ ${(milesimas / 1000).toFixed(3).replace(/0$/, '')}`;

/** Los trabajos con su receta (material, medida, colores y acabado) debajo de la descripción. */
function filasDe(o: OrdenDeProduccionCompletaDto) {
  return [...o.lineas]
    .sort((a, b) => a.posicion - b.posicion)
    .map((l, i) => {
      const receta = [l.material, l.medida, l.colores, l.acabado].filter(Boolean).join(' · ');
      return { n: i + 1, trabajo: receta ? `${l.descripcion} — ${receta}` : l.descripcion, cantidad: `${formatearCantidad(l.cantidadMilesimas)} ${l.unidad}`, valor: valorUnitario(l.precioUnitarioMilesimas), subtotal: formatearSoles(l.subtotalCentimos) };
    });
}

function totalesDe(o: OrdenDeProduccionCompletaDto): FilaDeTotal[] {
  const filas: FilaDeTotal[] = [{ etiqueta: 'Total', valor: formatearSoles(o.totalCentimos), destacado: true }];
  if (o.adelantoCentimos > 0) filas.push({ etiqueta: 'A cuenta', valor: formatearSoles(o.adelantoCentimos) });
  filas.push({ etiqueta: o.saldoCentimos === 0 ? 'Saldo' : 'Falta cancelar', valor: o.saldoCentimos === 0 ? 'CANCELADO' : formatearSoles(o.saldoCentimos), destacado: true });
  return filas;
}

function Documento({ o }: { o: OrdenDeProduccionCompletaDto }) {
  const navegar = useNavigate();
  const { datos } = useDatosDeEmpresaParaImprimir();
  const empresa = normalizarEmpresa(datos);
  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar(`/m/produccion/${o.id}`)} etiquetaVolver="Volver a la orden" />
      {empresa.razonSocial && empresa.ruc ? null : (
        <p role="status" className="no-imprimir m-2 rounded-md border border-borde bg-superficie p-3 text-sm text-texto">
          Faltan la razón social o el RUC de la empresa; el documento saldrá incompleto. <Link to="/ajustes/empresa" className="font-medium underline">Completar en Ajustes › Empresa</Link>
        </p>
      )}
      <VistaPreviaDeHoja>
        <HojaImprimible titulo={`Orden de trabajo ${o.codigo}`} empresa={datos}>
          <BloqueDeDatos
            titulo="Datos de la orden"
            pares={[
              { etiqueta: 'Cliente', valor: o.clienteNombre },
              { etiqueta: 'Orden', valor: o.codigo },
              { etiqueta: 'Fecha', valor: dia(o.fecha) },
              { etiqueta: 'Fecha de entrega', valor: dia(o.entregaEl) },
              { etiqueta: 'Estado', valor: ETIQUETA_DE_ESTADO[o.estado] },
            ]}
          />
          {o.notas ? <BloqueDeDatos titulo="Notas" columnas={1} pares={[{ etiqueta: 'Observaciones', valor: o.notas }]} /> : null}
          <TablaImprimible etiqueta="Trabajos de la orden" columnas={[...COLUMNAS]} filas={filasDe(o)} totales={totalesDe(o)} />
          <div className="flex flex-wrap justify-between gap-x-8">
            <LineaDeFirma etiqueta="Recibido por" />
            <LineaDeFirma etiqueta="Entregado por" />
          </div>
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}

/** `/m/produccion/:id/documento`: la orden de trabajo lista para imprimir o guardar como PDF. */
export function PantallaDocumentoDeOrden() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_PRODUCCION, 'documento', id], queryFn: async () => datosOError(await verOrden(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando documento" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta orden" descripcion={consulta.error.message} icono="caja" />;
  return <Documento o={consulta.data} />;
}
