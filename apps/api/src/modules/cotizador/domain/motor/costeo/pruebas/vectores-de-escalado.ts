// El caso de referencia (2.500 volantes A5) corrido a otras cantidades. Generado el 2026-09-19
// con un oráculo independiente del motor (Python: imposición por conteo pieza a pieza en mm
// enteros, mermas y escalado con `Fraction`, redondeo half-up con `Decimal`). La fila l1 es el
// papel (pliegos madre); l2 y l4 son fijas; l3, l5 y l6 escalan por pliego de máquina. La
// cantidad de cada fila se redondea a 3 decimales (NUMERIC(12,3)) y el subtotal a 2.

export type VectorDeEscalado = {
  cantidad: string
  pliegosNetos: string
  pliegosDeMaquina: string
  pliegosMadre: string
  /** Cantidad de cada fila (por id) tras escalar. */
  cantidades: Record<string, string>
  subtotales: Record<string, string>
  costoTotal: string
  /** Precio con 35 % de utilidad sobre la venta. */
  precioSobreVenta35: string
  /** Precio con recargo de 35 % sobre el costo. */
  precioRecargo35: string
}

export const vectoresDeEscalado: VectorDeEscalado[] = [
  {
    cantidad: "100", pliegosNetos: "25", pliegosDeMaquina: "66", pliegosMadre: "17",
    cantidades: { l1: "17", l2: "8", l3: "0.077", l4: "1", l5: "0.096", l6: "0.096" },
    subtotales: { l1: "7.65", l2: "40.00", l3: "2.31", l4: "40.00", l5: "2.69", l6: "1.51" },
    costoTotal: "94.16", precioSobreVenta35: "144.86", precioRecargo35: "127.12",
  },
  {
    cantidad: "1000", pliegosNetos: "250", pliegosDeMaquina: "298", pliegosMadre: "75",
    cantidades: { l1: "75", l2: "8", l3: "0.348", l4: "1", l5: "0.435", l6: "0.435" },
    subtotales: { l1: "33.75", l2: "40.00", l3: "10.44", l4: "40.00", l5: "12.18", l6: "6.85" },
    costoTotal: "143.22", precioSobreVenta35: "220.34", precioRecargo35: "193.35",
  },
  {
    cantidad: "2500", pliegosNetos: "625", pliegosDeMaquina: "685", pliegosMadre: "172",
    cantidades: { l1: "172", l2: "8", l3: "0.8", l4: "1", l5: "1", l6: "1" },
    subtotales: { l1: "77.40", l2: "40.00", l3: "24.00", l4: "40.00", l5: "28.00", l6: "15.75" },
    costoTotal: "225.15", precioSobreVenta35: "346.38", precioRecargo35: "303.95",
  },
  {
    cantidad: "5000", pliegosNetos: "1250", pliegosDeMaquina: "1329", pliegosMadre: "333",
    cantidades: { l1: "333", l2: "8", l3: "1.552", l4: "1", l5: "1.94", l6: "1.94" },
    subtotales: { l1: "149.85", l2: "40.00", l3: "46.56", l4: "40.00", l5: "54.32", l6: "30.56" },
    costoTotal: "361.29", precioSobreVenta35: "555.83", precioRecargo35: "487.74",
  },
]
