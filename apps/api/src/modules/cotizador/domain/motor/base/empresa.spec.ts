import { describe, expect, it } from 'vitest'
import { configuracionEsPE } from './semilla-es-pe.js'
import { configuracionEmpresaSchema } from './empresa.js'

const con = (parcial: Record<string, unknown>) => configuracionEmpresaSchema.safeParse({ ...configuracionEsPE, ...parcial })

describe('configuración de la empresa: idioma y moneda', () => {
  it('acepta idiomas bien formados de cualquier país, no solo el de la semilla', () => {
    for (const locale of ['es-PE', 'es-AR', 'en-US', 'pt-BR', 'es']) expect(con({ locale }).success, locale).toBe(true)
  })

  it('rechaza un idioma mal formado: Intl lanzaría y tumbaría las pantallas', () => {
    for (const locale of ['es_PE', 'español', '!!', 'es-PE-x-']) expect(con({ locale }).success, locale).toBe(false)
    expect(() => new Intl.NumberFormat('es_PE')).toThrow() // la razón de la regla
  })

  it('la moneda es un código de tres letras mayúsculas', () => {
    expect(con({ moneda: 'USD' }).success).toBe(true)
    for (const moneda of ['usd', 'US', 'USDX', 'U$D', '']) expect(con({ moneda }).success, moneda).toBe(false)
  })
})

describe('configuración de la empresa: mensaje de WhatsApp (PRP-003 Fase 4)', () => {
  it('acepta una plantilla que incluye {enlace}', () => {
    expect(con({ mensajeWhatsapp: 'Hola, aquí tienes tu cotización: {enlace}' }).success).toBe(true)
  })

  it('rechaza una plantilla sin {enlace}: el mensaje quedaría sin el enlace real', () => {
    const r = con({ mensajeWhatsapp: 'Hola, gracias por tu compra' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/\{enlace\}/)
  })

  it('rechaza una plantilla vacía', () => {
    expect(con({ mensajeWhatsapp: '' }).success).toBe(false)
  })
})
