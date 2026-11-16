import type { ConfiguracionDeCosteo, EntradaDeCosteo, Linea, Utilidad } from '../tipos/cotizacion.js'
import type { Cuadro } from '../tipos/borrador.js'
import type { CuadroEscalable, PapelEImposicion } from '../tipos/escalado.js'
import type { Dimensiones, EntradaDeImposicion, Imposicion } from '../tipos/imposicion.js'

// Caso de referencia del PRP-001: 2.500 volantes A5 (14.8 × 21 cm), 4/4, couché 150 g,
// con tarifas ilustrativas. Solo lo usan las pruebas; recalculado con un script
// independiente el 2026-09-19.

/**
 * Las 172 del papel son los pliegos madre que calcula la imposición
 * (`imposicionDelCasoDeReferencia`); `imposicion.test.ts` comprueba que coinciden.
 */
export const lineasDelCasoDeReferencia: Linea[] = [
  {
    id: 'l1',
    factor: 'material',
    descripcion: 'Papel couché 150 g, pliego madre 70 × 100',
    cantidad: '172',
    unidad: 'pliego',
    costoUnitario: '0.45',
    escala: 'por_pliego',
  },
  {
    id: 'l2',
    factor: 'planchas',
    descripcion: 'Planchas (4 tintas × 2 caras)',
    cantidad: '8',
    unidad: 'plancha',
    costoUnitario: '5.00',
    escala: 'fija',
  },
  {
    id: 'l3',
    factor: 'impresion',
    descripcion: 'Tiraje offset',
    cantidad: '0.8',
    unidad: 'hora',
    costoUnitario: '30.00',
    escala: 'por_pliego',
  },
  {
    id: 'l4',
    factor: 'diseno',
    descripcion: 'Diseño del volante',
    cantidad: '1',
    unidad: 'servicio',
    costoUnitario: '40.00',
    escala: 'fija',
  },
  {
    id: 'l5',
    factor: 'acabado',
    descripcion: 'Barniz de máquina',
    cantidad: '1',
    unidad: 'servicio',
    costoUnitario: '28.00',
    escala: 'por_pliego',
  },
  {
    id: 'l6',
    factor: 'acabado',
    descripcion: 'Corte y empaque',
    cantidad: '1',
    unidad: 'servicio',
    costoUnitario: '15.75',
    escala: 'por_pliego',
  },
]

export const cantidadDelCasoDeReferencia = '2500'

/** Volante A5. */
export const piezaDelCasoDeReferencia: Dimensiones = { anchoCm: '14.8', altoCm: '21' }

/** Madre 70 × 100 y máquina 35 × 50; sangrado y calle de 0.3, pinza de 2, y 3 % + 40 hojas de tiraje. */
export const imposicionDelCasoDeReferencia: Imposicion = {
  pliegoMadre: { anchoCm: '70', altoCm: '100' },
  pliegoMaquina: { anchoCm: '35', altoCm: '50' },
  sangradoCm: '0.3',
  calleCm: '0.3',
  pinzaCm: '2',
  etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }],
}

export const entradaDeImposicionDelCasoDeReferencia: EntradaDeImposicion = {
  pieza: piezaDelCasoDeReferencia,
  cantidad: cantidadDelCasoDeReferencia,
  imposicion: imposicionDelCasoDeReferencia,
}

/** El papel (fila `l1`) lo llena el motor: sus 172 pliegos madre salen de la imposición. */
export const papelDelCasoDeReferencia: PapelEImposicion = {
  pieza: piezaDelCasoDeReferencia,
  imposicion: imposicionDelCasoDeReferencia,
  lineaDePapelId: 'l1',
}

/** El caso de referencia como cuadro completo, listo para correrlo a otra cantidad. */
export const cuadroDelCasoDeReferencia: CuadroEscalable = {
  lineas: lineasDelCasoDeReferencia,
  cantidad: cantidadDelCasoDeReferencia,
  papel: papelDelCasoDeReferencia,
}

/** Umbrales por defecto: verde desde 30 %, rojo bajo 15 % (DS-02). */
export const umbralesPorDefecto: ConfiguracionDeCosteo = {
  umbralVerdePct: '30',
  umbralMinimoPct: '15',
}

export function entradaDelCasoDeReferencia(
  utilidad: Utilidad,
  precioFinal?: string,
): EntradaDeCosteo {
  return {
    lineas: lineasDelCasoDeReferencia,
    cantidad: cantidadDelCasoDeReferencia,
    utilidad,
    ...(precioFinal === undefined ? {} : { precioFinal }),
  }
}

/**
 * El caso de referencia como cuadro de una cotización: el papel (`l1`) y las planchas (`l2`) las
 * mantiene el motor; el resto son filas escritas. Con 35 % sobre la venta da 225.15 y 346.38.
 */
export const cuadroDeCotizacionDelCasoDeReferencia: Cuadro = {
  trabajo: {
    producto: 'Volantes A5',
    cantidad: cantidadDelCasoDeReferencia,
    pieza: piezaDelCasoDeReferencia,
    tintas: 4,
    caras: 2,
    cliente: 'Cliente de prueba',
  },
  imposicion: {
    pliegoMadre: imposicionDelCasoDeReferencia.pliegoMadre,
    pliegoMaquina: imposicionDelCasoDeReferencia.pliegoMaquina,
    sangradoCm: imposicionDelCasoDeReferencia.sangradoCm,
    calleCm: imposicionDelCasoDeReferencia.calleCm,
    pinzaCm: imposicionDelCasoDeReferencia.pinzaCm,
    formatoMaximo: null,
    etapas: imposicionDelCasoDeReferencia.etapas,
  },
  lineas: lineasDelCasoDeReferencia,
  utilidad: { pct: '35', base: 'venta' },
  precioFinal: null,
  automaticas: { papel: 'l1', planchas: 'l2' },
  siguienteLinea: 7,
}
