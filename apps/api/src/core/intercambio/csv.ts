// Lector y escritor de CSV propios (RFC 4180), sin dependencias. Solo CSV: Excel queda fuera (D10).

export type Separador = ',' | ';';

export type FilaCsv = { /** Número de fila en la hoja (la 1 es el encabezado), contando las vacías. */ numero: number; celdas: string[] };

export type LecturaCsv = { ok: true; separador: Separador; filas: FilaCsv[] } | { ok: false; motivo: string };

export type OpcionesDeLectura = { separador?: Separador | 'auto'; maxFilas: number };

const BOM = '﻿';

/** Coma o punto y coma: el que más aparece fuera de comillas en la primera línea (empate: coma). */
export function detectarSeparador(texto: string): Separador {
  let comas = 0;
  let puntos = 0;
  let entre = false;
  for (const c of texto) {
    if (c === '"') entre = !entre;
    else if (!entre && (c === '\n' || c === '\r')) break;
    else if (!entre && c === ',') comas++;
    else if (!entre && c === ';') puntos++;
  }
  return puntos > comas ? ';' : ',';
}

/**
 * Lee un CSV completo. Admite comillas dobles (`""` es una comilla), separadores y saltos de línea dentro de
 * un campo entre comillas, finales de línea `\n`, `\r\n` y `\r`, y BOM al inicio. Las filas totalmente
 * vacías se omiten (conservan su número). Más de `maxFilas` filas de datos (sin el encabezado) es un rechazo.
 */
export function leerCsv(entrada: string, opciones: OpcionesDeLectura): LecturaCsv {
  const texto = entrada.startsWith(BOM) ? entrada.slice(1) : entrada;
  const separador = opciones.separador && opciones.separador !== 'auto' ? opciones.separador : detectarSeparador(texto);
  const filas: FilaCsv[] = [];
  let celdas: string[] = [];
  let campo = '';
  let entreComillas = false;
  let campoConComillas = false;
  let numero = 1;
  let inicioDeFila = 1;

  const cerrarCampo = () => {
    celdas.push(campo);
    campo = '';
    campoConComillas = false;
  };
  const cerrarFila = (): string | null => {
    const conComillas = campoConComillas;
    cerrarCampo();
    const vacia = celdas.length === 1 && celdas[0] === '' && !conComillas;
    if (!vacia) filas.push({ numero: inicioDeFila, celdas });
    celdas = [];
    if (filas.length > opciones.maxFilas + 1) return `El archivo tiene más de ${opciones.maxFilas} filas de datos.`;
    return null;
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else {
        if (c === '\n') numero++;
        campo += c;
      }
      continue;
    }
    if (c === '"') {
      if (campo !== '') return { ok: false, motivo: `Fila ${numero}: comilla inesperada en medio de un campo.` };
      entreComillas = true;
      campoConComillas = true;
    } else if (c === separador) {
      cerrarCampo();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      const exceso = cerrarFila();
      if (exceso) return { ok: false, motivo: exceso };
      numero++;
      inicioDeFila = numero;
    } else {
      if (campoConComillas) return { ok: false, motivo: `Fila ${numero}: hay texto después de cerrar las comillas.` };
      campo += c;
    }
  }
  if (entreComillas) return { ok: false, motivo: `Fila ${inicioDeFila}: las comillas no se cerraron.` };
  const final = cerrarFila();
  if (final) return { ok: false, motivo: final };
  return { ok: true, separador, filas };
}

/** Una celda que empieza por `= + - @` (o tabulador / retorno) se leería como fórmula en una hoja de cálculo: se prefija con `'`. */
export function protegerCelda(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function escribirCelda(valor: string, separador: Separador): string {
  const v = protegerCelda(valor);
  return v.includes('"') || v.includes(separador) || v.includes('\n') || v.includes('\r') ? `"${v.replaceAll('"', '""')}"` : v;
}

/** Escribe el CSV con finales `\r\n`, protección contra fórmulas y, si se pide, BOM para que Excel respete las tildes. */
export function escribirCsv(filas: readonly (readonly string[])[], opciones: { separador: Separador; bom?: boolean }): string {
  const cuerpo = filas.map((f) => f.map((c) => escribirCelda(c, opciones.separador)).join(opciones.separador)).join('\r\n');
  return (opciones.bom ? BOM : '') + cuerpo + (filas.length > 0 ? '\r\n' : '');
}
