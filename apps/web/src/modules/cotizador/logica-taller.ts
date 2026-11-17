import type { EntradaDe, FormatoDePliegoDto, ItemDelCuadroDto, MaquinaDelTallerDto, TarifaDelTallerDto } from '@capaz/shared';

// Lógica pura del taller (sin React): formularios, validación y armado de argumentos. Las medidas y los costos son
// TEXTO decimal con punto: aquí no se convierten a número, solo se limpian y se comprueban con expresiones regulares.

export type Factor = TarifaDelTallerDto['factor'];
export type Escala = TarifaDelTallerDto['escalaPorDefecto'];
export type TipoDeFormato = FormatoDePliegoDto['tipo'];

export const FACTORES: ReadonlyArray<{ valor: Factor; etiqueta: string }> = [
  { valor: 'material', etiqueta: 'Material' },
  { valor: 'planchas', etiqueta: 'Planchas' },
  { valor: 'impresion', etiqueta: 'Impresión' },
  { valor: 'diseno', etiqueta: 'Diseño' },
  { valor: 'acabado', etiqueta: 'Acabado' },
  { valor: 'indirectos', etiqueta: 'Otros (indirectos)' },
];
export const ESCALAS: ReadonlyArray<{ valor: Escala; etiqueta: string }> = [
  { valor: 'fija', etiqueta: 'Fija (no cambia con la cantidad)' },
  { valor: 'por_pliego', etiqueta: 'Por pliego' },
  { valor: 'por_unidad', etiqueta: 'Por unidad' },
];
export const TIPOS_DE_FORMATO: ReadonlyArray<{ valor: TipoDeFormato; etiqueta: string }> = [
  { valor: 'madre', etiqueta: 'Pliego madre (el que se compra)' },
  { valor: 'maquina', etiqueta: 'Pliego de máquina (al que se corta)' },
];
export const MAXIMO_DE_ITEMS = 20;
export const AVISO_DE_EJEMPLO = 'Los valores de ejemplo son ilustrativos: cada taller debe poner sus propios costos y medidas.';

const buscarEn = <T extends { valor: string; etiqueta: string }>(lista: ReadonlyArray<T>, valor: string): string => lista.find((x) => x.valor === valor)?.etiqueta ?? valor;
export const etiquetaDeFactor = (v: string): string => buscarEn(FACTORES, v);
export const etiquetaDeEscala = (v: string): string => buscarEn(ESCALAS, v);
export const etiquetaDeTipo = (v: string): string => buscarEn(TIPOS_DE_FORMATO, v);

// --- Decimales como texto ---

/** `'0.4500'` → `'0.45'`, `'70.00'` → `'70'`: solo para mostrar y comparar. */
export const mostrarDecimal = (t: string): string => (t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t);
/** Lo que se tecleó, listo para enviar: sin espacios y con punto en vez de coma. */
export const limpiarEntrada = (t: string): string => t.trim().replace(',', '.');
const esDecimal = (t: string, enteros: number, decimales: number): boolean => new RegExp(`^\\d{1,${enteros}}(\\.\\d{1,${decimales}})?$`).test(t);
const esCero = (t: string): boolean => /^0+(\.0+)?$/.test(t);

export const medidaValida = (t: string, puedeSerCero: boolean): string | undefined => {
  const v = limpiarEntrada(t);
  if (v === '') return 'Falta la medida.';
  if (!esDecimal(v, 5, 2)) return 'Escribe un número con hasta 2 decimales.';
  return !puedeSerCero && esCero(v) ? 'Debe ser mayor que cero.' : undefined;
};
export const costoValido = (t: string): string | undefined => {
  const v = limpiarEntrada(t);
  if (v === '') return 'Falta el costo.';
  return esDecimal(v, 10, 4) ? undefined : 'Escribe un número con hasta 4 decimales.';
};
export const porcentajeValido = (t: string): string | undefined => {
  const v = limpiarEntrada(t);
  if (!esDecimal(v, 4, 3)) return 'Escribe un porcentaje con hasta 3 decimales.';
  return /^(\d+)(\.\d+)?$/.test(v) && Number.parseFloat(v) >= 100 ? 'La merma debe ser menor que 100 %.' : undefined;
};
export const hojasValidas = (t: string): string | undefined => (/^\d{1,6}$/.test(t.trim()) ? undefined : 'Escribe un número entero de hojas.');

/** Los cambios entre lo que había y lo tecleado: solo los campos distintos (una edición no reenvía todo). */
export function soloLoCambiado<T extends Record<string, unknown>>(antes: T, despues: T): Partial<T> {
  const r: Partial<T> = {};
  for (const k of Object.keys(despues) as Array<keyof T>) if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) r[k] = despues[k];
  return r;
}

// --- Tarifas ---

export type FormularioDeTarifa = { factor: Factor; nombre: string; unidad: string; costoUnitario: string; escalaPorDefecto: Escala; formatoId: string };
export const TARIFA_VACIA: FormularioDeTarifa = { factor: 'material', nombre: '', unidad: 'pliego', costoUnitario: '', escalaPorDefecto: 'por_pliego', formatoId: '' };
export type ErroresDeTarifa = Partial<Record<'nombre' | 'unidad' | 'costoUnitario', string>>;

