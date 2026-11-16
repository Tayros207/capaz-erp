import { describe, expect, it } from 'vitest'
import { aTexto, dividir } from '../base/dinero.js'
import {
  entradaDeImposicionDelCasoDeReferencia,
  entradaDelCasoDeReferencia,
  imposicionDelCasoDeReferencia,
  lineasDelCasoDeReferencia,
  piezaDelCasoDeReferencia,
  umbralesPorDefecto,
} from './pruebas/caso-de-referencia.js'
import type {
  Dimensiones,
  EntradaDeImposicion,
  ImposicionCalculada,
  Margenes,
  Reparto,
} from './tipos/imposicion.js'
import { calcularCotizacion } from './calcular-cotizacion.js'
import {
  cabeEnFormato,
  calcularImposicion,
  filaDePapel,
  pliegosPorMadre,
  posesEnPliego,
} from './imposicion.js'

const MARGENES: Margenes = { sangradoCm: '0.3', calleCm: '0.3', pinzaCm: '2' }
const A5: Dimensiones = piezaDelCasoDeReferencia
const A4: Dimensiones = { anchoCm: '21', altoCm: '29.7' }
const MADRE = imposicionDelCasoDeReferencia.pliegoMadre
const MAQUINA = imposicionDelCasoDeReferencia.pliegoMaquina

