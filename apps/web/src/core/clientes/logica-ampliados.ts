/** El plazo es un entero de 0 a 365; devuelve el mensaje de error o `undefined`. */
export const errorDePlazo = (t: string): string | undefined => {
  if (!/^\d+$/.test(t.trim())) return 'Escribe los días como número entero.';
  return Number(t) > 365 ? 'El plazo máximo es de 365 días.' : undefined;
};
