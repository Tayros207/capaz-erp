// Azar determinista y generadores de datos peruanos ficticios para el sembrador de demostración.

export type Azar = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(xs: readonly T[]) => T;
  chance: (p: number) => boolean;
  mezclar: <T>(xs: readonly T[]) => T[];
};

/** mulberry32: misma semilla, mismos datos en cada corrida (la siembra es repetible). */
export function crearAzar(semilla: number): Azar {
  let a = semilla >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min;
  return {
    next,
    int,
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p) => next() < p,
    mezclar: <T>(xs: readonly T[]): T[] => {
      const r = [...xs];
      for (let i = r.length - 1; i > 0; i--) {
        const j = int(0, i);
        [r[i], r[j]] = [r[j]!, r[i]!];
      }
      return r;
    },
  };
}

/** `AAAA-MM-DD` de hoy menos `n` días (UTC; las fechas de la demostración son siempre pasadas). */
export function diasAtras(n: number, hoy: Date = new Date()): string {
  return new Date(hoy.getTime() - n * 86_400_000).toISOString().slice(0, 10);
}

export const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);

/** Dígito verificador del RUC (módulo 11), para que el número ficticio tenga formato válido. */
function digitoRuc(base10: string): number {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(base10[i]), 0);
  const r = 11 - (suma % 11);
  return r === 10 ? 0 : r === 11 ? 1 : r;
}

const digitos = (az: Azar, n: number): string => Array.from({ length: n }, () => az.int(0, 9)).join('');

export function rucFicticio(az: Azar, persona = false): string {
  const base = persona ? `10${az.int(1, 9)}${digitos(az, 7)}` : `20${az.int(1, 9)}${digitos(az, 7)}`;
  return `${base}${digitoRuc(base)}`;
}
export const dniFicticio = (az: Azar): string => `${az.int(1, 9)}${digitos(az, 7)}`;
export const telefonoFicticio = (az: Azar): string => `9${digitos(az, 8)}`;

export const NOMBRES = ['Luis', 'Carlos', 'José', 'Miguel', 'Jorge', 'Víctor', 'Raúl', 'Andrés', 'Marco', 'Diego', 'Hugo', 'César', 'Pedro', 'Walter', 'Iván', 'María', 'Rosa', 'Carmen', 'Lucía', 'Ana', 'Patricia', 'Gladys', 'Sofía', 'Elena', 'Flor', 'Milagros', 'Karen', 'Silvia', 'Nelly', 'Yesenia', 'Rocío', 'Daniela'] as const;
export const APELLIDOS = ['Quispe', 'Huamán', 'Flores', 'Rojas', 'Mendoza', 'Torres', 'Vargas', 'Castillo', 'Chávez', 'Ramos', 'Condori', 'Salazar', 'Paredes', 'Cárdenas', 'Rivera', 'Gutiérrez', 'Delgado', 'Soto', 'Valdivia', 'Ccori', 'Ponce', 'Zevallos', 'Ayala', 'Navarro', 'Campos', 'Bravo', 'Luna', 'Cáceres', 'Palomino', 'Yupanqui'] as const;
export const SUFIJOS_EMPRESA = ['S.A.C.', 'E.I.R.L.', 'S.R.L.', 'S.A.'] as const;

export function nombreDePersona(az: Azar): string {
  return `${az.pick(NOMBRES)} ${az.pick(APELLIDOS)} ${az.pick(APELLIDOS)}`;
}

/** Formato `S/ 1234.50` sin separador de miles: lo usa el CSV de importación (el precio va en soles). */
export const soles = (centimos: number): string => (centimos / 100).toFixed(2);
