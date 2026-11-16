import type { Centimos, ModuloDeEmpresaDto } from '@capaz/shared';
import type { TonoDeInsignia } from '../shared/ui/insignia.tsx';
import { ZONA_POR_DEFECTO } from '../shared/formato/fechas.ts';

type Estado = ModuloDeEmpresaDto['estado'];

const ESTADOS: Record<Estado, { texto: string; tono: TonoDeInsignia }> = {
  prueba: { texto: 'En prueba', tono: 'info' },
  activo: { texto: 'Activo', tono: 'exito' },
  suspendido: { texto: 'Suspendido', tono: 'aviso' },
  baja: { texto: 'De baja', tono: 'peligro' },
};

export function estadoDeModulo(estado: Estado): { texto: string; tono: TonoDeInsignia } {
  return ESTADOS[estado];
}

export type AccionDeModulo = 'suspender' | 'dar_de_baja' | 'reactivar';

/** Qué se puede hacer con un módulo según su estado. */
export function accionesPosibles(estado: Estado): AccionDeModulo[] {
  if (estado === 'prueba' || estado === 'activo') return ['suspender', 'dar_de_baja'];
  if (estado === 'suspendido') return ['reactivar', 'dar_de_baja'];
  return ['reactivar'];
}

export const ETIQUETA_DE_ACCION: Record<AccionDeModulo, string> = { suspender: 'Suspender', dar_de_baja: 'Dar de baja', reactivar: 'Reactivar' };

/** «Nombre (estado)» por módulo, para la lista de empresas. */
export function resumenDeModulos(modulos: ReadonlyArray<{ modulo: string; estado: Estado }>): string {
  if (modulos.length === 0) return 'Sin módulos';
  return modulos.map((m) => `${m.modulo} (${ESTADOS[m.estado].texto.toLowerCase()})`).join(', ');
}

