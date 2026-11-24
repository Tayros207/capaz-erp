import { CONTRATOS_DE_PLATAFORMA, rechazo, type Respuesta } from '@capaz/shared';
import { interpretarRespuesta } from '../shared/api/cliente.ts';
import { anotarLlamada } from '../shared/api/llamador/almacen.ts';
import { ejecutarConConfirmacion, type ResultadoConfirmado } from '../shared/api/llamador/confirmacion.ts';
import { crearLlamadorEnSerie } from '../shared/api/llamador/llamar.ts';
import { confirmar } from '../shared/ui/confirmar.ts';

export type NombreDePlataforma = keyof typeof CONTRATOS_DE_PLATAFORMA;
export type EntradaDePlataforma<N extends NombreDePlataforma> = (typeof CONTRATOS_DE_PLATAFORMA)[N]['entrada']['_input'];
export type SalidaDePlataforma<N extends NombreDePlataforma> = (typeof CONTRATOS_DE_PLATAFORMA)[N]['salida']['_output'];

const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** Igual que `enviarHerramienta` del llamador común, pero contra la puerta de la consola: `/api/v1/plataforma/herramientas/:nombre`. */
async function enviarAPlataforma(nombre: string, args: unknown, confirmacion: string | undefined, clave: string): Promise<Respuesta<unknown>> {
  const contrato = CONTRATOS_DE_PLATAFORMA[nombre as NombreDePlataforma];
  if (!contrato) return rechazo('herramienta_desconocida', 'Esa herramienta no existe.');
  try {
    const respuesta = await fetch(`/api/v1/plataforma/herramientas/${encodeURIComponent(nombre)}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'idempotency-key': clave },
      body: JSON.stringify({ ...(args === undefined ? {} : { args }), ...(confirmacion === undefined ? {} : { confirmacion }) }),
    });
    return interpretarRespuesta(respuesta.status, await respuesta.text(), contrato.salida);
  } catch {
    return rechazo('sin_conexion', MENSAJE_SIN_CONEXION);
  }
}

const llamarEnSerie = crearLlamadorEnSerie({
  enviar: enviarAPlataforma,
  anotar: anotarLlamada,
  nuevaClave: () => crypto.randomUUID(),
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
});

/** Llama a una herramienta de plataforma. Nunca lanza. */
export function llamarPlataforma<N extends NombreDePlataforma>(nombre: N, args: EntradaDePlataforma<N>): Promise<Respuesta<SalidaDePlataforma<N>>> {
  return llamarEnSerie(nombre, args) as Promise<Respuesta<SalidaDePlataforma<N>>>;
}

/** Herramienta crítica en dos pasos: muestra el resumen del servidor y reenvía el token si la persona acepta. */
export function llamarConfirmandoPlataforma<N extends NombreDePlataforma>(
  nombre: N,
  args: EntradaDePlataforma<N>,
  textos: { titulo: string; textoConfirmar?: string; peligroso?: boolean },
): Promise<ResultadoConfirmado<SalidaDePlataforma<N>>> {
  return ejecutarConConfirmacion(
    (confirmacion) => llamarEnSerie(nombre, args, confirmacion),
    (resumen, vencio) =>
      confirmar(textos.titulo, vencio ? `La confirmación anterior venció. ${resumen}` : resumen, {
        textoConfirmar: textos.textoConfirmar,
        peligroso: textos.peligroso,
      }),
  ) as Promise<ResultadoConfirmado<SalidaDePlataforma<N>>>;
}

/** Error de una llamada rechazada; lo usan las consultas con caché, que necesitan una excepción. */
export class ErrorDeApi extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export function datosOError<S>(r: Respuesta<S>): S {
  if (r.ok && 'datos' in r) return r.datos;
  if ('error' in r) throw new ErrorDeApi(r.error.codigo, r.error.mensaje);
  throw new ErrorDeApi('requiere_confirmacion', 'La operación pide una confirmación que esta pantalla no maneja.');
}

export const listarEmpresas = (texto?: string) => llamarPlataforma('plataforma_empresas_listar', texto ? { texto } : {});
export const verEmpresa = (empresa: string) => llamarPlataforma('plataforma_empresas_ver', { empresa });
export const listarModulos = () => llamarPlataforma('plataforma_modulos_listar', {});
export const listarPlanes = () => llamarPlataforma('plataforma_planes_listar', {});
export const listarSolicitudes = (estado: EntradaDePlataforma<'plataforma_solicitudes_listar'>['estado']) =>
  llamarPlataforma('plataforma_solicitudes_listar', { estado });

export const crearEmpresa = (args: EntradaDePlataforma<'plataforma_empresas_crear'>) =>
  llamarConfirmandoPlataforma('plataforma_empresas_crear', args, { titulo: 'Crear empresa', textoConfirmar: 'Crear' });
export const activarModulo = (args: EntradaDePlataforma<'plataforma_modulo_activar'>) =>
  llamarConfirmandoPlataforma('plataforma_modulo_activar', args, { titulo: 'Activar módulo', textoConfirmar: 'Activar' });
export const suspenderModulo = (args: EntradaDePlataforma<'plataforma_modulo_suspender'>) =>
  llamarConfirmandoPlataforma('plataforma_modulo_suspender', args, { titulo: 'Suspender módulo', textoConfirmar: 'Suspender', peligroso: true });
export const darDeBajaModulo = (args: EntradaDePlataforma<'plataforma_modulo_dar_de_baja'>) =>
  llamarConfirmandoPlataforma('plataforma_modulo_dar_de_baja', args, { titulo: 'Dar de baja el módulo', textoConfirmar: 'Dar de baja', peligroso: true });
export const reactivarModulo = (args: EntradaDePlataforma<'plataforma_modulo_reactivar'>) =>
  llamarConfirmandoPlataforma('plataforma_modulo_reactivar', args, { titulo: 'Reactivar módulo', textoConfirmar: 'Reactivar' });
export const fijarContrato = (args: EntradaDePlataforma<'plataforma_contrato_fijar'>) =>
  llamarConfirmandoPlataforma('plataforma_contrato_fijar', args, { titulo: 'Fijar contrato', textoConfirmar: 'Fijar' });
export const guardarPlan = (args: EntradaDePlataforma<'plataforma_planes_guardar'>) =>
  llamarConfirmandoPlataforma('plataforma_planes_guardar', args, { titulo: 'Guardar plan', textoConfirmar: 'Guardar' });
export const atenderSolicitud = (args: EntradaDePlataforma<'plataforma_solicitud_atender'>) =>
  llamarConfirmandoPlataforma('plataforma_solicitud_atender', args, { titulo: 'Atender solicitud', textoConfirmar: 'Confirmar' });
export const restablecerContrasena = (correo: string) =>
  llamarConfirmandoPlataforma('plataforma_restablecer_contrasena', { correo }, { titulo: 'Generar enlace de restablecimiento', textoConfirmar: 'Generar enlace', peligroso: true });
