import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  canonico,
  crearToken,
  hashCanonico,
  verificarToken,
  type CargaDeToken,
} from './confirmacion.js'

const SECRETO = 'un-secreto-de-prueba-de-al-menos-32-caracteres'

const carga: CargaDeToken = {
  herramienta: 'emitir',
  hashArgs: 'a'.repeat(64),
  huella: 'b'.repeat(64),
  usuarioId: 'u1',
  empresaId: 'e1',
  jti: 'jti-1',
  exp: 1_000_000,
}

describe('canonico y hashCanonico', () => {
  it('el orden de las llaves no cambia el resultado, en cualquier nivel', () => {
    expect(canonico({ b: 1, a: { d: 2, c: 3 } })).toBe(canonico({ a: { c: 3, d: 2 }, b: 1 }))
    expect(hashCanonico({ b: 1, a: 2 })).toBe(hashCanonico({ a: 2, b: 1 }))
  })

  it('el orden de un arreglo sí importa, y un contenido distinto da otro hash', () => {
    expect(canonico([1, 2])).not.toBe(canonico([2, 1]))
    expect(hashCanonico({ a: '1' })).not.toBe(hashCanonico({ a: '2' }))
    expect(hashCanonico({ a: '1' })).not.toBe(hashCanonico({ a: 1 }))
  })

  it('una llave sin valor (undefined) se ignora, igual que en JSON', () => {
    expect(hashCanonico({ a: 1, b: undefined })).toBe(hashCanonico({ a: 1 }))
  })

  it('el hash es SHA-256 en hexadecimal', () => {
    expect(hashCanonico({})).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('token de confirmación', () => {
  it('se crea y se verifica: devuelve la misma carga', () => {
    const v = verificarToken(crearToken(carga, SECRETO), SECRETO, 999_999)
    expect(v).toEqual({ ok: true, carga })
  })

  it('tiene la forma base64url(carga).firma', () => {
    const [cuerpo, firma, resto] = crearToken(carga, SECRETO).split('.')
    expect(resto).toBeUndefined()
    expect(JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))).toEqual(carga)
    expect(firma).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('vence exactamente en `exp`: un segundo antes vale, en `exp` ya no', () => {
    const token = crearToken(carga, SECRETO)
    expect(verificarToken(token, SECRETO, carga.exp - 1).ok).toBe(true)
    expect(verificarToken(token, SECRETO, carga.exp)).toEqual({ ok: false, motivo: 'vencido' })
    expect(verificarToken(token, SECRETO, carga.exp + 3600)).toEqual({ ok: false, motivo: 'vencido' })
  })

  it('otro secreto no lo verifica', () => {
    const token = crearToken(carga, SECRETO)
    expect(verificarToken(token, `${SECRETO}x`, 1)).toEqual({ ok: false, motivo: 'firma' })
  })

  it('cambiar un solo dato de la carga invalida la firma (no se puede alargar el plazo ni cambiar la persona)', () => {
    const [, firma] = crearToken(carga, SECRETO).split('.')
    for (const cambio of [{ exp: carga.exp + 1000 }, { usuarioId: 'u2' }, { empresaId: 'e2' }, { hashArgs: 'c'.repeat(64) }]) {
      const cuerpo = Buffer.from(JSON.stringify({ ...carga, ...cambio })).toString('base64url')
      expect(verificarToken(`${cuerpo}.${firma}`, SECRETO, 1)).toEqual({ ok: false, motivo: 'firma' })
    }
  })

  it('una firma alterada o de otro largo se rechaza sin lanzar', () => {
    const [cuerpo, firma] = crearToken(carga, SECRETO).split('.')
    const alterada = `${firma.slice(0, -1)}${firma.endsWith('A') ? 'B' : 'A'}`
    expect(verificarToken(`${cuerpo}.${alterada}`, SECRETO, 1)).toEqual({ ok: false, motivo: 'firma' })
    expect(verificarToken(`${cuerpo}.corta`, SECRETO, 1)).toEqual({ ok: false, motivo: 'firma' })
  })

  it('un texto que no es un token se rechaza como malformado', () => {
    for (const basura of ['', 'sin-punto', 'a.b.c', '.', 'a.', '.b']) {
      const v = verificarToken(basura, SECRETO, 1)
      expect(v.ok, basura).toBe(false)
    }
    expect(verificarToken('sin-punto', SECRETO, 1)).toEqual({ ok: false, motivo: 'malformado' })
  })

  it('una carga bien firmada pero con la forma equivocada es malformada', () => {
    const cuerpo = Buffer.from(JSON.stringify({ herramienta: 'x' })).toString('base64url')
    const firma = createHmac('sha256', SECRETO).update(cuerpo).digest('base64url')
    expect(verificarToken(`${cuerpo}.${firma}`, SECRETO, 1)).toEqual({ ok: false, motivo: 'malformado' })
    const noJson = Buffer.from('esto no es json').toString('base64url')
    const firma2 = createHmac('sha256', SECRETO).update(noJson).digest('base64url')
    expect(verificarToken(`${noJson}.${firma2}`, SECRETO, 1)).toEqual({ ok: false, motivo: 'malformado' })
  })
})
