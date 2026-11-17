import type { Respuesta } from '@capaz/shared';
import { notificar } from '../../shared/ui/notificar.ts';
import { resolverAccion } from './acciones.ts';

type Resultado = Respuesta<unknown> | { cancelada: true };

export type PlanDeGuardado<F, O, AC, AE> = {
  formulario: F;
  original: O | null;
  validar: (f: F) => Record<string, string | undefined>;
  alErrores: (e: Record<string, string | undefined>) => void;
  armarCreacion: (f: F) => AC;
  armarEdicion: (o: O, f: F) => AE | null;
  crear: (a: AC) => Promise<Resultado>;
  editar: (a: AE) => Promise<Resultado>;
  mensajes: { creado: string; editado: string };
};

/** Valida, arma los argumentos (en edición, solo lo cambiado) y guarda. Devuelve `true` si la hoja puede cerrarse. */
export async function guardarEnTaller<F, O, AC, AE>(p: PlanDeGuardado<F, O, AC, AE>, alEmpezar: () => void, alTerminar: () => void): Promise<boolean> {
  const e = p.validar(p.formulario);
  p.alErrores(e);
  if (Object.values(e).some((m) => m !== undefined)) return false;
  const cambios = p.original ? p.armarEdicion(p.original, p.formulario) : null;
  if (p.original && !cambios) {
    notificar('No cambiaste nada.', 'info');
    return true;
  }
  alEmpezar();
  const llamada = p.original && cambios ? p.editar(cambios) : p.crear(p.armarCreacion(p.formulario));
  const ok = await resolverAccion(llamada, p.original ? p.mensajes.editado : p.mensajes.creado);
  alTerminar();
  return ok;
}
