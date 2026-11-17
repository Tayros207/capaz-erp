/** Unidades de medida más usadas, agrupadas. El valor guardado es el símbolo (texto libre en la base). */
export const GRUPOS_DE_UNIDADES: { grupo: string; unidades: { valor: string; nombre: string }[] }[] = [
  { grupo: 'Cantidad', unidades: [
    { valor: 'UND', nombre: 'Unidad' }, { valor: 'par', nombre: 'Par' }, { valor: 'docena', nombre: 'Docena' },
    { valor: 'ciento', nombre: 'Ciento' }, { valor: 'millar', nombre: 'Millar' }, { valor: 'paquete', nombre: 'Paquete' },
    { valor: 'caja', nombre: 'Caja' }, { valor: 'resma', nombre: 'Resma' }, { valor: 'rollo', nombre: 'Rollo' }, { valor: 'pliego', nombre: 'Pliego' },
  ] },
  { grupo: 'Longitud', unidades: [
    { valor: 'mm', nombre: 'Milímetro' }, { valor: 'cm', nombre: 'Centímetro' }, { valor: 'm', nombre: 'Metro' }, { valor: 'km', nombre: 'Kilómetro' }, { valor: 'pulg', nombre: 'Pulgada' },
  ] },
  { grupo: 'Área', unidades: [{ valor: 'cm²', nombre: 'Centímetro cuadrado' }, { valor: 'm²', nombre: 'Metro cuadrado' }] },
  { grupo: 'Peso', unidades: [{ valor: 'g', nombre: 'Gramo' }, { valor: 'kg', nombre: 'Kilogramo' }] },
  { grupo: 'Volumen', unidades: [{ valor: 'ml', nombre: 'Mililitro' }, { valor: 'l', nombre: 'Litro' }, { valor: 'gal', nombre: 'Galón' }] },
];

export const esUnidadConocida = (valor: string): boolean => GRUPOS_DE_UNIDADES.some((g) => g.unidades.some((u) => u.valor === valor));
