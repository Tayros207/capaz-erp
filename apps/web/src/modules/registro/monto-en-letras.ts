// Monto en letras para soles y céntimos. Lógica pura, sin React ni red.

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTES = ['VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** 0 a 99. */
function decenas(n: number): string {
  if (n < 20) return UNIDADES[n] ?? '';
  if (n < 30) return VEINTES[n - 20] ?? '';
  const u = n % 10;
  return u === 0 ? (DECENAS[n / 10] ?? '') : `${DECENAS[Math.floor(n / 10)]} Y ${UNIDADES[u]}`;
}

/** 0 a 999. */
function centenas(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return [CENTENAS[c], resto > 0 ? decenas(resto) : ''].filter(Boolean).join(' ');
}

/** Entero 0 a 999 999 999 en letras mayúsculas («UNO» para 1; «UN» solo antes de mil o millón). */
export function enteroEnLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new RangeError('Monto fuera de rango');
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? 'UN MILLON' : `${apocopado(centenas(millones))} MILLONES`);
  if (miles > 0) partes.push(miles === 1 ? 'MIL' : `${apocopado(centenas(miles))} MIL`);
  if (resto > 0) partes.push(centenas(resto));
  return partes.join(' ');
}

/** «UNO» → «UN» y «VEINTIUNO» → «VEINTIUN» cuando el número va antes de mil o millones. */
function apocopado(texto: string): string {
  return texto.replace(/VEINTIUNO$/, 'VEINTIUN').replace(/UNO$/, 'UN');
}

/** `15000` céntimos → «CIENTO CINCUENTA Y 00/100 SOLES». Un sol exacto: «UNO Y 00/100 SOL». */
export function montoEnLetras(centimos: number): string {
  if (!Number.isInteger(centimos) || centimos < 0) throw new RangeError('El monto debe ser un entero de céntimos no negativo');
  const soles = Math.floor(centimos / 100);
  const cents = String(centimos % 100).padStart(2, '0');
  return `${enteroEnLetras(soles)} Y ${cents}/100 ${soles === 1 ? 'SOL' : 'SOLES'}`;
}
