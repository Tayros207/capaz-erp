import { EVENTOS, type Accion, type Disparador, type ModoDeRegla } from '@capaz/shared';
import type { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { RegistroDeFuentesDeTiempo } from './tipos.js';

/** Una regla no puede manejar la bandeja ni a otras reglas: se pierde el humano que aprueba. */
const PREFIJOS_PROHIBIDOS = ['borrador_', 'borradores_', 'regla_', 'reglas_'];

/**
 * Problemas de las acciones frente al registro y al modo. Reglas de ADR-014 §5: una acción que mueve
 * dinero o es crítica nunca va en `automatico`. Se repite al guardar, al activar y al ejecutar.
 */
export function problemasDeAcciones(acciones: readonly Accion[], modo: ModoDeRegla, registro: RegistroDeHerramientas): string[] {
  const p: string[] = [];
  for (const a of acciones) {
    const h = registro.obtener(a.herramienta);
    if (!h) {
      p.push(`La herramienta «${a.herramienta}» no existe.`);
      continue;
    }
    if (PREFIJOS_PROHIBIDOS.some((x) => a.herramienta.startsWith(x))) {
      p.push(`«${a.herramienta}» no puede ser acción de una regla.`);
    }
    if (modo === 'automatico' && (h.mueveDinero || h.criticidad === 'critica')) {
      p.push(
        `«${a.herramienta}» ${h.mueveDinero ? 'mueve dinero' : 'es crítica'}: no puede ir en modo automático; usa borrador o pide aprobación.`,
      );
    }
  }
  return p;
}

export function problemasDeDisparador(d: Disparador, fuentes: RegistroDeFuentesDeTiempo): string[] {
  if (d.tipo === 'evento' && !(d.evento in EVENTOS)) return [`El evento «${d.evento}» no existe.`];
  if (d.tipo === 'tiempo' && !fuentes.obtener(d.fuente)) return [`La fuente de tiempo «${d.fuente}» no existe.`];
  return [];
}
