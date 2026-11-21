import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { verCoberturaDelMes } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { textoDeCobertura } from './logica-cobertura.ts';

const CAJA = 'rounded-control border border-borde bg-superficie-alta px-3 py-2 text-sm text-texto';

/**
 * Cuánto de los pagos del mes (deudas por pagar con vencimiento ese mes) ya cubren los ingresos. Es un dato de
 * apoyo: si la persona no tiene alcance para verlo o la consulta falla, simplemente no se muestra.
 */
export function CoberturaDelMes({ hoy }: { hoy: string }) {
  const q = useQuery({ queryKey: [...CLAVE_REGISTRO, 'cobertura-del-mes', hoy.slice(0, 7)], retry: false, staleTime: 60_000, queryFn: async () => datosOError(await verCoberturaDelMes(hoy.slice(0, 7))) });
  if (q.isPending) return <Esqueleto className="h-10" />;
  if (q.isError) return null;
  if (q.data.compromisos === 0) {
    return (
      <p role="status" className={CAJA}>
        Anota tus pagos (alquiler, sueldos, compras a crédito…) como deudas por pagar con su fecha de vencimiento para ver aquí cuánto te falta cubrir.{' '}
        <Link to="/m/registro/por-pagar" className="font-medium text-accion underline">Ir a Por pagar</Link>
      </p>
    );
  }
  return <p role="status" className={CAJA}>{textoDeCobertura(q.data, hoy)}</p>;
}
