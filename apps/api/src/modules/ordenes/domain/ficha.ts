import { fichaNormalizada, normalizarCampoDeFicha, CAMPOS_DE_FICHA, type CampoDeFicha, type FichaDeMaquina, type FichaParcial, type FotoDeVersionDto } from '@capaz/shared';

// La ficha de máquina en «Corregir pedido» y en las fotos de versión. Sin base ni framework.

/** Al corregir: campo ausente → el de la línea guardada (o null si es nueva); null o vacío → null. */
export function fichaCorregida(nueva: FichaParcial, actual: FichaParcial | undefined): FichaDeMaquina {
  const elegir = (c: CampoDeFicha) => (nueva[c] === undefined ? actual?.[c] : nueva[c]);
  return fichaNormalizada({ material: elegir('material'), medida: elegir('medida'), colores: elegir('colores'), acabado: elegir('acabado') });
}

/** ¿La línea que llega cambia la ficha guardada? Lo ausente no cuenta. */
export const fichaTocada = (actual: FichaParcial, nueva: FichaParcial): boolean =>
  CAMPOS_DE_FICHA.some((c) => nueva[c] !== undefined && normalizarCampoDeFicha(nueva[c]) !== normalizarCampoDeFicha(actual[c]));

/** Las fotos guardadas antes de la 0036 no traen la ficha: se completa con null al leerlas (la foto nunca se reescribe). */
export const fotoConFicha = (foto: FotoDeVersionDto): FotoDeVersionDto => ({ ...foto, lineas: foto.lineas.map((l) => ({ ...l, ...fichaNormalizada(l) })) });