/** `2026-12-31` → fin de ese día en Lima, como texto ISO con desfase (el contrato lo exige). */
export function diaAIso(dia: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const iso = `${dia}T23:59:59-05:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** ISO → `2026-12-31` en la zona de Lima (para el campo de fecha). */
export function isoADia(iso: string | null, zona = ZONA_POR_DEFECTO): string {
  if (!iso) return '';
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(f).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function validarCorreo(texto: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto.trim()) ? undefined : 'El correo no es válido.';
}

export function validarEmpresa(nombre: string, correo: string): { nombre?: string; correo?: string } {
  const e: { nombre?: string; correo?: string } = {};
  if (nombre.trim().length < 2) e.nombre = 'El nombre de la empresa es muy corto.';
  const c = validarCorreo(correo);
  if (c) e.correo = c;
  return e;
}

export type FormularioDeContrato = { plan: string; precio: Centimos | null; vigenteHasta: string; maxUsuarios: string };

export function formularioDeContrato(m: ModuloDeEmpresaDto): FormularioDeContrato {
  return {
    plan: m.plan ?? '',
    precio: m.precioAcordadoCentimos,
    vigenteHasta: isoADia(m.vigenteHasta),
    maxUsuarios: m.maxUsuarios === null ? '' : String(m.maxUsuarios),
  };
}

export type ArgumentosDeContrato = {
  plan?: string | null;
  precioAcordadoCentimos?: Centimos | null;
  vigenteHasta?: string | null;
  maxUsuarios?: number | null;
};

/** Solo lo que cambió (lo que no se manda no cambia; `null` borra). Nulo si nada cambió o hay un dato inválido. */
export function argumentosDeContrato(nuevo: FormularioDeContrato, original: FormularioDeContrato): ArgumentosDeContrato | { error: string } | null {
  const args: ArgumentosDeContrato = {};
  if (nuevo.plan.trim() !== original.plan.trim()) args.plan = nuevo.plan.trim() || null;
  if (nuevo.precio !== original.precio) args.precioAcordadoCentimos = nuevo.precio;
  if (nuevo.vigenteHasta !== original.vigenteHasta) {
    if (nuevo.vigenteHasta === '') args.vigenteHasta = null;
    else {
      const iso = diaAIso(nuevo.vigenteHasta);
      if (!iso) return { error: 'La fecha de vigencia no es válida.' };
      args.vigenteHasta = iso;
    }
  }
  if (nuevo.maxUsuarios.trim() !== original.maxUsuarios.trim()) {
    if (nuevo.maxUsuarios.trim() === '') args.maxUsuarios = null;
    else {
      const n = Number(nuevo.maxUsuarios);
      if (!Number.isInteger(n) || n < 1) return { error: 'El máximo de usuarios es un entero desde 1.' };
      args.maxUsuarios = n;
    }
  }
  return Object.keys(args).length === 0 ? null : args;
}

/** Días de prueba: vacío = activo sin prueba; si no, entero de 1 a 365. */
export function parsearDiasDePrueba(texto: string): { dias?: number } | { error: string } {
  if (texto.trim() === '') return {};
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 1 || n > 365) return { error: 'Los días de prueba van de 1 a 365.' };
  return { dias: n };
}

export type FormularioDePlan = { codigo: string; nombre: string; descripcion: string; precio: Centimos | null; usuarios: string; activo: boolean; modulos: string };

export const PLAN_VACIO: FormularioDePlan = { codigo: '', nombre: '', descripcion: '', precio: null, usuarios: '', activo: true, modulos: '' };

export function validarPlan(f: FormularioDePlan, esNuevo: boolean): Partial<Record<'codigo' | 'nombre' | 'precio' | 'usuarios', string>> {
  const e: Partial<Record<'codigo' | 'nombre' | 'precio' | 'usuarios', string>> = {};
  if (esNuevo && !/^[a-z][a-z0-9_]{1,40}$/.test(f.codigo.trim())) e.codigo = 'El código usa minúsculas, números y guion bajo.';
  if (f.nombre.trim() === '') e.nombre = 'El nombre es obligatorio.';
  if (f.precio === null) e.precio = 'Indica el precio.';
  if (f.usuarios.trim() !== '' && !(Number.isInteger(Number(f.usuarios)) && Number(f.usuarios) >= 1)) e.usuarios = 'Un entero desde 1, o vacío.';
  return e;
}

/** `a, b,  c` → `['a','b','c']` sin repetidos ni vacíos. */
export function listaDeCodigos(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
}

export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_permiso') return 'No tienes acceso a la consola.';
  if (codigo === 'sin_conexion') return mensaje;
  return mensaje || 'No se pudo completar la operación.';
}

// ───────────────────────── Nombres y códigos de módulo ─────────────────────────

/** Nombre legible por código técnico. Salen de los manifiestos del servidor; si aparece un módulo nuevo, se muestra su código capitalizado. */
export const NOMBRES_DE_MODULO: Readonly<Record<string, string>> = {
  registro: 'Registro',
  crm: 'CRM',
  ordenes: 'Pedidos',
  insumos: 'Inventario',
  compras: 'Compras',
  personal: 'Personal',
  reportes: 'Reportes',
  webhooks: 'Webhooks y claves',
  cotizador: 'Cotizador',
};

export function nombreDeModulo(codigo: string): string {
  return NOMBRES_DE_MODULO[codigo] ?? (codigo ? codigo[0]!.toUpperCase() + codigo.slice(1) : codigo);
}

// ───────────────────────── Resumen de la cartera de empresas ─────────────────────────

type ModuloResumido = { modulo: string; estado: Estado; pruebaHasta: string | null; vigenteHasta: string | null };
export type EmpresaResumen = { id: string; nombre: string; altaEn: string; miembros: number; modulos: ReadonlyArray<ModuloResumido> };

/** Estado de la empresa deducido de sus módulos (la cuenta como tal aún no tiene estado propio; ver FICHA-ESTADO-DE-CUENTA.md). */
export type EstadoDeEmpresa = 'sin_modulos' | 'activa' | 'prueba' | 'suspendida' | 'baja';

export function estadoDeEmpresa(e: Pick<EmpresaResumen, 'modulos'>): EstadoDeEmpresa {
  if (e.modulos.length === 0) return 'sin_modulos';
  if (e.modulos.every((m) => m.estado === 'baja')) return 'baja';
  if (e.modulos.some((m) => m.estado === 'suspendido')) return 'suspendida';
  if (e.modulos.some((m) => m.estado === 'activo')) return 'activa';
  return 'prueba';
}

export const ESTADO_DE_EMPRESA: Record<EstadoDeEmpresa, { texto: string; tono: TonoDeInsignia }> = {
  sin_modulos: { texto: 'Sin módulos', tono: 'neutro' },
  activa: { texto: 'Activa', tono: 'exito' },
  prueba: { texto: 'En prueba', tono: 'info' },
  suspendida: { texto: 'Con suspensión', tono: 'aviso' },
  baja: { texto: 'De baja', tono: 'peligro' },
};

const DIA_MS = 86_400_000;

/** Días enteros que faltan (hacia arriba) hasta una fecha ISO; negativo si ya pasó; nulo si no es fecha. */
export function diasHasta(iso: string | null, ahora: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - ahora.getTime()) / DIA_MS);
}

export type Vencimiento = { modulo: string; dias: number; tipo: 'prueba' | 'vigencia' };

/** El vencimiento más cercano entre sus módulos con prueba o vigencia (los dados de baja no cuentan). */
export function proximoVencimiento(e: Pick<EmpresaResumen, 'modulos'>, ahora: Date): Vencimiento | null {
  let mejor: Vencimiento | null = null;
  for (const m of e.modulos) {
    if (m.estado === 'baja') continue;
    const candidatos: Vencimiento[] = [];
    const p = m.estado === 'prueba' ? diasHasta(m.pruebaHasta, ahora) : null;
    if (p !== null) candidatos.push({ modulo: m.modulo, dias: p, tipo: 'prueba' });
    const v = diasHasta(m.vigenteHasta, ahora);
    if (v !== null) candidatos.push({ modulo: m.modulo, dias: v, tipo: 'vigencia' });
    for (const c of candidatos) if (!mejor || c.dias < mejor.dias) mejor = c;
  }
  return mejor;
}

/** «Vence hoy», «Vence en 3 días», «Venció hace 2 días». */
export function textoDeVencimiento(dias: number): string {
  if (dias === 0) return 'Vence hoy';
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
}

export type Kpis = { total: number; activas: number; enPrueba: number; conProblema: number; vencenPronto: number; solicitudes: number; miembros: number };

/** Cifras de la cabecera. `conProblema` = suspendidas o de baja. `vencenPronto` = empresas con algo que vence en `ventanaDias` o ya vencido. */
export function kpisDeEmpresas(empresas: readonly EmpresaResumen[], ahora: Date, solicitudes: number, ventanaDias = 7): Kpis {
  const k: Kpis = { total: empresas.length, activas: 0, enPrueba: 0, conProblema: 0, vencenPronto: 0, solicitudes, miembros: 0 };
  for (const e of empresas) {
    const s = estadoDeEmpresa(e);
    if (s === 'activa') k.activas++;
    else if (s === 'prueba') k.enPrueba++;
    else if (s === 'suspendida' || s === 'baja') k.conProblema++;
    k.miembros += e.miembros;
    const v = proximoVencimiento(e, ahora);
    if (v && v.dias <= ventanaDias) k.vencenPronto++;
  }
  return k;
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export type FiltroDeEmpresas = { texto: string; estado: EstadoDeEmpresa | 'todas'; modulo: string | 'todos' };
export const FILTRO_VACIO: FiltroDeEmpresas = { texto: '', estado: 'todas', modulo: 'todos' };

/** Busca por nombre, id, código o nombre de módulo; filtra por estado de la empresa y por módulo contratado (no dado de baja). */
export function filtrarEmpresas<T extends EmpresaResumen>(empresas: readonly T[], f: FiltroDeEmpresas): T[] {
  const q = sinTildes(f.texto.trim());
  return empresas.filter((e) => {
    if (f.estado !== 'todas' && estadoDeEmpresa(e) !== f.estado) return false;
    if (f.modulo !== 'todos' && !e.modulos.some((m) => m.modulo === f.modulo && m.estado !== 'baja')) return false;
    if (!q) return true;
    const pajar = sinTildes([e.nombre, e.id, ...e.modulos.flatMap((m) => [m.modulo, nombreDeModulo(m.modulo)])].join(' '));
    return pajar.includes(q);
  });
}

/** Códigos de módulo presentes en la cartera, ordenados (para el filtro). */
export function modulosPresentes(empresas: readonly EmpresaResumen[]): string[] {
  return [...new Set(empresas.flatMap((e) => e.modulos.map((m) => m.modulo)))].sort();
}

export function inicialesDeEmpresa(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  return ((p[0]![0] ?? '') + (p.length > 1 ? (p[1]![0] ?? '') : '')).toUpperCase();
}
