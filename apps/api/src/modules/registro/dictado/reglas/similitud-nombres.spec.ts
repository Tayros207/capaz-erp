import { describe, expect, it } from 'vitest'
import {
  UMBRAL_MISMA_PERSONA,
  UMBRAL_SUGERENCIA,
  esProbableMismaPersona,
  normalizarParaComparar,
  raicesDeBusqueda,
  similitud,
} from './similitud-nombres.js'

/**
 * Los pares de "duplicados reales" salen de la base del dueño: 86 contactos
 * para 108 movimientos. Los de "personas distintas" son el otro lado de la
 * moneda, y son los que NO pueden fallar nunca: fusionarlos mezcla las deudas
 * de dos clientes.
 */
const MISMA_PERSONA: [string, string][] = [
  ['Wilfredo', 'Wilfredo Ica'],
  ['Wilfredo', 'WILFREDO - HOT STAMPING'],
  ['Wilfredo Ica', 'WILFREDO - HOT STAMPING'],
  ['Manuel Guerra', 'Manuel guerra Dala'],
  ['CRISTHIAN NEYRA', 'Cristian Neira'],
  ['Juan Un Pedido', 'Juan'],
]

const PERSONAS_DISTINTAS: [string, string][] = [
  ['Juan Pérez', 'Juan Tenorio'],
  ['Jose Ríos', 'JOSE PILCO'],
  ['Luz Borja', 'LUZ PILCO'],
  ['Manuel Guerra', 'Manuel Tenorio'],
  ['Wilfredo Ica', 'Wilmer Ica'],
  ['Rosa Diaz', 'Wilfredo'],
]

describe('normalizarParaComparar', () => {
  it('baja a minusculas, recorta y quita tildes', () => {
    expect(normalizarParaComparar('  Josué RÍOS  ')).toBe('josue rios')
  })

  it('convierte la ñ igual que la base de datos', () => {
    expect(normalizarParaComparar('Begoña')).toBe('begona')
  })

  it('deja fuera el negocio que va tras el guion', () => {
    expect(normalizarParaComparar('WILFREDO - HOT STAMPING')).toBe('wilfredo')
  })

  it('deja fuera el negocio entre parentesis', () => {
    expect(normalizarParaComparar('Wilfredo (Hot Stamping)')).toBe('wilfredo')
  })

  it('no parte un nombre con guion pegado', () => {
    expect(normalizarParaComparar('Jean-Pierre Gomez')).toBe('jean pierre gomez')
  })

  it('quita el relleno que se cuela al dictar', () => {
    expect(normalizarParaComparar('Juan Un Pedido')).toBe('juan pedido')
    expect(normalizarParaComparar('Maria de la Cruz')).toBe('maria cruz')
  })

  it('quita la forma societaria', () => {
    expect(normalizarParaComparar('Imprenta Lima S.A.C.')).toBe('imprenta lima')
  })

  it('quita las iniciales sueltas', () => {
    expect(normalizarParaComparar('Juan D Perez')).toBe('juan perez')
  })

  it('devuelve cadena vacia cuando no queda nada aprovechable', () => {
    expect(normalizarParaComparar('')).toBe('')
    expect(normalizarParaComparar('   ')).toBe('')
    expect(normalizarParaComparar('- SAC')).toBe('')
    expect(normalizarParaComparar('...')).toBe('')
  })
})

describe('esProbableMismaPersona', () => {
  it.each(MISMA_PERSONA)('reconoce «%s» y «%s» como la misma persona', (a, b) => {
    expect(esProbableMismaPersona(a, b)).toBe(true)
    expect(esProbableMismaPersona(b, a)).toBe(true)
  })

  it.each(PERSONAS_DISTINTAS)('mantiene separados a «%s» y «%s»', (a, b) => {
    expect(esProbableMismaPersona(a, b)).toBe(false)
    expect(esProbableMismaPersona(b, a)).toBe(false)
  })

  it('el mismo nombre escrito igual es la misma persona', () => {
    expect(esProbableMismaPersona('Wilfredo Ica', 'wilfredo ica')).toBe(true)
  })

  it('no le importa el orden en que se dicto el apellido', () => {
    expect(esProbableMismaPersona('Guerra Manuel', 'Manuel Guerra Dala')).toBe(true)
  })

  it('aguanta la doble letra y la h muda', () => {
    expect(esProbableMismaPersona('Wilfredoo', 'Wilfredo')).toBe(true)
    expect(esProbableMismaPersona('Thania', 'Tania')).toBe(true)
    expect(esProbableMismaPersona('Hilda Rojas', 'Ilda Rojas')).toBe(true)
  })

  it('aguanta b/v y z/s, que es como se dicta', () => {
    expect(esProbableMismaPersona('Balverde', 'Valverde')).toBe(true)
    expect(esProbableMismaPersona('Gonzales Ruiz', 'Gonzalez Ruiz')).toBe(true)
  })

  it('una cadena vacia no se parece a nadie', () => {
    expect(esProbableMismaPersona('', 'Wilfredo')).toBe(false)
    expect(esProbableMismaPersona('Wilfredo', '')).toBe(false)
    expect(esProbableMismaPersona('', '')).toBe(false)
    expect(esProbableMismaPersona('   ', 'Wilfredo')).toBe(false)
  })

  it('lo que queda reducido a particulas no identifica a nadie', () => {
    expect(esProbableMismaPersona('Sr', 'Sr')).toBe(false)
    expect(esProbableMismaPersona('de la', 'de las')).toBe(false)
  })

  it('un nombre larguisimo no rompe ni se dispara', () => {
    const largo = `Wilfredo ${'Ica '.repeat(200)}`.trim()
    expect(esProbableMismaPersona(largo, 'Wilfredo')).toBe(true)
    expect(esProbableMismaPersona(largo, 'Juan Tenorio')).toBe(false)
    expect(esProbableMismaPersona('x'.repeat(5000), 'y'.repeat(5000))).toBe(false)
  })

  it('coincide con el umbral publicado', () => {
    for (const [a, b] of MISMA_PERSONA) {
      expect(similitud(a, b)).toBeGreaterThanOrEqual(UMBRAL_MISMA_PERSONA)
    }
    for (const [a, b] of PERSONAS_DISTINTAS) {
      expect(similitud(a, b)).toBeLessThan(UMBRAL_MISMA_PERSONA)
    }
  })
})

