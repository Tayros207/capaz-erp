import { ESTADOS_CON_HORA_DE_ASISTENCIA, NOMBRE_DE_ESTADO_DE_ASISTENCIA, type AdelantoDto, type AsistenciaDto, type Centimos, type ColaboradorDto, type EntradaDe, type EstadoDeAsistencia } from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura de las pantallas de personal: formularios, validaciones, argumentos de las herramientas y el parte del día.
// Sin React ni red: se prueba en `logica.spec.ts`.

export const ESTADOS: readonly EstadoDeAsistencia[] = ['presente', 'tardanza', 'falta', 'permiso', 'descanso'];
export const ETIQUETA_DE_ESTADO = NOMBRE_DE_ESTADO_DE_ASISTENCIA;
export const TONO_DE_ESTADO: Readonly<Record<EstadoDeAsistencia, TonoDeInsignia>> = {
  presente: 'exito',
  tardanza: 'aviso',
  falta: 'peligro',
  permiso: 'info',
  descanso: 'neutro',
};

// --- Texto y fechas ---

/** El día `AAAA-MM-DD` en la zona dada (por defecto Lima): `hoy` para las pantallas. */
export function diaEnZona(instante: Date, zona = 'America/Lima'): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${de('year')}-${de('month')}-${de('day')}`;
}

/** `10/03/2026` a partir de `2026-03-10`, sin pasar por `Date` (un día no tiene zona). */
export function formatearDia(dia: string | null): string {
  if (!dia) return '—';
  const [a, m, d] = dia.split('-');
  return a && m && d ? `${d}/${m}/${a}` : dia;
}

const MENSAJES: Record<string, string> = {
  modulo_solo_lectura: 'Tu acceso a Personal es de solo lectura: no puedes registrar ni cambiar datos.',
  modulo_no_disponible: 'Tu empresa no tiene activo este módulo o no te lo asignaron.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  error_de_red: 'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
  error_interno: 'Algo falló de nuestro lado; no se guardó nada. Vuelve a intentarlo.',
};

/** Mensaje para la persona según el código del rechazo; los de negocio (conflicto, datos inválidos) ya vienen redactados. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_permiso' && mensaje.startsWith('Tu acceso')) return mensaje;
  return MENSAJES[codigo] ?? mensaje;
}

// --- Colaborador ---

export type FormularioDeColaborador = {
  nombre: string;
  documentoTipo: string;
  documentoNumero: string;
  telefono: string;
  cargo: string;
  fechaIngreso: string;
};
export type ErroresDeColaborador = Partial<Record<keyof FormularioDeColaborador, string>>;

export const COLABORADOR_VACIO: FormularioDeColaborador = { nombre: '', documentoTipo: '', documentoNumero: '', telefono: '', cargo: '', fechaIngreso: '' };
export const TIPOS_DE_DOCUMENTO: ReadonlyArray<{ valor: string; texto: string }> = [
  { valor: 'dni', texto: 'DNI' },
  { valor: 'ce', texto: 'Carné de extranjería' },
  { valor: 'pasaporte', texto: 'Pasaporte' },
  { valor: 'otro', texto: 'Otro' },
];

export const formularioDeColaborador = (c: ColaboradorDto): FormularioDeColaborador => ({
  nombre: c.nombre,
  documentoTipo: c.documentoTipo ?? '',
  documentoNumero: c.documentoNumero ?? '',
  telefono: c.telefono ?? '',
  cargo: c.cargo ?? '',
  fechaIngreso: c.fechaIngreso ?? '',
});

/** Lo mismo que valida el servidor, para avisar antes de enviar. El servidor sigue siendo quien manda. */
export function validarColaborador(f: FormularioDeColaborador, hoy: string): ErroresDeColaborador {
  const e: ErroresDeColaborador = {};
  if (!f.nombre.trim()) e.nombre = 'Escribe el nombre.';
  const numero = f.documentoNumero.trim();
  if (numero && !f.documentoTipo) e.documentoTipo = 'Elige el tipo de documento.';
  if (f.documentoTipo && !numero) e.documentoNumero = 'Escribe el número de documento.';
  if (f.documentoTipo === 'dni' && numero && !/^\d{8}$/.test(numero)) e.documentoNumero = 'El DNI tiene 8 dígitos.';
  const telefono = f.telefono.trim();
  if (telefono && !/^\+?[\d\s().-]{6,20}$/.test(telefono)) e.telefono = 'El teléfono no es válido.';
  if (f.fechaIngreso && f.fechaIngreso > hoy) e.fechaIngreso = 'El ingreso no puede ser futuro.';
  return e;
}

const opcional = (t: string): string | null => t.trim() || null;

export function argumentosDeCreacion(f: FormularioDeColaborador): EntradaDe<'colaborador_crear'> {
  return {
    nombre: f.nombre.trim(),
    ...(f.documentoTipo && f.documentoNumero.trim() && { documentoTipo: f.documentoTipo as 'dni', documentoNumero: f.documentoNumero.trim() }),
    ...(opcional(f.telefono) && { telefono: f.telefono.trim() }),
    ...(opcional(f.cargo) && { cargo: f.cargo.trim() }),
    ...(f.fechaIngreso && { fechaIngreso: f.fechaIngreso }),
  };
}

/** Solo lo que cambió respecto de la ficha (un dato vaciado va como `null`); `null` si no cambió nada. */
export function argumentosDeEdicion(actual: ColaboradorDto, f: FormularioDeColaborador): EntradaDe<'colaborador_editar'> | null {
  const antes = formularioDeColaborador(actual);
  const cambios: Record<string, string | null> = {};
  if (f.nombre.trim() !== antes.nombre) cambios.nombre = f.nombre.trim();
  for (const campo of ['documentoTipo', 'documentoNumero', 'telefono', 'cargo', 'fechaIngreso'] as const) {
    const nuevo = f[campo].trim();
    if (nuevo !== antes[campo]) cambios[campo] = nuevo || null;
  }
  return Object.keys(cambios).length === 0 ? null : ({ id: actual.id, ...cambios } as EntradaDe<'colaborador_editar'>);
}

/** Subtítulo de una fila de colaborador: el cargo y, si lo hay, el teléfono. */
export const detalleDeColaborador = (c: Pick<ColaboradorDto, 'cargo' | 'telefono'>): string => [c.cargo, c.telefono].filter(Boolean).join(' · ');

// --- Asistencia del día ---

export type FilaDelDia = { colaborador: ColaboradorDto; asistencia: AsistenciaDto | null };
export type ResumenDelDia = { total: number; sinMarcar: number; porEstado: Record<EstadoDeAsistencia, number> };

/** Una fila por colaborador, en el orden dado, con su asistencia del día (o nada si falta marcar). */
export function filasDelDia(colaboradores: readonly ColaboradorDto[], asistencias: readonly AsistenciaDto[]): FilaDelDia[] {
  const porPersona = new Map(asistencias.map((a) => [a.colaboradorId, a]));
  return colaboradores.map((colaborador) => ({ colaborador, asistencia: porPersona.get(colaborador.id) ?? null }));
}

export function resumenDelDia(filas: readonly FilaDelDia[]): ResumenDelDia {
  const porEstado: Record<EstadoDeAsistencia, number> = { presente: 0, tardanza: 0, falta: 0, permiso: 0, descanso: 0 };
  let sinMarcar = 0;
  for (const f of filas) {
    if (f.asistencia) porEstado[f.asistencia.estado] += 1;
    else sinMarcar += 1;
  }
  return { total: filas.length, sinMarcar, porEstado };
}

export function textoDeResumenDelDia(r: ResumenDelDia): string {
  if (r.total === 0) return 'Sin colaboradores activos.';
  const marcados = r.total - r.sinMarcar;
  const falta = r.sinMarcar === 0 ? 'todos marcados' : `faltan ${r.sinMarcar} por marcar`;
  return `${marcados} de ${r.total} · ${falta}`;
}

const conHora = (e: EstadoDeAsistencia): boolean => (ESTADOS_CON_HORA_DE_ASISTENCIA as readonly string[]).includes(e);

/** Qué se le manda al servidor al tocar un estado hoy: presente o tardanza sin entrada aún marcan también la entrada. */
export function argumentosDeEstadoDeHoy(fila: FilaDelDia, estado: EstadoDeAsistencia): EntradaDe<'asistencia_marcar'> {
  const marcaEntrada = conHora(estado) && !fila.asistencia?.entrada;
  return { colaboradorId: fila.colaborador.id, estado, ...(marcaEntrada && { entrada: true }) };
}

/** Se ofrece marcar la salida de hoy cuando ya entró y todavía no salió. */
export const puedeMarcarSalida = (a: AsistenciaDto | null): boolean => !!a && conHora(a.estado) && a.entrada !== null && a.salida === null;

export type ModoDelDia = 'hoy' | 'pasado' | 'futuro';
export const modoDelDia = (fecha: string, hoy: string): ModoDelDia => (fecha === hoy ? 'hoy' : fecha < hoy ? 'pasado' : 'futuro');

/** Un día corrido: `+1` o `-1` sobre `AAAA-MM-DD`, sin zonas (mediodía UTC). */
export function moverDia(dia: string, dias: number): string {
  const f = new Date(`${dia}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

