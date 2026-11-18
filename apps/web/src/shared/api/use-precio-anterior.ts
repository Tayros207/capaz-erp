import { useQuery } from '@tanstack/react-query';
import { datosOError } from './consultas.ts';
import { llamar } from './herramientas.ts';
import { ESPERA_DE_SUGERENCIA_MS, puedeSugerir, type PrecioAnterior } from './logica-precio-anterior.ts';
import { puede } from '../sesion/sesion.ts';
import { useYo } from '../sesion/use-yo.ts';
import { useRetardo } from '../ui/use-retardo.ts';

type Entrada = { clienteId: string | null | undefined; productoId?: string | null; descripcion: string };

/**
 * Lo último que se le cobró a ese cliente por ese producto (`precio_anterior_consultar`). Espera 400 ms después de la última
 * tecla y no consulta sin cliente ni producto (o 3 letras). Nunca falla en voz alta: sin permiso o sin datos, no hay sugerencia.
 */
export function usePrecioAnterior({ clienteId, productoId, descripcion }: Entrada): { precio: PrecioAnterior | null } {
  const yo = useYo();
  const cliente = useRetardo(clienteId ?? null, ESPERA_DE_SUGERENCIA_MS);
  const producto = useRetardo(productoId ?? null, ESPERA_DE_SUGERENCIA_MS);
  const texto = useRetardo(descripcion.trim(), ESPERA_DE_SUGERENCIA_MS);
  const activa = !!yo && puede(yo, 'clientes:ver') && puedeSugerir(cliente, producto, texto);
  const consulta = useQuery({
    queryKey: ['precio-anterior', cliente, producto, producto ? '' : texto.toLowerCase()],
    enabled: activa,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const r = datosOError(await llamar('precio_anterior_consultar', { clienteId: cliente!, ...(producto ? { productoId: producto } : { texto }), limite: 1 }));
      return r.ultimo;
    },
  });
  return { precio: activa ? (consulta.data ?? null) : null };
}
