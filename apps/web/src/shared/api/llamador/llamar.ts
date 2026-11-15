import { rechazo, type Respuesta } from '@capaz/shared';
import { crearColaEnSerie } from './cola.ts';
import type { EventoDelLlamador } from './estado-del-llamador.ts';

export type DependenciasDelLlamador = {
  /** Una sola petición (sin reintentos). */
  enviar: (nombre: string, args: unknown, confirmacion: string | undefined, clave: string) => Promise<Respuesta<unknown>>;
  anotar: (evento: EventoDelLlamador) => void;
  nuevaClave: () => string;
  esperar: (ms: number) => Promise<void>;
  /** Reintentos tras una caída de red (con la misma clave de idempotencia). */
  reintentos?: number;
  esperaBaseMs?: number;
};

const esSinConexion = (r: Respuesta<unknown>) => !r.ok && 'error' in r && r.error.codigo === 'sin_conexion';

/**
 * Crea la función que llama a una herramienta: las llamadas salen de a una (cola en serie), cada una lleva
 * su propia `Idempotency-Key`, y si la red cae se reintenta con LA MISMA clave: así el servidor no repite
 * la operación aunque la primera sí llegara. Nunca lanza.
 */
export function crearLlamadorEnSerie(dep: DependenciasDelLlamador) {
  const enSerie = crearColaEnSerie();
  const reintentos = dep.reintentos ?? 2;
  const espera = dep.esperaBaseMs ?? 600;

  async function conReintentos(nombre: string, args: unknown, confirmacion: string | undefined): Promise<Respuesta<unknown>> {
    const clave = dep.nuevaClave();
    let r = await dep.enviar(nombre, args, confirmacion, clave);
    for (let n = 1; n <= reintentos && esSinConexion(r); n++) {
      await dep.esperar(espera * n);
      r = await dep.enviar(nombre, args, confirmacion, clave);
    }
    return r;
  }

  return function llamarEnSerie(nombre: string, args?: unknown, confirmacion?: string): Promise<Respuesta<unknown>> {
    dep.anotar({ tipo: 'salio' });
    const solicitud = enSerie(async () => {
      try {
        return await conReintentos(nombre, args, confirmacion);
      } catch {
        return rechazo('sin_conexion', 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
      }
    });
    void solicitud.then((r) => dep.anotar({ tipo: 'termino', ok: r.ok, sinConexion: esSinConexion(r) }));
    return solicitud;
  };
}
