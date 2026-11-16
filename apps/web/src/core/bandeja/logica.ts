import type { Borrador, Centimos } from '@capaz/shared';
import { centimosATexto, formatearSoles, textoACentimos } from '../../shared/formato/soles.ts';
import { milesimasATexto, textoAMilesimas } from '../../shared/formato/milesimas.ts';

// Lógica pura de la bandeja de borradores: textos legibles, edición de argumentos y atajos de teclado.

export type EstadoDeBorrador = Borrador['estado'];
export type OrigenDeBorrador = Borrador['origen'];

export const ETIQUETA_DE_ESTADO: Record<EstadoDeBorrador, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  descartado: 'Descartado',
};

export const ETIQUETA_DE_ORIGEN: Record<OrigenDeBorrador, string> = {
  voz: 'Voz',
  texto: 'Texto',
  agente: 'Agente',
  regla: 'Regla',
  conector: 'Conector',
  importacion: 'Importación',
  modulo: 'Otro módulo',
};

const VERBOS: Record<string, string> = {
  crear: 'Crear',
  editar: 'Editar',
  archivar: 'Archivar',
  restaurar: 'Restaurar',
  anular: 'Anular',
  registrar: 'Registrar',
  asignar: 'Asignar',
  importar: 'Importar',
  eliminar: 'Eliminar',
};

function capitalizar(texto: string): string {
  return texto ? texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1) : texto;
}

/** `clientes_crear` pasa a «Crear · clientes». Sin guion bajo, se deja el nombre capitalizado. */
export function titularDeHerramienta(herramienta: string): string {
  const corte = herramienta.lastIndexOf('_');
  if (corte < 1) return capitalizar(herramienta.replaceAll('_', ' '));
  const entidad = herramienta.slice(0, corte).replaceAll('_', ' ');
  const accion = herramienta.slice(corte + 1);
  return `${VERBOS[accion] ?? capitalizar(accion)} · ${entidad}`;
}

/** `nombreComercial` y `nombre_comercial` pasan a «Nombre comercial». */
export function etiquetaDeCampo(clave: string): string {
  const separado = clave
    .replaceAll('_', ' ')
    .replace(/([a-záéíóúñ])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase('es')
    .trim();
  return capitalizar(separado);
}

/** Un argumento cuyo nombre termina en `Centimos` es dinero; en `Milesimas`, una cantidad o precio con tres decimales. */
export type MedidaDeArgumento = 'centimos' | 'milesimas' | null;

export function medidaDeArgumento(clave: string): MedidaDeArgumento {
  if (clave.endsWith('Centimos')) return 'centimos';
  if (clave.endsWith('Milesimas')) return 'milesimas';
  return null;
}

/** «totalCentimos» pasa a «Total»: la medida va en el valor («S/ 1,500.00»), no en el nombre. */
export function etiquetaDeArgumento(clave: string): string {
  const base = clave.replace(/(Centimos|Milesimas)$/, '');
  return etiquetaDeCampo(base === '' ? clave : base);
}

const milesimasConTresDecimales = (n: number) => `${n < 0 ? '-' : ''}${milesimasATexto(Math.abs(n)).replace(/^([\d,]+\.\d{2})$/, (m) => `${m}0`)}`;

/** Valor de un argumento para leerlo: dinero en soles, milésimas con tres decimales, el resto como `valorLegible`. */
export function valorDeArgumento(clave: string, valor: unknown): string {
  const medida = medidaDeArgumento(clave);
  if (typeof valor === 'number' && Number.isSafeInteger(valor)) {
    if (medida === 'centimos') return formatearSoles(valor as Centimos);
    if (medida === 'milesimas') return milesimasConTresDecimales(valor);
  }
  return valorLegible(valor);
}

export type TipoDeCampo = 'texto' | 'numero' | 'booleano' | 'json';

export function tipoDeCampo(valor: unknown): TipoDeCampo {
  if (typeof valor === 'number') return 'numero';
  if (typeof valor === 'boolean') return 'booleano';
  if (valor !== null && typeof valor === 'object') return 'json';
  return 'texto';
}

/** Texto de un valor para mostrarlo en lectura. */
export function valorLegible(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'bigint') return String(valor);
  if (Array.isArray(valor)) return valor.length === 0 ? '—' : valor.map(valorLegible).join(', ');
  return JSON.stringify(valor);
}

export function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

export type FilaDeArgumento = { clave: string; etiqueta: string; valor: string };

/** Lo que propone el borrador, campo por campo y en español. Vacío si los argumentos no son un objeto. */
export function filasDeArgumentos(args: unknown): FilaDeArgumento[] {
  if (!esObjetoPlano(args)) return [];
  return Object.entries(args).map(([clave, valor]) => ({ clave, etiqueta: etiquetaDeArgumento(clave), valor: valorDeArgumento(clave, valor) }));
}

/** Claves cuyo valor cambió respecto de lo que propuso el origen (para marcar lo corregido). */
export function clavesCorregidas(args: unknown, originales: unknown): Set<string> {
  const a = esObjetoPlano(args) ? args : {};
  const o = esObjetoPlano(originales) ? originales : {};
  const claves = new Set([...Object.keys(a), ...Object.keys(o)]);
  return new Set([...claves].filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(o[k] ?? null)));
}

