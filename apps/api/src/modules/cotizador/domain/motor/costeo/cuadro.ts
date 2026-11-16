import type { ItemDeEmpresa } from '../base/empresa.js'
import { correcto, type Fallo, type Resultado } from '../base/resultado.js'
import { aTexto, CERO, esMayor, multiplicar } from '../base/dinero.js'
import { FILAS_DE_PLANTILLA, type Plantilla } from './constantes/plantillas.js'
import type { Cuadro } from './tipos/borrador.js'
import { COLUMNA_BASE_POR_DEFECTO, FILAS_FIJAS_POR_DEFECTO, type Directo } from './tipos/cuadro-directo.js'
import type { Calculo, ConfiguracionDeCosteo, Linea, Utilidad } from './tipos/cotizacion.js'
import type { CuadroEscalable } from './tipos/escalado.js'
import type { CodigoDeImposicion, EntradaDeImposicion, ImposicionCalculada } from './tipos/imposicion.js'
import { calcularCotizacion } from './calcular-cotizacion.js'
import { calcularImposicion } from './imposicion.js'

/**
 * El cuadro directo de una cotización nueva (PRP-007): sin nada escrito, con los ítems activos de la
 * empresa copiados (con ids propios de la cotización), Placa y Diseño marcadas como fijas, y solo la
 * columna base entre las que se envían.
 */
function directoInicial(items: readonly ItemDeEmpresa[]): Directo {
  const activos = items.filter((i) => i.activo)
  return {
    factores: Object.fromEntries(FILAS_FIJAS_POR_DEFECTO.map((f) => [f, { celdas: {}, fija: true }])),
    items: activos.map((item, n) => ({
      id: `i${n + 1}`, nombre: item.nombre, factor: item.factor, despuesDe: item.despuesDe, celdas: {}, fija: item.fija,
    })),
    utilidadPct: {},
    enviar: [COLUMNA_BASE_POR_DEFECTO],
    siguienteItem: activos.length + 1,
  }
}

/**
 * Un cuadro nuevo con las filas sugeridas de la plantilla (costos vacíos), la utilidad de la empresa, la
 * cantidad base en 1.000 (una de las tres columnas) y los ítems propios de la empresa.
 */
export function cuadroInicial(plantilla: Plantilla, utilidad: Utilidad, items: readonly ItemDeEmpresa[] = []): Cuadro {
  const filas = FILAS_DE_PLANTILLA[plantilla]
  const idDe = (clave: 'papel' | 'planchas') => {
    const i = filas.findIndex((f) => f.automatica === clave)
    return i < 0 ? null : `l${i + 1}`
  }
  return {
    trabajo: { producto: '', cantidad: COLUMNA_BASE_POR_DEFECTO, pieza: null, tintas: 0, caras: 1, cliente: '' },
    imposicion: {
      pliegoMadre: null, pliegoMaquina: null, sangradoCm: null, calleCm: null, pinzaCm: null,
      formatoMaximo: null, etapas: [],
    },
    lineas: filas.map((f, i) => ({
      id: `l${i + 1}`, factor: f.factor, descripcion: f.descripcion, cantidad: f.cantidad,
      unidad: f.unidad, costoUnitario: '0', escala: f.escala,
    })),
    utilidad,
    precioFinal: null,
    automaticas: { papel: idDe('papel'), planchas: idDe('planchas') },
    siguienteLinea: filas.length + 1,
    directo: directoInicial(items),
  }
}

/**
 * La entrada de la imposición si el cuadro tiene todo lo necesario; si no, lo que falta, con el
 * nombre con que se dice cada dato.
 */
export function entradaDeImposicionDe(
  cuadro: Cuadro,
): { entrada: EntradaDeImposicion } | { faltantes: string[] } {
  const { trabajo, imposicion: im } = cuadro
  const cantidadFijada = esMayor(trabajo.cantidad, CERO)
  const faltantes: string[] = []
  if (!cantidadFijada) faltantes.push('cantidad del trabajo')
  if (trabajo.pieza === null) faltantes.push('medidas de la pieza')
  if (im.pliegoMadre === null) faltantes.push('pliego madre')
  if (im.pliegoMaquina === null) faltantes.push('pliego de máquina')
  if (im.sangradoCm === null) faltantes.push('sangrado')
  if (im.calleCm === null) faltantes.push('calle')
  if (im.pinzaCm === null) faltantes.push('pinza')

  if (
    !cantidadFijada || trabajo.pieza === null || im.pliegoMadre === null ||
    im.pliegoMaquina === null || im.sangradoCm === null || im.calleCm === null || im.pinzaCm === null
  ) {
    return { faltantes }
  }
  return {
    entrada: {
      pieza: trabajo.pieza,
      cantidad: trabajo.cantidad,
      imposicion: {
        pliegoMadre: im.pliegoMadre,
        pliegoMaquina: im.pliegoMaquina,
        sangradoCm: im.sangradoCm,
        calleCm: im.calleCm,
        pinzaCm: im.pinzaCm,
        etapas: im.etapas,
        ...(im.formatoMaximo === null ? {} : { formatoMaximo: im.formatoMaximo }),
      },
    },
  }
}