export const formularioDeTarifa = (t: TarifaDelTallerDto): FormularioDeTarifa => ({
  factor: t.factor, nombre: t.nombre, unidad: t.unidad, costoUnitario: mostrarDecimal(t.costoUnitario), escalaPorDefecto: t.escalaPorDefecto, formatoId: t.formatoId ?? '',
});

export function validarTarifa(f: FormularioDeTarifa): ErroresDeTarifa {
  const e: ErroresDeTarifa = {};
  if (f.nombre.trim() === '') e.nombre = 'El nombre es obligatorio.';
  if (f.unidad.trim() === '') e.unidad = 'Indica la unidad.';
  const c = costoValido(f.costoUnitario);
  if (c) e.costoUnitario = c;
  return e;
}

const camposDeTarifa = (f: FormularioDeTarifa) => ({
  factor: f.factor, nombre: f.nombre.trim(), unidad: f.unidad.trim(), costoUnitario: limpiarEntrada(f.costoUnitario), escalaPorDefecto: f.escalaPorDefecto, formatoId: f.formatoId === '' ? null : f.formatoId,
});
export const argumentosDeCreacionDeTarifa = (f: FormularioDeTarifa): EntradaDe<'tarifa_crear'> => camposDeTarifa(f);
/** `null` si no cambió nada. */
export function argumentosDeEdicionDeTarifa(t: TarifaDelTallerDto, f: FormularioDeTarifa): EntradaDe<'tarifa_editar'> | null {
  const antes = camposDeTarifa(formularioDeTarifa(t));
  const cambios = soloLoCambiado(antes, camposDeTarifa(f));
  return Object.keys(cambios).length === 0 ? null : { id: t.id, ...cambios };
}

// --- Formatos de pliego ---

export type FormularioDeFormato = { nombre: string; anchoCm: string; altoCm: string; tipo: TipoDeFormato };
export const FORMATO_VACIO: FormularioDeFormato = { nombre: '', anchoCm: '', altoCm: '', tipo: 'madre' };
export type ErroresDeFormato = Partial<Record<'nombre' | 'anchoCm' | 'altoCm', string>>;

export const formularioDeFormato = (f: FormatoDePliegoDto): FormularioDeFormato => ({ nombre: f.nombre, anchoCm: mostrarDecimal(f.anchoCm), altoCm: mostrarDecimal(f.altoCm), tipo: f.tipo });
export function validarFormato(f: FormularioDeFormato): ErroresDeFormato {
  const e: ErroresDeFormato = {};
  if (f.nombre.trim() === '') e.nombre = 'El nombre es obligatorio.';
  const a = medidaValida(f.anchoCm, false);
  const h = medidaValida(f.altoCm, false);
  if (a) e.anchoCm = a;
  if (h) e.altoCm = h;
  return e;
}
const camposDeFormato = (f: FormularioDeFormato) => ({ nombre: f.nombre.trim(), anchoCm: limpiarEntrada(f.anchoCm), altoCm: limpiarEntrada(f.altoCm), tipo: f.tipo });
export const argumentosDeCreacionDeFormato = (f: FormularioDeFormato): EntradaDe<'formato_pliego_crear'> => camposDeFormato(f);
export function argumentosDeEdicionDeFormato(o: FormatoDePliegoDto, f: FormularioDeFormato): EntradaDe<'formato_pliego_editar'> | null {
  const cambios = soloLoCambiado(camposDeFormato(formularioDeFormato(o)), camposDeFormato(f));
  return Object.keys(cambios).length === 0 ? null : { id: o.id, ...cambios };
}
/** «70 × 100 cm» a partir de las medidas guardadas. */
export const medidasDe = (ancho: string, alto: string): string => `${mostrarDecimal(ancho)} × ${mostrarDecimal(alto)} cm`;

// --- Ítems del cuadro ---

export type FormularioDeItem = { nombre: string; factor: Factor; despuesDe: Factor; fija: boolean };
export const ITEM_VACIO: FormularioDeItem = { nombre: '', factor: 'acabado', despuesDe: 'acabado', fija: false };
export const formularioDeItem = (i: ItemDelCuadroDto): FormularioDeItem => ({ nombre: i.nombre, factor: i.factor, despuesDe: i.despuesDe, fija: i.fija });
export const validarItem = (f: FormularioDeItem): { nombre?: string } => (f.nombre.trim() === '' ? { nombre: 'El nombre es obligatorio.' } : {});
const camposDeItem = (f: FormularioDeItem) => ({ nombre: f.nombre.trim(), factor: f.factor, despuesDe: f.despuesDe, fija: f.fija });
export const argumentosDeCreacionDeItem = (f: FormularioDeItem): EntradaDe<'item_cuadro_crear'> => camposDeItem(f);
export function argumentosDeEdicionDeItem(o: ItemDelCuadroDto, f: FormularioDeItem): EntradaDe<'item_cuadro_editar'> | null {
  const cambios = soloLoCambiado(camposDeItem(formularioDeItem(o)), camposDeItem(f));
  return Object.keys(cambios).length === 0 ? null : { id: o.id, ...cambios };
}
/** El nuevo orden (ids) al mover el ítem `indice` una posición; `null` si ya está en el borde. */
export function ordenAlMover(ids: readonly string[], indice: number, delta: -1 | 1): string[] | null {
  const destino = indice + delta;
  if (indice < 0 || indice >= ids.length || destino < 0 || destino >= ids.length) return null;
  const r = [...ids];
  [r[indice], r[destino]] = [r[destino]!, r[indice]!];
  return r;
}

