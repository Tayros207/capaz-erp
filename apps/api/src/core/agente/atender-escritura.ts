import { exito, rechazo, type Respuesta } from '@capaz/shared';
import { hashCanonico } from '../herramientas/confirmacion.js';
import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import { frenoDelTurno, guardasDeDinero } from './guardas-de-dinero.js';
import { CRITICAS_DE_DINERO, DINERO, type Politica } from './politica.js';
import { completarArgumentos, objeto, registrarBorradores, registrarResultado } from './registrar-resultado.js';
import type { ContextoDeLlamada, FilaDeHuella, PoliticaDeEjecucion } from './tipos-del-turno.js';

// Lo que hace el asistente cuando una llamada CAMBIA algo. Siempre por el ejecutor (la única puerta de las operaciones, con los
// permisos de la persona) o como borrador para que una persona lo apruebe. Y siempre con huella: nada de lo que el asistente hace o
// intenta cambiar queda sin rastro. Lo que no se puede hacer no se esconde: se le dice al modelo para que se lo diga a la persona.

const MENSAJE_SIN_BORRADORES = 'No puedo dejar eso como borrador en este momento. Dile a la persona que lo haga ella desde la pantalla correspondiente.';
const NOTA_DE_CONFIRMACION =
  'Esta es una acción crítica y todavía NO se hizo. Esto es lo que ocurriría: «{{resumen}}». Solo si la persona te lo pidió expresamente en esta conversación y es exactamente esto, repite la misma llamada en tu próximo paso para confirmarla. Si no te lo pidió así o hay cualquier duda, NO la repitas: pregúntale a la persona.';

const codigoDe = (r: Respuesta<unknown>): string | null => (!r.ok && 'error' in r ? r.error.codigo : null);

type Huella = Omit<FilaDeHuella, 'ronda' | 'indice' | 'hashArgs'>;

/** La huella de lo que no llegó a ejecutarse con éxito. Un fallo al escribirla no debe tumbar el turno. */
async function dejarHuella(c: ContextoDeLlamada, nombre: string, args: unknown, f: Omit<Huella, 'herramienta' | 'args'>): Promise<void> {
  try {
    await c.dep.huella?.aparte({ ...f, herramienta: nombre, args, ronda: c.ronda, indice: c.indice, hashArgs: hashCanonico(args ?? {}) });
  } catch {
    // La huella es parte de la seguridad: si falla, el turno sigue pero la acción que se intentó no queda a medias (ya se revirtió).
  }
}

/** Lo que no pasa por una persona sino por el asistente: queda como borrador en la Bandeja, con su huella. */
async function comoBorrador(c: ContextoDeLlamada, nombre: string, args: unknown, motivo: string | null): Promise<Respuesta<unknown>> {
  if (!c.dep.proponer) return rechazo('sin_permiso', MENSAJE_SIN_BORRADORES);
  const finales = completarArgumentos(nombre, args, c.entrada.origen, c.entrada.mensaje);
  // Un borrador idéntico no se deja dos veces en el mismo turno, y los borradores también cuentan para el tope de cambios del turno.
  const llave = `borrador:${nombre}:${hashCanonico(finales ?? {})}`;
  const freno = frenoDelTurno(c.estado, llave, false);
  if (freno) return rechazo('conflicto', freno);
  const propuesta = await c.dep.proponer(nombre, finales, c.entrada.ctx);
  if (!propuesta.ok) {
    await dejarHuella(c, nombre, finales, { politica: 'propuesta', resultado: 'rechazada', codigo: codigoDe(propuesta), resumenConfirmado: null });
    return propuesta;
  }
  c.estado.vistas.add(llave);
  c.estado.escrituras += 1;
  await registrarBorradores(c, propuesta.datos);
  await dejarHuella(c, nombre, finales, { politica: 'propuesta', resultado: 'propuesta', codigo: null, resumenConfirmado: motivo });
  return motivo ? exito({ ...objeto(propuesta.datos), motivo }) : propuesta;
}

/** Una acción crítica: la primera llamada solo pide confirmación; repetida en una ronda posterior (mismos argumentos) se ejecuta. */
async function conConfirmacionPropia(c: ContextoDeLlamada, h: HerramientaRegistrada, args: unknown): Promise<Respuesta<unknown>> {
  const finales = completarArgumentos(h.nombre, args, c.entrada.origen, c.entrada.mensaje);
  const llave = `${h.nombre}:${hashCanonico(finales ?? {})}`;
  const previa = c.estado.confirmaciones.get(llave);
  const r = await ejecutar(c, h, finales, 'confirmada', previa && previa.ronda < c.ronda ? previa.token : undefined);
  if (!r.ok && 'requiereConfirmacion' in r) {
    c.estado.confirmaciones.set(llave, { token: r.requiereConfirmacion.token, ronda: c.ronda });
    await dejarHuella(c, h.nombre, finales, { politica: 'confirmada', resultado: 'pendiente_confirmacion', codigo: null, resumenConfirmado: r.requiereConfirmacion.resumen });
    return exito({ pendiente: true, nota: NOTA_DE_CONFIRMACION.replace('{{resumen}}', r.requiereConfirmacion.resumen) });
  }
  if (!r.ok && (codigoDe(r) ?? '').startsWith('confirmacion_')) c.estado.confirmaciones.delete(llave);
  return r;
}