function poses(pieza: Dimensiones, pliego: Dimensiones, margenes = MARGENES): Reparto {
  const r = posesEnPliego(pieza, pliego, margenes)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

function imponer(entrada: EntradaDeImposicion = entradaDeImposicionDelCasoDeReferencia) {
  const r = calcularImposicion(entrada)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

function conImposicion(cambios: Partial<EntradaDeImposicion['imposicion']>): EntradaDeImposicion {
  const base = entradaDeImposicionDelCasoDeReferencia
  return { ...base, imposicion: { ...base.imposicion, ...cambios } }
}

function codigoDeFallo(entrada: EntradaDeImposicion): string | undefined {
  const r = calcularImposicion(entrada)
  return r.ok ? undefined : r.error.codigo
}

describe('caso de referencia: 2.500 volantes A5', () => {
  it('4 poses (2 × 2), 625 netos, 645 tras el porcentaje, 685 de máquina y 172 madres', () => {
    const c = imponer()
    expect(c).toMatchObject({
      poses: '4',
      columnas: '2',
      filas: '2',
      girada: false,
      pliegosNetos: '625',
      pliegosDeMaquina: '685',
      pliegosPorMadre: '4',
      pliegosMadre: '172',
    })
    expect(c.etapas).toHaveLength(1)
    expect(c.etapas[0]).toMatchObject({ salida: '625', trasPorcentaje: '645', arranque: '40', entrada: '685' })
  })

  it('la fila de papel coincide con la del caso de referencia (172 × 0.45)', () => {
    const fila = filaDePapel(imponer(), {
      id: 'l1',
      descripcion: 'Papel couché 150 g, pliego madre 70 × 100',
      unidad: 'pliego',
      costoUnitario: '0.45',
    })
    expect(fila).toEqual(lineasDelCasoDeReferencia[0])
  })

  it('imposición → fila de papel → costeo: papel 77.40, costo 225.15 y precio 346.38', () => {
    const papel = filaDePapel(imponer(), {
      id: 'l1',
      descripcion: 'Papel',
      unidad: 'pliego',
      costoUnitario: '0.45',
    })
    const entrada = entradaDelCasoDeReferencia({ pct: '35', base: 'venta' })
    const lineas = [papel, ...entrada.lineas.filter((l) => l.factor !== 'material')]
    const r = calcularCotizacion({ ...entrada, lineas }, umbralesPorDefecto)
    expect(r.ok && r.valor.porFactor.material).toBe('77.40')
    expect(r.ok && r.valor.costoTotal).toBe('225.15')
    expect(r.ok && r.valor.precio).toBe('346.38')
  })

  it('todo son textos (y un booleano): sobrevive a JSON', () => {
    const c = imponer()
    expect(JSON.parse(JSON.stringify(c))).toEqual(c)
  })
})

describe('poses por pliego (PRO-01)', () => {
  it('A5: 18 en el pliego madre 70 × 100 y 4 en el de máquina 35 × 50', () => {
    expect(poses(A5, MADRE).poses).toBe('18')
    expect(poses(A5, MAQUINA).poses).toBe('4')
  })

  it('A4: 9 en el pliego madre y 2 en el de máquina', () => {
    expect(poses(A4, MADRE).poses).toBe('9')
    expect(poses(A4, MAQUINA).poses).toBe('2')
  })

  it('las poses son columnas × filas', () => {
    for (const [pieza, pliego] of [[A5, MADRE], [A4, MADRE], [A5, MAQUINA], [A4, MAQUINA]] as const) {
      const r = poses(pieza, pliego)
      expect(aTexto(dividir(r.poses, r.columnas))).toBe(r.filas)
    }
  })

  it('imponer directo en el madre (18) no es lo mismo que cortar a 35 × 50 e imponer (4 × 4 = 16)', () => {
    const directo = poses(A5, MADRE).poses
    const cortado = poses(A5, MAQUINA).poses
    const porMadre = aTexto(pliegosPorMadre(MADRE, MAQUINA))
    expect([directo, cortado, porMadre]).toEqual(['18', '4', '4'])
    expect(directo).not.toBe('16')
  })

  it('el A4 en 35 × 50 solo cabe girado: 1 columna × 2 filas', () => {
    expect(poses(A4, MAQUINA)).toEqual({ poses: '2', columnas: '1', filas: '2', girada: true })
  })

  it('el sangrado se cuenta por los dos lados y la calle solo entre piezas', () => {
    // Una pieza de 10 con sangrado de 0.3 por lado mide 10.6: en 21.2 caben dos pegadas; en 21.1, una.
    const sinPinza = { sangradoCm: '0.3', calleCm: '0', pinzaCm: '0' }
    const pieza = { anchoCm: '10', altoCm: '10' }
    expect(poses(pieza, { anchoCm: '21.2', altoCm: '10.6' }, sinPinza).poses).toBe('2')
    expect(poses(pieza, { anchoCm: '21.1', altoCm: '10.6' }, sinPinza).poses).toBe('1')
    // Con calle 0.3 entre las dos hacen falta 10.6 + 0.3 + 10.6 = 21.5.
    const conCalle = { ...sinPinza, calleCm: '0.3' }
    expect(poses(pieza, { anchoCm: '21.5', altoCm: '10.6' }, conCalle).poses).toBe('2')
    expect(poses(pieza, { anchoCm: '21.4', altoCm: '10.6' }, conCalle).poses).toBe('1')
  })

  it('la pinza se prueba en cada borde: 16.8 × 24 en 35 × 50 con pinza 2 cabe 2 × 2', () => {
    const sinMargen = { sangradoCm: '0', calleCm: '0', pinzaCm: '2' }
    const pieza = { anchoCm: '16.8', altoCm: '24' }
    // Con la pinza en el borde de 35 quedaría 33 × 50 y solo saldrían 2; en el de 50, 35 × 48 da 4.
    expect(poses(pieza, MAQUINA, sinMargen)).toMatchObject({ poses: '4', columnas: '2', filas: '2' })
    // El resultado no depende de en qué orden se escribió el pliego.
    expect(poses(pieza, { anchoCm: '50', altoCm: '35' }, sinMargen).poses).toBe('4')
  })

  it('una pinza mayor que el pliego no deja área útil: rechaza sin fallar ni dar negativos', () => {
    const r = posesEnPliego(A5, MAQUINA, { ...MARGENES, pinzaCm: '60' })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'pieza_no_cabe' } })
  })

  it('una pieza mayor que el pliego no cabe', () => {
    const r = posesEnPliego({ anchoCm: '40', altoCm: '60' }, MAQUINA, MARGENES)
    expect(r).toMatchObject({ ok: false, error: { codigo: 'pieza_no_cabe' } })
  })

  it('medidas en cero se rechazan en vez de dividir entre cero', () => {
    for (const pieza of [{ anchoCm: '0', altoCm: '21' }, { anchoCm: '14.8', altoCm: '0' }]) {
      expect(posesEnPliego(pieza, MAQUINA, { sangradoCm: '0', calleCm: '0', pinzaCm: '0' })).toMatchObject({
        ok: false,
        error: { codigo: 'medida_invalida' },
      })
    }
    expect(posesEnPliego(A5, { anchoCm: '0', altoCm: '50' }, MARGENES).ok).toBe(false)
  })
})

describe('corte del pliego madre al de máquina', () => {
  const cortes = (madre: Dimensiones, maquina: Dimensiones) => aTexto(pliegosPorMadre(madre, maquina))

  it('70 × 100 a 35 × 50 da 4 pliegos de máquina', () => {
    expect(cortes(MADRE, MAQUINA)).toBe('4')
  })

  it('escribir el pliego de máquina al revés (50 × 35) da lo mismo', () => {
    expect(cortes(MADRE, { anchoCm: '50', altoCm: '35' })).toBe('4')
  })

  it('elige la orientación que más saca: 33 × 51 en 70 × 100 da 3 girado, no 2', () => {
    expect(cortes(MADRE, { anchoCm: '33', altoCm: '51' })).toBe('3')
  })

  it('sin cortar (el mismo pliego) es 1, y si no cabe es 0', () => {
    expect(cortes(MADRE, MADRE)).toBe('1')
    expect(cortes(MAQUINA, MADRE)).toBe('0')
  })

  it('un pliego de máquina que no cabe en el madre se rechaza', () => {
    const entrada = conImposicion({ pliegoMadre: MAQUINA, pliegoMaquina: MADRE })
    expect(codigoDeFallo(entrada)).toBe('maquina_no_cabe_en_madre')
  })
})

