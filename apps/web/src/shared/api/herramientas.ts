import { CONTRATOS, type EntradaDe, type NombreDeHerramienta, type Respuesta, type SalidaDe } from '@capaz/shared';
import { confirmar } from '../ui/confirmar.ts';
import { anotarLlamada } from './llamador/almacen.ts';
import { ejecutarConConfirmacion, type ResultadoConfirmado } from './llamador/confirmacion.ts';
import { crearLlamadorEnSerie } from './llamador/llamar.ts';
import { enviarHerramienta } from './llamador/transporte.ts';

const llamarEnSerie = crearLlamadorEnSerie({
  enviar: (nombre, args, confirmacion, clave) => {
    const contrato = CONTRATOS[nombre as NombreDeHerramienta];
    // Una herramienta que no existe en el registro compartido nunca sale al servidor.
    if (!contrato) return Promise.resolve({ ok: false, error: { codigo: 'herramienta_desconocida', mensaje: 'Esa herramienta no existe.' } } as const);
    return enviarHerramienta(nombre, args, confirmacion, clave, contrato.salida, undefined);
  },
  anotar: anotarLlamada,
  nuevaClave: () => crypto.randomUUID(),
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
});

/**
 * Llama a una herramienta del servidor (`POST /api/v1/herramientas/:nombre`). Tipada por los contratos
 * de `@capaz/shared`. Las llamadas salen en serie, cada una con su `Idempotency-Key` (la misma en los
 * reintentos por caída de red). Nunca lanza. Una herramienta crítica responde primero con
 * `requiereConfirmacion`: para esa vía usa `llamarConfirmando`.
 */
export function llamar<N extends NombreDeHerramienta>(
  nombre: N,
  args: EntradaDe<N>,
  opciones: { confirmacion?: string } = {},
): Promise<Respuesta<SalidaDe<N>>> {
  return llamarEnSerie(nombre, args, opciones.confirmacion) as Promise<Respuesta<SalidaDe<N>>>;
}

/**
 * Herramienta crítica en dos pasos: pide el resumen, lo muestra con `confirmar()` y, si la persona
 * acepta, reenvía el token. Si el token venció, lo pide otra vez. `{ cancelada: true }` si desiste.
 */
export function llamarConfirmando<N extends NombreDeHerramienta>(
  nombre: N,
  args: EntradaDe<N>,
  textos: { titulo: string; textoConfirmar?: string; peligroso?: boolean },
): Promise<ResultadoConfirmado<SalidaDe<N>>> {
  return ejecutarConConfirmacion(
    (confirmacion) => llamarEnSerie(nombre, args, confirmacion),
    (resumen, vencio) =>
      confirmar(textos.titulo, vencio ? `La confirmación anterior venció. ${resumen}` : resumen, {
        textoConfirmar: textos.textoConfirmar,
        peligroso: textos.peligroso,
      }),
  ) as Promise<ResultadoConfirmado<SalidaDe<N>>>;
}

export type { ResultadoConfirmado };
