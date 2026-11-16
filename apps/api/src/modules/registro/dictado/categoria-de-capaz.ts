// REGLA NUEVA (no portada de Tairos.RC): lleva las 16 categorías del rubro a las 8 por defecto de Capaz.
// «Cobros» y «Pagos» no se usan aquí: son de los abonos.
import type { Categoria } from './reglas/categorias-de-rubro.js';

const DESTINO: Record<Categoria, string> = {
  materia_prima: 'Compras',
  insumos: 'Compras',
  acabados_terceros: 'Compras',
  maquinaria: 'Compras',
  mano_obra: 'Sueldos',
  servicios: 'Servicios',
  local: 'Servicios',
  transporte: 'Otros egresos',
  impuestos: 'Otros egresos',
  otros_egresos: 'Otros egresos',
  impresion_offset: 'Ventas',
  impresion_digital: 'Ventas',
  gran_formato: 'Ventas',
  acabados: 'Ventas',
  diseno: 'Ventas',
  otros_ingresos: 'Otros ingresos',
};

export function categoriaDeCapaz(rubro: Categoria): string {
  return DESTINO[rubro];
}