describe('formato máximo por máquina (PRO-06)', () => {
  const GTO_52: Dimensiones = { anchoCm: '36', altoCm: '52' }

  it('cabeEnFormato: cabe justo, cabe girado y falla por un milímetro', () => {
    expect(cabeEnFormato(GTO_52, GTO_52)).toBe(true)
    expect(cabeEnFormato(MAQUINA, GTO_52)).toBe(true)
    expect(cabeEnFormato({ anchoCm: '50', altoCm: '35' }, GTO_52)).toBe(true)
    expect(cabeEnFormato({ anchoCm: '36.1', altoCm: '52' }, GTO_52)).toBe(false)
    expect(cabeEnFormato({ anchoCm: '52.1', altoCm: '36' }, GTO_52)).toBe(false)
  })

  it('rechaza imprimir en 70 × 100 con una máquina de 36 × 52, y dice qué medidas chocan', () => {
    const entrada = conImposicion({ pliegoMaquina: MADRE, formatoMaximo: GTO_52 })
    const r = calcularImposicion(entrada)
    expect(r).toMatchObject({ ok: false, error: { codigo: 'pliego_excede_formato' } })
    if (!r.ok) expect(r.error.mensaje).toContain('70 × 100')
  })

  it('acepta el pliego de máquina que sí cabe y calcula igual', () => {
    expect(imponer(conImposicion({ formatoMaximo: GTO_52 })).pliegosMadre).toBe('172')
  })

  it('sin máquina elegida no hay formato que comprobar', () => {
    expect(codigoDeFallo(conImposicion({ pliegoMaquina: MADRE, formatoMaximo: undefined }))).toBeUndefined()
  })
})

describe('entradas inválidas: rechazadas con un código, nunca una excepción', () => {
  it('cantidad cero', () => {
    expect(codigoDeFallo({ ...entradaDeImposicionDelCasoDeReferencia, cantidad: '0' })).toBe('cantidad_invalida')
  })

  it('medida en cero en la pieza, el madre, la máquina o el formato máximo', () => {
    const cero = { anchoCm: '0', altoCm: '10' }
    expect(codigoDeFallo({ ...entradaDeImposicionDelCasoDeReferencia, pieza: cero })).toBe('medida_invalida')
    expect(codigoDeFallo(conImposicion({ pliegoMadre: cero }))).toBe('medida_invalida')
    expect(codigoDeFallo(conImposicion({ pliegoMaquina: cero }))).toBe('medida_invalida')
    expect(codigoDeFallo(conImposicion({ formatoMaximo: cero }))).toBe('medida_invalida')
  })

  it('merma de 100 % en una etapa', () => {
    const etapas = [{ nombre: 'Tiraje', mermaPct: '100', arranque: '0' }]
    expect(codigoDeFallo(conImposicion({ etapas }))).toBe('merma_imposible')
  })

  it('una pieza que no cabe en el pliego de máquina', () => {
    const grande = { ...entradaDeImposicionDelCasoDeReferencia, pieza: { anchoCm: '60', altoCm: '90' } }
    expect(codigoDeFallo(grande)).toBe('pieza_no_cabe')
  })
})

describe('sin etapas de merma', () => {
  it('los pliegos brutos son los netos', () => {
    const c = imponer(conImposicion({ etapas: [] }))
    expect(c).toMatchObject({ pliegosNetos: '625', pliegosDeMaquina: '625', pliegosMadre: '157', etapas: [] })
  })
})

