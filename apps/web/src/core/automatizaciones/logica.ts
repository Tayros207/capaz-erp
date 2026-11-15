import {
  CONTRATOS,
  EVENTOS,
  OPERADORES_DE_CONDICION,
  RUTA_DE_DATO,
  type Accion,
  type Condicion,
  type Disparador,
  type EjecucionDeRegla,
  type ModoDeRegla,
  type OperadorDeCondicion,
  type Regla,
} from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// ---- Textos ----

export const ETIQUETA_DE_MODO: Record<ModoDeRegla, string> = { borrador: 'Borrador', pide_aprobacion: 'Pide aprobación', automatico: 'Automático' };
export const AYUDA_DE_MODO: Record<ModoDeRegla, string> = {
  borrador: 'La regla deja sus acciones como borradores en la bandeja; nada se ejecuta solo.',
  pide_aprobacion: 'La regla prepara las acciones y una persona las aprueba en la bandeja antes de ejecutarlas.',
  automatico: 'La regla ejecuta las acciones sin pedir permiso. Una regla que mueve dinero (cobros, pagos, descuentos) o hace algo crítico no puede ir en automático: el sistema la rechazará al guardar.',
};
export const ETIQUETA_DE_TIPO_DE_DISPARADOR = { evento: 'Cuando ocurre un evento', tiempo: 'Por tiempo', webhook: 'Cuando llega un webhook', manual: 'Manual (yo la ejecuto)' } as const;
export const ETIQUETA_DE_OPERADOR: Record<OperadorDeCondicion, string> = {
  igual: 'es igual a',
  distinto: 'es distinto de',
  mayor: 'es mayor que',
  menor: 'es menor que',
  contiene: 'contiene',
  existe: 'existe',
};
export const ETIQUETA_DE_RESULTADO = {
  ok: 'Hecha',
  rechazada: 'Rechazada',
  omitida_por_limite: 'Omitida por límite',
  borrador_creado: 'Borrador creado',
  sin_coincidencia: 'Sin coincidencia',
} as const;
export const TONO_DE_RESULTADO: Record<EjecucionDeRegla['resultado'], TonoDeInsignia> = {
  ok: 'exito',
  rechazada: 'peligro',
  omitida_por_limite: 'aviso',
  borrador_creado: 'info',
  sin_coincidencia: 'neutro',
};

export function resumenDeDisparador(d: Disparador): string {
  switch (d.tipo) {
    case 'evento': return `Evento ${d.evento}`;
    case 'webhook': return `Webhook ${d.evento}`;
    case 'manual': return 'Manual';
    case 'tiempo': return d.dias === 0 ? `El mismo día de ${d.fuente}` : d.dias > 0 ? `${d.dias} días después de ${d.fuente}` : `${-d.dias} días antes de ${d.fuente}`;
  }
}

export function resumenDeCondicion(c: Condicion): string {
  return c.op === 'existe' ? `${c.campo} ${c.valor === false ? 'no existe' : 'existe'}` : `${c.campo} ${ETIQUETA_DE_OPERADOR[c.op]} ${String(c.valor)}`;
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

// ---- Catálogos para el formulario ----

/** Una regla no puede manejar la bandeja ni a otras reglas (el servidor lo vuelve a comprobar). */
const PREFIJOS_PROHIBIDOS = ['borrador_', 'borradores_', 'regla_', 'reglas_'];

/** Herramientas que puede usar como acción: las registradas, menos las que gobiernan la bandeja y las reglas. */
export function herramientasParaAcciones(nombres: readonly string[] = Object.keys(CONTRATOS)): string[] {
  return nombres.filter((n) => !PREFIJOS_PROHIBIDOS.some((p) => n.startsWith(p))).sort();
}
export const eventosConocidos = (): string[] => Object.keys(EVENTOS).sort();

export function titularDeHerramienta(nombre: string): string {
  const partes = nombre.split('_');
  const accion = partes.at(-1) ?? nombre;
  const resto = partes.slice(0, -1).join(' ');
  return resto ? `${accion.charAt(0).toUpperCase()}${accion.slice(1)} · ${resto}` : nombre;
}

// ---- Argumentos con tipo ----

export type TipoDeValor = 'texto' | 'numero' | 'booleano' | 'json';
export type FilaDeArgumento = { nombre: string; valor: string; tipo: TipoDeValor };
export const ETIQUETA_DE_TIPO: Record<TipoDeValor, string> = { texto: 'Texto', numero: 'Número', booleano: 'Sí / No', json: 'Estructura' };

export function tipoDeValor(v: unknown): TipoDeValor {
  return typeof v === 'number' ? 'numero' : typeof v === 'boolean' ? 'booleano' : typeof v === 'string' || v === null || v === undefined ? 'texto' : 'json';
}

export function filasDeArgumentos(args: Record<string, unknown>): FilaDeArgumento[] {
  return Object.entries(args).map(([nombre, v]) => ({
    nombre,
    tipo: tipoDeValor(v),
    valor: v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v),
  }));
}