function contarEscritura(c: ContextoDeLlamada, h: HerramientaRegistrada, args: unknown): void {
  c.estado.escrituras += 1;
  c.estado.vistas.add(`${h.nombre}:${hashCanonico(args ?? {})}`);
  if (DINERO.has(h.nombre) || CRITICAS_DE_DINERO.has(h.nombre) || h.mueveDinero) c.estado.escriturasDeDinero += 1;
}

async function ejecutar(c: ContextoDeLlamada, h: HerramientaRegistrada, args: unknown, politica: PoliticaDeEjecucion, confirmacion?: string): Promise<Respuesta<unknown>> {
  const r = await c.dep.ejecutar(h.nombre, args, {
    ctx: { ...c.entrada.ctx, canal: 'agente' as const }, claveDeIdempotencia: `${c.entrada.turnoId}:${c.ronda}:${c.indice}`,
    ronda: c.ronda, indice: c.indice, politica, ...(confirmacion ? { confirmacion } : {}),
  });
  if (r.ok) {
    await registrarResultado(c, h, r.datos);
    // Se cuenta SOLO lo que de verdad se hizo: un intento que falló se puede corregir y repetir sin que el freno lo bloquee.
    if (h.criticidad !== 'lectura') contarEscritura(c, h, args);
  } else if (!('requiereConfirmacion' in r) && h.criticidad !== 'lectura') {
    await dejarHuella(c, h.nombre, args, { politica: politica === 'confirmada' ? 'confirmada' : 'directo', resultado: 'rechazada', codigo: codigoDe(r), resumenConfirmado: null });
  }
  return r;
}

/** Aplica las guardas del dinero: pasa (`null`), queda como borrador (con motivo) o se rechaza (error para el modelo, con su huella). */
async function porLasGuardas(c: ContextoDeLlamada, h: HerramientaRegistrada, args: unknown, exigeIdempotencia: boolean): Promise<Respuesta<unknown> | null> {
  const limites = c.dep.limitesDeDinero;
  if (!limites) return comoBorrador(c, h.nombre, args, 'El dinero del asistente no está habilitado aquí.');
  const finales = completarArgumentos(h.nombre, args, c.entrada.origen, c.entrada.mensaje);
  const huella = c.dep.huella;
  const situacion = {
    exigeIdempotencia,
    repetida: (await huella?.hayIdentica(h.nombre, finales)) ?? false,
    acumuladoDelDia: (await huella?.acumuladoDelDia()) ?? 0,
    propuestaDelSistema: (await huella?.hayPropuestaDelSistema(h.nombre, finales)) ?? false,
  };
  const v = guardasDeDinero(h, finales, limites, c.estado, situacion);
  if (v.tipo === 'rechazo') {
    await dejarHuella(c, h.nombre, finales, { politica: 'directo', resultado: 'rechazada', codigo: 'conflicto', resumenConfirmado: v.mensaje });
    return rechazo('conflicto', v.mensaje);
  }
  return v.tipo === 'borrador' ? comoBorrador(c, h.nombre, args, v.motivo) : null;
}

export async function atenderEscritura(c: ContextoDeLlamada, h: HerramientaRegistrada, args: unknown, politica: Politica): Promise<Respuesta<unknown>> {
  if (politica === 'borrador') return comoBorrador(c, h.nombre, args, null);
  if (politica === 'directo' && h.criticidad === 'lectura') return ejecutarLectura(c, h, args);
  const clave = `${h.nombre}:${hashCanonico(args ?? {})}`;
  const freno = frenoDelTurno(c.estado, clave, politica === 'confirmada');
  if (freno) {
    await dejarHuella(c, h.nombre, args, { politica: 'directo', resultado: 'rechazada', codigo: 'conflicto', resumenConfirmado: freno });
    return rechazo('conflicto', freno);
  }
  // El dinero, y las críticas que lo mueven, pasan ANTES por las guardas: lo que no pasa queda como borrador.
  if (politica === 'dinero' || (politica === 'confirmada' && CRITICAS_DE_DINERO.has(h.nombre))) {
    const desvio = await porLasGuardas(c, h, args, politica === 'dinero');
    if (desvio) return desvio;
  }
  if (politica === 'confirmada') return conConfirmacionPropia(c, h, args);
  return ejecutar(c, h, completarArgumentos(h.nombre, args, c.entrada.origen, c.entrada.mensaje), politica === 'dinero' ? 'dinero' : 'directo');
}

/** Una lectura (o `captura_proponer`, que solo propone): sin frenos ni huella de acción. */
async function ejecutarLectura(c: ContextoDeLlamada, h: HerramientaRegistrada, args: unknown): Promise<Respuesta<unknown>> {
  return ejecutar(c, h, completarArgumentos(h.nombre, args, c.entrada.origen, c.entrada.mensaje), 'directo');
}
