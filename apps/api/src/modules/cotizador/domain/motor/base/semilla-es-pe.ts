import type {
  ConfiguracionEmpresa,
  FormatoPliego,
  InsumoTarifa,
  ItemDeEmpresa,
  Maquina,
  SemillaDeEmpresa,
} from './empresa.js'

// Valores iniciales de una empresa nueva en Perú (ADR-15). Único lugar donde pueden vivir la
// moneda, el idioma y las tarifas de un país: todo lo demás las lee de la configuración de la
// empresa. Las tarifas son ILUSTRATIVAS (D3): cada empresa carga las suyas y las edita.

export const configuracionEsPE: ConfiguracionEmpresa = {
  pais: 'PE',
  moneda: 'PEN',
  locale: 'es-PE',
  impuestoNombre: 'IGV',
  impuestoPct: '18',
  utilidadPct: '35',
  utilidadBase: 'venta',
  umbralVerdePct: '30',
  umbralMinimoPct: '15',
  unidades: ['pliego', 'plancha', 'hora', 'servicio', 'unidad', 'millar'],
  redondeoComercial: 'ninguno',
  condiciones: { validezDias: 15, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' },
  mensajeWhatsapp: 'Hola, aquí tienes tu cotización: {enlace}',
  mostrarFirma: true,
}

export const insumosEsPE: InsumoTarifa[] = [
  { id: 'papel-couche-150', factor: 'material', nombre: 'Papel couché 150 g, pliego madre 70 × 100', unidad: 'pliego', costoUnitario: '0.45', escalaPorDefecto: 'por_pliego', activo: true },
  { id: 'papel-couche-300', factor: 'material', nombre: 'Papel couché 300 g, pliego madre 70 × 100', unidad: 'pliego', costoUnitario: '0.90', escalaPorDefecto: 'por_pliego', activo: true },
  { id: 'papel-bond-80', factor: 'material', nombre: 'Papel bond 80 g, pliego madre 70 × 100 (descontinuado)', unidad: 'pliego', costoUnitario: '0.30', escalaPorDefecto: 'por_pliego', activo: false },
  { id: 'plancha-ctp', factor: 'planchas', nombre: 'Plancha CTP', unidad: 'plancha', costoUnitario: '5.00', escalaPorDefecto: 'fija', activo: true },
  { id: 'tiraje-offset', factor: 'impresion', nombre: 'Tiraje offset', unidad: 'hora', costoUnitario: '30.00', escalaPorDefecto: 'por_pliego', activo: true },
  { id: 'diseno-grafico', factor: 'diseno', nombre: 'Diseño gráfico de volante', unidad: 'servicio', costoUnitario: '40.00', escalaPorDefecto: 'fija', activo: true },
  { id: 'barniz-maquina', factor: 'acabado', nombre: 'Barniz de máquina', unidad: 'servicio', costoUnitario: '28.00', escalaPorDefecto: 'por_pliego', activo: true },
  { id: 'corte-empaque', factor: 'acabado', nombre: 'Corte y empaque', unidad: 'servicio', costoUnitario: '15.75', escalaPorDefecto: 'por_pliego', activo: true },
]

// Pliegos que se compran (madre) y tamaños a los que se cortan para la máquina.
export const formatosEsPE: FormatoPliego[] = [
  { id: 'madre-70x100', nombre: '70 × 100 cm', anchoCm: '70', altoCm: '100', tipo: 'madre', activo: true },
  { id: 'madre-50x70', nombre: '50 × 70 cm', anchoCm: '50', altoCm: '70', tipo: 'madre', activo: true },
  { id: 'maquina-35x50', nombre: '35 × 50 cm', anchoCm: '35', altoCm: '50', tipo: 'maquina', activo: true },
  { id: 'maquina-25x35', nombre: '25 × 35 cm', anchoCm: '25', altoCm: '35', tipo: 'maquina', activo: true },
]

export const maquinasEsPE: Maquina[] = [
  {
    id: 'offset-36x52',
    nombre: 'Offset 36 × 52',
    formatoMaximo: { anchoCm: '36', altoCm: '52' },
    pinzaCm: '2',
    sangradoCm: '0.3',
    calleCm: '0.3',
    etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }],
    activo: true,
  },
]

// Los ítems con los que nace el cuadro de costos de una empresa (PRP-007): dos acabados que casi todo
// taller cobra aparte. Cada empresa agrega, quita y reordena los suyos.
export const itemsEsPE: ItemDeEmpresa[] = [
  { id: 'item-plastificado', nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', fija: false, activo: true },
  { id: 'item-encolado', nombre: 'Encolado', factor: 'acabado', despuesDe: 'acabado', fija: false, activo: true },
]

export const semillaEsPE: SemillaDeEmpresa = {
  configuracion: configuracionEsPE,
  insumos: insumosEsPE,
  formatos: formatosEsPE,
  maquinas: maquinasEsPE,
  items: itemsEsPE,
}