function valorDeFila(f: FilaDeArgumento): { ok: true; valor: unknown } | { ok: false; error: string } {
  const t = f.valor.trim();
  switch (f.tipo) {
    case 'texto': return { ok: true, valor: f.valor };
    case 'numero': return t !== '' && Number.isFinite(Number(t.replace(',', '.'))) ? { ok: true, valor: Number(t.replace(',', '.')) } : { ok: false, error: `«${f.nombre}» debe ser un número.` };
    case 'booleano': return /^(sí|si|true)$/i.test(t) ? { ok: true, valor: true } : /^(no|false)$/i.test(t) ? { ok: true, valor: false } : { ok: false, error: `«${f.nombre}»: escribe Sí o No.` };
    case 'json':
      try { return { ok: true, valor: JSON.parse(t) as unknown }; } catch { return { ok: false, error: `«${f.nombre}» no tiene un formato válido.` }; }
  }
}

export function objetoDeArgumentos(filas: readonly FilaDeArgumento[]): { ok: true; datos: Record<string, unknown> } | { ok: false; error: string } {
  const datos: Record<string, unknown> = {};
  for (const f of filas) {
    const nombre = f.nombre.trim();
    if (!nombre) continue;
    if (nombre in datos) return { ok: false, error: `El campo «${nombre}» está repetido.` };
    const v = valorDeFila({ ...f, nombre });
    if (!v.ok) return v;
    datos[nombre] = v.valor;
  }
  return { ok: true, datos };
}

// ---- Formulario de la regla ----

export type FilaDeCondicion = { campo: string; op: OperadorDeCondicion; valor: string };
export type FilaDeAccion = { herramienta: string; args: FilaDeArgumento[] };
export type TipoDeDisparador = Disparador['tipo'];

export type FormularioDeRegla = {
  nombre: string;
  descripcion: string;
  tipo: TipoDeDisparador;
  evento: string;
  fuente: string;
  dias: string;
  condiciones: FilaDeCondicion[];
  acciones: FilaDeAccion[];
  modo: ModoDeRegla;
  limiteDiario: string;
};

export const FORMULARIO_VACIO: FormularioDeRegla = {
  nombre: '',
  descripcion: '',
  tipo: 'evento',
  evento: '',
  fuente: '',
  dias: '0',
  condiciones: [],
  acciones: [{ herramienta: '', args: [] }],
  modo: 'borrador',
  limiteDiario: '50',
};

export function formularioDeRegla(r: Regla): FormularioDeRegla {
  const d = r.disparador;
  return {
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    tipo: d.tipo,
    evento: d.tipo === 'evento' || d.tipo === 'webhook' ? d.evento : '',
    fuente: d.tipo === 'tiempo' ? d.fuente : '',
    dias: d.tipo === 'tiempo' ? String(d.dias) : '0',
    condiciones: r.condiciones.map((c) => ({ campo: c.campo, op: c.op, valor: c.valor === undefined ? (c.op === 'existe' ? 'si' : '') : c.op === 'existe' ? (c.valor === false ? 'no' : 'si') : String(c.valor) })),
    acciones: r.acciones.map((a) => ({ herramienta: a.herramienta, args: filasDeArgumentos(a.args) })),
    modo: r.modo,
    limiteDiario: String(r.limiteDiario),
  };
}

export type ErroresDeRegla = { general?: string; nombre?: string; disparador?: string; limite?: string; condiciones?: string; acciones?: string };