// --- Máquinas ---

export type EtapaEnFormulario = { nombre: string; mermaPct: string; arranque: string };
export type FormularioDeMaquina = {
  nombre: string; formatoMaxAnchoCm: string; formatoMaxAltoCm: string; pinzaCm: string; sangradoCm: string; calleCm: string; etapas: EtapaEnFormulario[];
};
export const MAQUINA_VACIA: FormularioDeMaquina = { nombre: '', formatoMaxAnchoCm: '', formatoMaxAltoCm: '', pinzaCm: '0', sangradoCm: '0', calleCm: '0', etapas: [] };
export const ETAPA_VACIA: EtapaEnFormulario = { nombre: '', mermaPct: '0', arranque: '0' };
export const MAXIMO_DE_ETAPAS = 10;
export type ErroresDeMaquina = Partial<Record<'nombre' | 'formatoMaxAnchoCm' | 'formatoMaxAltoCm' | 'pinzaCm' | 'sangradoCm' | 'calleCm' | 'etapas', string>>;

export const formularioDeMaquina = (m: MaquinaDelTallerDto): FormularioDeMaquina => ({
  nombre: m.nombre,
  formatoMaxAnchoCm: mostrarDecimal(m.formatoMaxAnchoCm),
  formatoMaxAltoCm: mostrarDecimal(m.formatoMaxAltoCm),
  pinzaCm: mostrarDecimal(m.pinzaCm),
  sangradoCm: mostrarDecimal(m.sangradoCm),
  calleCm: mostrarDecimal(m.calleCm),
  etapas: m.etapas.map((e) => ({ nombre: e.nombre, mermaPct: mostrarDecimal(e.mermaPct), arranque: e.arranque })),
});

export function validarMaquina(f: FormularioDeMaquina): ErroresDeMaquina {
  const e: ErroresDeMaquina = {};
  if (f.nombre.trim() === '') e.nombre = 'El nombre es obligatorio.';
  const pares: Array<[keyof ErroresDeMaquina, string, boolean]> = [
    ['formatoMaxAnchoCm', f.formatoMaxAnchoCm, false], ['formatoMaxAltoCm', f.formatoMaxAltoCm, false],
    ['pinzaCm', f.pinzaCm, true], ['sangradoCm', f.sangradoCm, true], ['calleCm', f.calleCm, true],
  ];
  for (const [clave, valor, cero] of pares) {
    const m = medidaValida(valor, cero);
    if (m) e[clave] = m;
  }
  const mala = f.etapas.find((et) => et.nombre.trim() === '' || porcentajeValido(et.mermaPct) || hojasValidas(et.arranque));
  if (mala) e.etapas = 'Cada etapa necesita nombre, una merma menor que 100 % y las hojas de arranque (entero).';
  return e;
}

const camposDeMaquina = (f: FormularioDeMaquina) => ({
  nombre: f.nombre.trim(),
  formatoMaxAnchoCm: limpiarEntrada(f.formatoMaxAnchoCm),
  formatoMaxAltoCm: limpiarEntrada(f.formatoMaxAltoCm),
  pinzaCm: limpiarEntrada(f.pinzaCm),
  sangradoCm: limpiarEntrada(f.sangradoCm),
  calleCm: limpiarEntrada(f.calleCm),
  etapas: f.etapas.map((e) => ({ nombre: e.nombre.trim(), mermaPct: limpiarEntrada(e.mermaPct), arranque: e.arranque.trim() })),
});
export const argumentosDeCreacionDeMaquina = (f: FormularioDeMaquina): EntradaDe<'maquina_crear'> => camposDeMaquina(f);
export function argumentosDeEdicionDeMaquina(o: MaquinaDelTallerDto, f: FormularioDeMaquina): EntradaDe<'maquina_editar'> | null {
  const cambios = soloLoCambiado(camposDeMaquina(formularioDeMaquina(o)), camposDeMaquina(f));
  return Object.keys(cambios).length === 0 ? null : { id: o.id, ...cambios };
}
/** Resumen de las etapas para la lista: «Tiraje 3 %». */
export const resumenDeEtapas = (m: MaquinaDelTallerDto): string => (m.etapas.length === 0 ? 'Sin etapas' : m.etapas.map((e) => `${e.nombre} ${mostrarDecimal(e.mermaPct)} %`).join(', '));