// --- Adelantos ---

export type FormularioDeAdelanto = { colaboradorId: string; monto: Centimos | null; fecha: string; motivo: string };
export type ErroresDeAdelanto = Partial<Record<keyof FormularioDeAdelanto, string>>;

export const adelantoInicial = (hoy: string, colaboradorId = ''): FormularioDeAdelanto => ({ colaboradorId, monto: null, fecha: hoy, motivo: '' });

export function validarAdelanto(f: FormularioDeAdelanto, hoy: string): ErroresDeAdelanto {
  const e: ErroresDeAdelanto = {};
  if (!f.colaboradorId) e.colaboradorId = 'Elige a la persona.';
  if (f.monto === null || f.monto <= 0) e.monto = 'Escribe un monto mayor que cero.';
  if (!f.fecha) e.fecha = 'Indica la fecha.';
  else if (f.fecha > hoy) e.fecha = 'La fecha no puede ser futura.';
  if (f.motivo.length > 300) e.motivo = 'El motivo admite hasta 300 caracteres.';
  return e;
}

/** Solo se llama con el formulario ya validado. */
export function argumentosDeAdelanto(f: FormularioDeAdelanto): EntradaDe<'adelanto_registrar'> {
  return { colaboradorId: f.colaboradorId, montoCentimos: f.monto as number, fecha: f.fecha, ...(f.motivo.trim() && { motivo: f.motivo.trim() }) };
}

/** Suma de lo adelantado sin contar los anulados. */
export const totalVigente = (adelantos: readonly Pick<AdelantoDto, 'estado' | 'montoCentimos'>[]): number =>
  adelantos.reduce((suma, a) => (a.estado === 'registrado' ? suma + a.montoCentimos : suma), 0);

export const TONO_DE_ADELANTO: Readonly<Record<AdelantoDto['estado'], TonoDeInsignia>> = { registrado: 'exito', anulado: 'neutro' };
export const ETIQUETA_DE_ADELANTO: Readonly<Record<AdelantoDto['estado'], string>> = { registrado: 'Vigente', anulado: 'Anulado' };
