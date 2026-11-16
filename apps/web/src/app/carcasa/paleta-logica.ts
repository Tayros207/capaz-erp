/** Quita tildes y mayúsculas para comparar textos al buscar. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export type AccionRapida = { nombre: string; ruta: string; icono: string };

// Destinos verificados en las rutas de cada módulo (`modules/*/rutas.tsx`). Solo se ofrecen si la persona
// tiene acceso al módulo (su ruta base aparece en el menú), así la paleta nunca lleva a una pantalla vedada.
const POR_MODULO: Array<{ base: string; acciones: AccionRapida[] }> = [
  {
    base: '/m/ordenes',
    acciones: [
      { nombre: 'Nuevo pedido', ruta: '/m/ordenes/nuevo', icono: 'ventas' },
      { nombre: 'Tablero de pedidos', ruta: '/m/ordenes/tablero', icono: 'ventas' },
      { nombre: 'Entregas', ruta: '/m/ordenes/entregas', icono: 'ventas' },
    ],
  },
  {
    base: '/m/registro',
    acciones: [
      { nombre: 'Por cobrar', ruta: '/m/registro/por-cobrar', icono: 'finanzas' },
      { nombre: 'Por pagar', ruta: '/m/registro/por-pagar', icono: 'finanzas' },
      { nombre: 'Caja del día', ruta: '/m/registro/caja', icono: 'finanzas' },
      { nombre: 'Movimientos', ruta: '/m/registro/movimientos', icono: 'finanzas' },
    ],
  },
];

export function accionesRapidas(rutasDelMenu: readonly string[]): AccionRapida[] {
  return POR_MODULO.filter((m) => rutasDelMenu.some((r) => r === m.base || r.startsWith(`${m.base}/`))).flatMap((m) => m.acciones);
}