describe('otra empresa: mismo código, otra configuración (DoD §6.4)', () => {
  // Calculado a mano. Pliego de máquina 50 × 70 con pinza 1 y sangrado y calle de 0.5; A5 mide
  // 15.8 × 22 con sangrado. Área 50 × 69: 3 × 3 = 9 (girado, 2 × 4 = 8). Netos ⌈3000/9⌉ = 334.
  // Acabado 4 % + 20: ⌈334/0.96⌉ + 20 = 348 + 20 = 368. Impresión 2 % + 30: ⌈368/0.98⌉ + 30 = 376 + 30 = 406.
  // Un madre de 100 × 70 da 2 pliegos de máquina: 406 / 2 = 203 madres.
  const otraEmpresa: EntradaDeImposicion = {
    pieza: A5,
    cantidad: '3000',
    imposicion: {
      pliegoMadre: { anchoCm: '100', altoCm: '70' },
      pliegoMaquina: { anchoCm: '50', altoCm: '70' },
      sangradoCm: '0.5',
      calleCm: '0.5',
      pinzaCm: '1',
      etapas: [
        { nombre: 'Impresión', mermaPct: '2', arranque: '30' },
        { nombre: 'Acabado', mermaPct: '4', arranque: '20' },
      ],
    },
  }

  it('da su propio resultado, distinto del caso de referencia', () => {
    const c: ImposicionCalculada = imponer(otraEmpresa)
    expect(c).toMatchObject({
      poses: '9',
      columnas: '3',
      filas: '3',
      pliegosNetos: '334',
      pliegosDeMaquina: '406',
      pliegosPorMadre: '2',
      pliegosMadre: '203',
    })
    expect(c.etapas.map((e) => [e.nombre, e.salida, e.trasPorcentaje, e.entrada])).toEqual([
      ['Impresión', '368', '376', '406'],
      ['Acabado', '334', '348', '368'],
    ])
  })
})

// Oráculo independiente: milímetros enteros y conteo pieza a pieza (sin fórmulas de división ni
// decimales), en las cuatro combinaciones de pinza (dos bordes) y pieza (derecha y girada).
function piezasIterativo(disponibleMm: number, piezaMm: number, calleMm: number): number {
  let k = 0
  while ((k + 1) * piezaMm + k * calleMm <= disponibleMm) k++
  return k
}

function posesDelOraculo(
  [ancho, alto]: [number, number],
  [pa, pb]: [number, number],
  sangradoMm: number,
  calleMm: number,
  pinzaMm: number,
): number {
  const a = pa + 2 * sangradoMm
  const b = pb + 2 * sangradoMm
  const areas = [[ancho, alto - pinzaMm], [ancho - pinzaMm, alto]]
  const piezas = [[a, b], [b, a]]
  let mejor = 0
  for (const [aw, ah] of areas) {
    for (const [pw, ph] of piezas) {
      mejor = Math.max(mejor, piezasIterativo(aw, pw, calleMm) * piezasIterativo(ah, ph, calleMm))
    }
  }
  return mejor
}

const enCm = (mm: number) => aTexto(dividir(String(mm), '10'), 2)
const dimensionesEnMm = ([ancho, alto]: [number, number]): Dimensiones => ({
  anchoCm: enCm(ancho),
  altoCm: enCm(alto),
})

// Poses del motor con medidas en mm; '0' si el motor rechaza la pieza por no caber.
function posesDelMotor(
  pieza: [number, number],
  pliego: [number, number],
  margenes: Margenes,
): string {
  const r = posesEnPliego(dimensionesEnMm(pieza), dimensionesEnMm(pliego), margenes)
  return r.ok ? r.valor.poses : '0'
}

describe('barrido contra un oráculo independiente en milímetros enteros', () => {
  const pliegos: [number, number][] = [[350, 500], [700, 1000], [330, 480], [520, 740]]
  const piezasMm = [50, 75, 100, 148, 150, 210, 250, 297, 330]
  const piezas = piezasMm.flatMap((a) => piezasMm.map((b): [number, number] => [a, b]))

  it('el motor y el conteo pieza a pieza dan las mismas poses en miles de combinaciones', () => {
    let comparadas = 0
    for (const pliego of pliegos) {
      for (const pieza of piezas) {
        for (const sangrado of [0, 3]) {
          for (const calle of [0, 3, 5]) {
            for (const pinza of [0, 20]) {
              const margenes = { sangradoCm: enCm(sangrado), calleCm: enCm(calle), pinzaCm: enCm(pinza) }
              const esperado = String(posesDelOraculo(pliego, pieza, sangrado, calle, pinza))
              const contexto = `${pieza} en ${pliego}, sangrado ${sangrado}, calle ${calle}, pinza ${pinza}`
              expect(posesDelMotor(pieza, pliego, margenes), contexto).toBe(esperado)
              comparadas++
            }
          }
        }
      }
    }
    expect(comparadas).toBe(3888)
  })

  it('escribir el pliego o la pieza al revés no cambia las poses', () => {
    const alReves = ([a, b]: [number, number]): [number, number] => [b, a]
    for (const pliego of pliegos) {
      for (const pieza of piezas) {
        const base = posesDelMotor(pieza, pliego, MARGENES)
        expect(posesDelMotor(alReves(pieza), pliego, MARGENES), 'pieza al revés').toBe(base)
        expect(posesDelMotor(pieza, alReves(pliego), MARGENES), 'pliego al revés').toBe(base)
      }
    }
  })
})