function disparadorDeFormulario(f: FormularioDeRegla): { ok: true; d: Disparador } | { ok: false; error: string } {
  if (f.tipo === 'manual') return { ok: true, d: { tipo: 'manual' } };
  if (f.tipo === 'evento' || f.tipo === 'webhook') {
    const evento = f.evento.trim();
    return evento ? { ok: true, d: { tipo: f.tipo, evento } } : { ok: false, error: f.tipo === 'evento' ? 'Elige el evento que dispara la regla.' : 'Escribe el nombre del webhook que dispara la regla.' };
  }
  const fuente = f.fuente.trim();
  const dias = Number(f.dias);
  if (!fuente) return { ok: false, error: 'Escribe la fuente de tiempo (por ejemplo core.prueba_de_modulo_vence).' };
  if (!Number.isInteger(dias) || dias < -365 || dias > 365) return { ok: false, error: 'Los días deben ser un número entero entre -365 y 365.' };
  return { ok: true, d: { tipo: 'tiempo', fuente, dias } };
}

function condicionDeFila(c: FilaDeCondicion): Condicion | string {
  const campo = c.campo.trim();
  if (!RUTA_DE_DATO.test(campo)) return `«${campo || 'vacío'}» no es una ruta válida (ejemplo: datos.total).`;
  if (c.op === 'existe') return { campo, op: 'existe', valor: c.valor !== 'no' };
  if (c.valor.trim() === '') return `Falta el valor de la condición sobre «${campo}».`;
  if (c.op === 'mayor' || c.op === 'menor') {
    const n = Number(c.valor.replace(',', '.'));
    return Number.isFinite(n) ? { campo, op: c.op, valor: n } : `«${campo}»: para comparar mayor o menor escribe un número.`;
  }
  const t = c.valor.trim();
  return { campo, op: c.op, valor: c.op === 'contiene' ? c.valor : t === 'true' ? true : t === 'false' ? false : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : c.valor };
}

/** Valida el formulario y arma los argumentos de `regla_guardar`; si hay errores los devuelve por campo. */
export function argumentosDeGuardado(f: FormularioDeRegla, id?: string): { ok: true; args: Record<string, unknown> } | { ok: false; errores: ErroresDeRegla } {
  const errores: ErroresDeRegla = {};
  if (!f.nombre.trim()) errores.nombre = 'Ponle un nombre a la regla.';
  const d = disparadorDeFormulario(f);
  if (!d.ok) errores.disparador = d.error;
  const limite = Number(f.limiteDiario);
  if (!Number.isInteger(limite) || limite < 1 || limite > 10000) errores.limite = 'El límite diario es un número entre 1 y 10 000.';

  const condiciones: Condicion[] = [];
  for (const c of f.condiciones) {
    const r = condicionDeFila(c);
    if (typeof r === 'string') {
      errores.condiciones = r;
      break;
    }
    condiciones.push(r);
  }
  const acciones: Accion[] = [];
  if (f.acciones.length === 0) errores.acciones = 'La regla necesita al menos una acción.';
  for (const a of f.acciones) {
    if (!a.herramienta) {
      errores.acciones = 'Elige la herramienta de cada acción.';
      break;
    }
    const args = objetoDeArgumentos(a.args);
    if (!args.ok) {
      errores.acciones = args.error;
      break;
    }
    acciones.push({ herramienta: a.herramienta, args: args.datos });
  }
  if (Object.keys(errores).length > 0 || !d.ok) return { ok: false, errores };
  return {
    ok: true,
    args: {
      ...(id ? { id } : {}),
      nombre: f.nombre.trim(),
      ...(f.descripcion.trim() ? { descripcion: f.descripcion.trim() } : {}),
      disparador: d.d,
      condiciones,
      acciones,
      modo: f.modo,
      limiteDiario: limite,
    },
  };
}

export const OPERADORES = OPERADORES_DE_CONDICION;

/** Ayuda al guardar: mensaje claro si el servidor rechazó por dinero/crítica en automático. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  return codigo === 'sin_permiso' ? 'No tienes permiso para gestionar automatizaciones.' : mensaje;
}

/** Texto corto de lo que hizo una ejecución, a partir de su `detalle` (que puede traer un resumen). */
export function detalleLegible(detalle: unknown): string {
  if (detalle === null || detalle === undefined) return '—';
  if (typeof detalle === 'string') return detalle;
  if (typeof detalle === 'object' && 'resumen' in detalle && typeof (detalle as { resumen: unknown }).resumen === 'string') return (detalle as { resumen: string }).resumen;
  try {
    return JSON.stringify(detalle);
  } catch {
    return '—';
  }
}