describe('similitud', () => {
  it('es simetrica', () => {
    const pares: [string, string][] = [
      ...MISMA_PERSONA,
      ...PERSONAS_DISTINTAS,
      ['Wilfredo', ''],
      ['Ana', 'Ana Maria Borja'],
      ['Imprenta Lima SAC', 'imprenta lima'],
    ]
    for (const [a, b] of pares) {
      expect(similitud(a, b)).toBe(similitud(b, a))
    }
  })

  it('el mismo nombre da 1', () => {
    expect(similitud('Wilfredo Ica', 'Wilfredo Ica')).toBe(1)
    expect(similitud('WILFREDO ICA', '  wilfredo   ica ')).toBe(1)
  })

  it('el mismo sonido tambien da 1', () => {
    expect(similitud('CRISTHIAN NEYRA', 'Cristian Neira')).toBe(1)
  })

  it('vacio contra cualquier cosa da 0', () => {
    expect(similitud('', 'Wilfredo')).toBe(0)
    expect(similitud('', '')).toBe(0)
  })

  it('siempre cae entre 0 y 1', () => {
    const nombres = ['Wilfredo', 'Wilfredo Ica', 'Juan Perez', '', 'Luz', 'A'.repeat(400)]
    for (const a of nombres) {
      for (const b of nombres) {
        const valor = similitud(a, b)
        expect(valor).toBeGreaterThanOrEqual(0)
        expect(valor).toBeLessThanOrEqual(1)
      }
    }
  })

  it('penaliza cuanto mas sobra del nombre largo', () => {
    const cerca = similitud('Wilfredo', 'Wilfredo Ica')
    const lejos = similitud('Wilfredo', 'Wilfredo Ica Mendoza Torres')
    expect(cerca).toBeGreaterThan(lejos)
    expect(lejos).toBeGreaterThanOrEqual(UMBRAL_MISMA_PERSONA)
  })

  it('un parecido de letras sin estructura nunca alcanza el umbral', () => {
    // Le falta una r: suena distinto, asi que no se declara la misma persona,
    // pero puntua alto para que aparezca en la lista de candidatos.
    const valor = similitud('Wilfedo', 'Wilfredo')
    expect(esProbableMismaPersona('Wilfedo', 'Wilfredo')).toBe(false)
    expect(valor).toBeLessThan(UMBRAL_MISMA_PERSONA)
    expect(valor).toBeGreaterThanOrEqual(UMBRAL_SUGERENCIA)
  })

  it('nombres sin nada que ver puntuan bajo', () => {
    expect(similitud('Wilfredo Ica', 'Rosa Diaz')).toBeLessThan(UMBRAL_SUGERENCIA)
  })

  it('los umbrales estan ordenados', () => {
    expect(UMBRAL_SUGERENCIA).toBeLessThan(UMBRAL_MISMA_PERSONA)
  })
})

describe('raicesDeBusqueda', () => {
  it('da el arranque de cada palabra util', () => {
    expect(raicesDeBusqueda('Manuel Guerra')).toContain('man')
    expect(raicesDeBusqueda('Manuel Guerra')).toContain('gue')
  })

  it('incluye la variante fonetica para que b/v no se pierda', () => {
    expect(raicesDeBusqueda('Valverde')).toEqual(expect.arrayContaining(['val', 'bal']))
  })

  it('no devuelve nada para un nombre vacio', () => {
    expect(raicesDeBusqueda('')).toEqual([])
    expect(raicesDeBusqueda('- SAC')).toEqual([])
  })

  it('no repite raices', () => {
    const raices = raicesDeBusqueda('Manuel Manuel')
    expect(new Set(raices).size).toBe(raices.length)
  })
})