/** Valores iniciales del formulario de corrección: todo como texto editable. */
export function formularioDeCorreccion(args: unknown): Record<string, string> {
  if (!esObjetoPlano(args)) return {};
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => {
      if (v === null || v === undefined) return [k, ''];
      if (typeof v === 'object') return [k, JSON.stringify(v, null, 2)];
      if (typeof v === 'number' && Number.isSafeInteger(v)) {
        const medida = medidaDeArgumento(k);
        if (medida === 'centimos') return [k, centimosATexto(v as Centimos)];
        if (medida === 'milesimas') return [k, milesimasConTresDecimales(v)];
      }
      return [k, String(v)];
    }),
  );
}

export type ResultadoDeCorreccion =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; errores: Record<string, string> };

/** Devuelve el texto editado a su tipo original. Un campo vacío que antes tenía valor pasa a `null`. */
export function argumentosCorregidos(original: unknown, editado: Record<string, string>): ResultadoDeCorreccion {
  const base = esObjetoPlano(original) ? original : {};
  const args: Record<string, unknown> = {};
  const errores: Record<string, string> = {};
  for (const [clave, crudo] of Object.entries(editado)) {
    const previo = base[clave];
    const texto = crudo.trim();
    const tipo = tipoDeCampo(previo);
    if (texto === '') {
      if (previo !== undefined && previo !== null && previo !== '') args[clave] = tipo === 'texto' ? '' : null;
      else if (previo !== undefined) args[clave] = previo;
      continue;
    }
    const medida = medidaDeArgumento(clave);
    if (tipo === 'numero' && medida === 'centimos') {
      const c = textoACentimos(texto);
      if (c === null) errores[clave] = 'Escribe un monto en soles, con hasta dos decimales.';
      else args[clave] = c;
    } else if (tipo === 'numero' && medida === 'milesimas') {
      const m = textoAMilesimas(texto);
      if (m === null) errores[clave] = 'Escribe un número con hasta tres decimales.';
      else args[clave] = m;
    } else if (tipo === 'numero') {
      const n = Number(texto.replace(',', '.'));
      if (!Number.isFinite(n)) errores[clave] = 'Escribe un número.';
      else args[clave] = n;
    } else if (tipo === 'booleano') {
      const t = texto.toLocaleLowerCase('es');
      if (['sí', 'si', 'true'].includes(t)) args[clave] = true;
      else if (['no', 'false'].includes(t)) args[clave] = false;
      else errores[clave] = 'Escribe Sí o No.';
    } else if (tipo === 'json') {
      try {
        args[clave] = JSON.parse(texto) as unknown;
      } catch {
        errores[clave] = 'El formato no es válido.';
      }
    } else {
      args[clave] = crudo;
    }
  }
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, args };
}

export function hayCambios(original: unknown, editado: Record<string, string>): boolean {
  const r = argumentosCorregidos(original, editado);
  if (!r.ok) return true;
  return JSON.stringify(r.args) !== JSON.stringify(esObjetoPlano(original) ? original : {});
}

export function validarMotivo(motivo: string): string | undefined {
  const t = motivo.trim();
  if (!t) return 'Indica por qué se descarta.';
  if (t.length > 500) return 'El motivo no puede pasar de 500 caracteres.';
  return undefined;
}

export type AccionDeAtajo = 'aprobar' | 'corregir';

/** Atajo de teclado en escritorio: A aprueba y C corrige; se ignora al escribir o con modificadores. */
export function accionDeAtajo(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; escribiendo: boolean }): AccionDeAtajo | null {
  if (e.escribiendo || e.ctrlKey || e.altKey || e.metaKey) return null;
  const tecla = e.key.toLocaleLowerCase('es');
  if (tecla === 'a') return 'aprobar';
  if (tecla === 'c') return 'corregir';
  return null;
}

/** Mensaje claro cuando aprobar falla. */
export function mensajeDeRechazoAlAprobar(codigo: string, mensaje: string): string {
  switch (codigo) {
    case 'sin_permiso':
      return 'No tienes permiso para la operación que propone este borrador. Sigue pendiente.';
    case 'confirmacion_solo_ui':
      return 'Esta aprobación solo puede hacerse desde la pantalla, con la confirmación de una persona.';
    case 'confirmacion_vencida':
    case 'confirmacion_ya_usada':
    case 'confirmacion_desactualizada':
    case 'confirmacion_no_coincide':
    case 'confirmacion_invalida':
      return 'No se pudo confirmar la operación crítica. Vuelve a intentarlo; el borrador sigue pendiente.';
    case 'validacion':
      return mensaje ? `Faltan datos o hay datos inválidos: ${mensaje} Corrige el borrador y vuelve a aprobar.` : 'Faltan datos o hay datos inválidos. Corrige el borrador y vuelve a aprobar.';
    case 'sin_conexion':
      return 'No hay conexión con el servidor. Inténtalo de nuevo.';
    default:
      return mensaje || 'No se pudo aprobar el borrador.';
  }
}

export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_conexion') return 'No hay conexión con el servidor. Inténtalo de nuevo.';
  if (codigo === 'sin_permiso') return 'No tienes permiso para hacer esto.';
  return mensaje;
}

export const FILTROS_DE_ESTADO: ReadonlyArray<{ valor: EstadoDeBorrador | 'todos'; texto: string }> = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aprobado', texto: 'Aprobados' },
  { valor: 'descartado', texto: 'Descartados' },
  { valor: 'todos', texto: 'Todos' },
];