export type Sincronizacion = {
  /** El cuadro con las filas automáticas al día. */
  cuadro: Cuadro
  /** Presente si la imposición está completa; con ella se escala el cuadro. */
  entradaDeImposicion: EntradaDeImposicion | null
  imposicion: ImposicionCalculada | null
  /** Datos que faltan para calcular la imposición (vacío si está completa). */
  faltantes: string[]
  /** Por qué no se pudo calcular una imposición completa (la pieza no cabe, merma imposible...). */
  problema: Fallo<CodigoDeImposicion> | null
}

function conCantidad(lineas: Linea[], id: string | null, cantidad: string): Linea[] {
  return id === null ? lineas : lineas.map((l) => (l.id === id ? { ...l, cantidad } : l))
}

/**
 * Pone al día las filas que mantiene el motor: las planchas siguen a tintas × caras (ADR-11) y el
 * papel, a los pliegos madre de la imposición. Una fila corregida a mano deja de estar en
 * `automaticas` y no se toca. Es idempotente.
 */
export function sincronizarFilas(cuadro: Cuadro): Sincronizacion {
  const planchas = aTexto(multiplicar(String(cuadro.trabajo.tintas), String(cuadro.trabajo.caras)))
  const lineas = conCantidad(cuadro.lineas, cuadro.automaticas.planchas, planchas)
  const alDia = { ...cuadro, lineas }

  const previa = entradaDeImposicionDe(cuadro)
  if ('faltantes' in previa) {
    return { cuadro: alDia, entradaDeImposicion: null, imposicion: null, faltantes: previa.faltantes, problema: null }
  }
  const imposicion = calcularImposicion(previa.entrada)
  if (!imposicion.ok) {
    return { cuadro: alDia, entradaDeImposicion: previa.entrada, imposicion: null, faltantes: [], problema: imposicion.error }
  }
  return {
    cuadro: { ...cuadro, lineas: conCantidad(lineas, cuadro.automaticas.papel, imposicion.valor.pliegosMadre) },
    entradaDeImposicion: previa.entrada,
    imposicion: imposicion.valor,
    faltantes: [],
    problema: null,
  }
}

export type CuadroCalculado = Sincronizacion & { calculo: Calculo }

/** Sincroniza las filas y costea el cuadro completo. Función pura: la configuración llega como parámetro. */
export function calcularCuadro(
  cuadro: Cuadro,
  config: ConfiguracionDeCosteo,
): Resultado<CuadroCalculado, 'utilidad_imposible'> {
  const sincronizado = sincronizarFilas(cuadro)
  const { cuadro: alDia } = sincronizado
  const calculo = calcularCotizacion(
    {
      lineas: alDia.lineas,
      cantidad: alDia.trabajo.cantidad,
      utilidad: alDia.utilidad,
      ...(alDia.precioFinal === null ? {} : { precioFinal: alDia.precioFinal }),
    },
    config,
  )
  return calculo.ok ? correcto({ ...sincronizado, calculo: calculo.valor }) : calculo
}

/** El cuadro listo para correrlo a otra cantidad (`escalarCuadro`, `generarReferencias`). */
export function cuadroEscalable(sincronizado: Sincronizacion): CuadroEscalable {
  const { cuadro, entradaDeImposicion } = sincronizado
  return {
    lineas: cuadro.lineas,
    cantidad: cuadro.trabajo.cantidad,
    ...(entradaDeImposicion
      ? {
          papel: {
            pieza: entradaDeImposicion.pieza,
            imposicion: entradaDeImposicion.imposicion,
            lineaDePapelId: cuadro.automaticas.papel,
          },
        }
      : {}),
  }
}
