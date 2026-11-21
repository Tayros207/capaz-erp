import { claveDeEncabezado } from '../../../core/intercambio/columnas.js';

// Columnas del CSV del historial: encabezado del archivo → campo. Las claves ya van en forma comparable
// (`claveDeEncabezado`: sin tildes, minúsculas, solo letras y cifras; «total_contratado» = `totalcontratado`).

export type CampoDeHistorial = 'fecha' | 'cliente' | 'descripcion' | 'total' | 'clienteOriginal' | 'cobrado' | 'rubro' | 'fuente';

const MAPA: Record<CampoDeHistorial, readonly string[]> = {
  fecha: ['fecha'],
  cliente: ['cliente', 'gruposugerido'],
  descripcion: ['descripcion', 'trabajo', 'detalle'],
  total: ['total', 'totalcontratado'],
  clienteOriginal: ['clienteoriginal'],
  cobrado: ['cobrado', 'cobradoalregistrar'],
  rubro: ['rubro', 'rubrosugerido'],
  fuente: ['fuente'],
};

const OBLIGATORIAS: readonly CampoDeHistorial[] = ['fecha', 'cliente', 'descripcion', 'total'];

export type ColumnasDeHistorial = { indices: Partial<Record<CampoDeHistorial, number>>; ignoradas: string[] } | { error: string };

/** Relaciona el encabezado con los campos. Falta una obligatoria o se repite un campo: error de archivo. */
export function mapearColumnasDeHistorial(encabezado: readonly string[]): ColumnasDeHistorial {
  const indices: Partial<Record<CampoDeHistorial, number>> = {};
  const ignoradas: string[] = [];
  for (const [i, bruto] of encabezado.entries()) {
    const clave = claveDeEncabezado(bruto);
    const campo = (Object.keys(MAPA) as CampoDeHistorial[]).find((c) => MAPA[c].includes(clave));
    if (!campo) {
      if (bruto.trim()) ignoradas.push(bruto.trim());
    } else if (campo in indices) {
      return { error: `La columna «${bruto.trim()}» repite el campo «${campo}».` };
    } else indices[campo] = i;
  }
  const falta = OBLIGATORIAS.find((c) => !(c in indices));
  if (falta) return { error: `Falta la columna «${falta}» en el encabezado.` };
  return { indices, ignoradas };
}
