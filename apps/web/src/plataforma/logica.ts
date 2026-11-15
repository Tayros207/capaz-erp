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
