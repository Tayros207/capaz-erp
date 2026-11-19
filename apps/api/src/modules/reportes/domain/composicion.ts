import type { BloqueDelPanelDto, IndicadorDto, SerieDelPanelDto, TipoDeIndicador } from '@capaz/shared';

// Composición pura del panel: convierte la salida de un `<codigo>_resumen` (cualquiera, sin conocer su
// módulo) en indicadores y series, y el panel en filas planas. No toca la base ni otros módulos.

/** Nombre visible por módulo; uno desconocido usa su código con inicial mayúscula. */
const NOMBRES: Readonly<Record<string, string>> = {
  registro: 'Registro',
  ordenes: 'Pedidos',
  crm: 'CRM',
  compras: 'Compras',
  insumos: 'Inventario',
  personal: 'Personal',
};
/** Orden de aparición en el panel; los demás van después, por código. */
const ORDEN = ['registro', 'ordenes', 'crm', 'compras', 'insumos', 'personal'];

export const nombreDeModulo = (codigo: string): string => NOMBRES[codigo] ?? codigo.charAt(0).toUpperCase() + codigo.slice(1);

export function ordenarModulos<T extends { modulo: string }>(bloques: readonly T[]): T[] {
  const posicion = (c: string) => (ORDEN.includes(c) ? ORDEN.indexOf(c) : ORDEN.length);
  return [...bloques].sort((a, b) => posicion(a.modulo) - posicion(b.modulo) || a.modulo.localeCompare(b.modulo));
}

/** `totalConfirmadoCentimos` → «Total confirmado»; `en_proceso` → «En proceso». */
export function legible(clave: string): string {
  const palabras = clave
    .replace(/Centimos$/, '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const tipoDe = (clave: string): TipoDeIndicador => (clave.endsWith('Centimos') ? 'dinero' : 'cantidad');
const CLAVES_RESERVADAS = new Set(['desde', 'hasta', 'serie']);

/**
 * El texto que nombra a un elemento de una lista: todos sus textos que no sean identificadores, unidos («Sin categoría ·
 * ingreso»). Con solo el primero, dos filas que difieren en otro texto (la misma categoría como ingreso y como egreso)
 * quedaban con el mismo nombre y el mismo identificador.
 */
const rotuloDe = (fila: Record<string, unknown>): string | null => {
  const textos = Object.entries(fila).flatMap(([k, v]) => (typeof v === 'string' && !/Id$/.test(k) && k !== 'id' && v !== '' ? [v] : []));
  return textos.length > 0 ? textos.join(' · ') : null;
};

function deNumeros(prefijo: string, titulo: string, o: Record<string, unknown>, sal: IndicadorDto[]): void {
  for (const [clave, v] of Object.entries(o)) {
    if (typeof v !== 'number' || !Number.isSafeInteger(v)) continue;
    const etiqueta = titulo ? `${titulo} · ${legible(clave).toLowerCase()}` : legible(clave);
    sal.push({ id: `${prefijo}${clave}`, etiqueta, tipo: tipoDe(clave), valor: v });
  }
}

function recorrer(prefijo: string, titulo: string, o: Record<string, unknown>, sal: IndicadorDto[]): void {
  deNumeros(prefijo, titulo, o, sal);
  for (const [clave, v] of Object.entries(o)) {
    if (CLAVES_RESERVADAS.has(clave) && prefijo === '') continue;
    if (esObjeto(v)) recorrer(`${prefijo}${clave}.`, legible(clave), v, sal);
    else if (Array.isArray(v)) {
      v.forEach((fila, i) => {
        if (!esObjeto(fila)) return;
        const rotulo = legible(rotuloDe(fila) ?? String(i + 1));
        const cuantos = Object.values(fila).filter((x) => typeof x === 'number').length;
        const base = `${prefijo}${clave}.${rotuloDe(fila) ?? i}.`;
        const antes = sal.length;
        deNumeros(base, `${legible(clave)} · ${rotulo}`, fila, sal);
        // Con una sola cifra por elemento («cantidad») el nombre del campo sobra.
        if (cuantos === 1 && sal.length - antes === 1) sal[antes]!.etiqueta = `${legible(clave)} · ${rotulo}`;
      });
    }
  }
}

/** Las cifras de la salida de un resumen. Dos con la misma etiqueta (cantidad y monto) se distinguen. */
export function indicadoresDe(datos: unknown): IndicadorDto[] {
  if (!esObjeto(datos)) return [];
  const sal: IndicadorDto[] = [];
  recorrer('', '', datos, sal);
  const repetidas = new Map<string, number>();
  for (const i of sal) repetidas.set(i.etiqueta, (repetidas.get(i.etiqueta) ?? 0) + 1);
  return sal.map((i) => ((repetidas.get(i.etiqueta) ?? 0) > 1 && i.tipo === 'dinero' ? { ...i, etiqueta: `${i.etiqueta} (monto)` } : i));
}

/** Series que el resumen entregó en su campo opcional `serie` (`[{ fecha, valor }]`); sin él, ninguna. */
export function seriesDe(datos: unknown): SerieDelPanelDto[] {
  if (!esObjeto(datos) || !Array.isArray(datos.serie)) return [];
  const puntos = datos.serie.flatMap((p) =>
    esObjeto(p) && typeof p.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) && typeof p.valor === 'number' && Number.isSafeInteger(p.valor)
      ? [{ fecha: p.fecha, valor: p.valor }]
      : [],
  );
  return puntos.length > 0 ? [{ id: 'serie', etiqueta: 'Por día', tipo: 'cantidad', puntos }] : [];
}

export function bloqueDe(modulo: string, datos: unknown, soloLectura: boolean): BloqueDelPanelDto {
  return { modulo, nombre: nombreDeModulo(modulo), soloLectura, indicadores: indicadoresDe(datos), series: seriesDe(datos) };
}

/** Céntimos como texto decimal sin símbolo: `123450` → `1234.50`. */
export function centimosATexto(c: number): string {
  const signo = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export const ENCABEZADO_CSV = ['Módulo', 'Indicador', 'Valor', 'Unidad'] as const;

/** Un indicador por fila: módulo, indicador, valor y unidad (`soles` o `cantidad`). */
export function filasPlanas(bloques: readonly BloqueDelPanelDto[]): string[][] {
  const filas: string[][] = [[...ENCABEZADO_CSV]];
  for (const b of bloques) {
    for (const i of b.indicadores) {
      filas.push([b.nombre, i.etiqueta, i.tipo === 'dinero' ? centimosATexto(i.valor) : String(i.valor), i.tipo === 'dinero' ? 'soles' : 'cantidad']);
    }
  }
  return filas;
}

export const nombreDeArchivo = (desde: string, hasta: string): string => `indicadores-${desde}_${hasta}.csv`;
