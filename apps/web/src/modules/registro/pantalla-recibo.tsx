import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { BarraDeImpresion, BloqueDeDatos, HojaImprimible, LineaDeFirma, TablaImprimible, VistaPreviaDeHoja } from '../../shared/impresion/hoja-imprimible.tsx';
import { normalizarEmpresa } from '../../shared/impresion/logica-impresion.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { verDeuda } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { AVISO_DE_RECIBO, paresDelRecibo, reciboDeAbono, totalesDelRecibo, type ReciboDeAbono } from './recibos.ts';

/** Aviso solo en pantalla (no se imprime) cuando faltan datos de la empresa. */
export function AvisoDeEmpresa({ razonSocial, ruc }: { razonSocial: string | null; ruc: string | null }) {
  if (razonSocial && ruc) return null;
  return (
    <p role="status" className="no-imprimir m-2 rounded-md border border-borde bg-superficie p-3 text-sm text-texto">
      Faltan la razón social o el RUC de la empresa; el documento saldrá incompleto.{' '}
      <Link to="/ajustes/empresa" className="font-medium underline">Completar en Ajustes › Empresa</Link>
    </p>
  );
}

function Recibo({ r, deudaId }: { r: ReciboDeAbono; deudaId: string }) {
  const navegar = useNavigate();
  const { datos } = useDatosDeEmpresaParaImprimir();
  const empresa = normalizarEmpresa(datos);
  return (
    <div className="flex flex-col">
      <BarraDeImpresion onVolver={() => void navegar(`/m/registro/deudas/${deudaId}`)} etiquetaVolver="Volver a la deuda" />
      <AvisoDeEmpresa razonSocial={empresa.razonSocial} ruc={empresa.ruc} />
      <VistaPreviaDeHoja>
        <HojaImprimible titulo="Recibo de pago" empresa={datos} aviso={AVISO_DE_RECIBO}>
          <BloqueDeDatos titulo="Datos del pago" pares={paresDelRecibo(r)} />
          <section className="evitar-corte" aria-label="Monto recibido">
            <p className="text-[8.5pt] font-semibold uppercase">Monto recibido en letras</p>
            <p className="font-semibold">SON: {r.montoEnLetras}</p>
          </section>
          <TablaImprimible
            etiqueta="Resumen del abono"
            columnas={[{ clave: 'concepto', titulo: 'Concepto' }, { clave: 'monto', titulo: 'Monto', formato: 'soles', ancho: '40mm' }]}
            filas={[{ concepto: `Abono a la deuda ${r.codigoDeuda}: ${r.concepto}`, monto: r.montoCentimos }]}
            totales={totalesDelRecibo(r)}
          />
          <div className="flex flex-wrap justify-between gap-x-8">
            <LineaDeFirma etiqueta="Recibí conforme" detalle={empresa.razonSocial ?? undefined} />
            <LineaDeFirma etiqueta="Pagué conforme" detalle={r.cliente} />
          </div>
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </div>
  );
}

/** `/m/registro/deudas/:id/abonos/:abonoId/recibo`: constancia imprimible de un abono de cuentas por cobrar. */
export function PantallaRecibo() {
  const { id = '', abonoId = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'deuda', id], queryFn: async () => datosOError(await verDeuda(id)) });
  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando recibo" className="flex flex-col gap-2 p-4"><Esqueleto className="h-8 w-1/2" /><Esqueleto className="h-40" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos esta deuda" descripcion={consulta.error.message} icono="caja" />;
  const res = reciboDeAbono(consulta.data, abonoId);
  if (res.tipo === 'anulado') return <EstadoVacio titulo="Abono anulado" descripcion="Un abono anulado no genera recibo." icono="caja" />;
  if (res.tipo === 'no-aplica') return <EstadoVacio titulo="Recibo no disponible" descripcion="Los recibos son solo para cuentas por cobrar." icono="caja" />;
  if (res.tipo === 'no-encontrado') return <EstadoVacio titulo="No encontramos este abono" icono="caja" />;
  return <Recibo r={res.recibo} deudaId={id} />;
}
