// Vigila R22 (ADR-017 §3): el dinero decimal vive solo dentro de motor/ y solo cruza por el adaptador.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(import.meta.dirname, '..', '..', '..') // apps/api/src
const MOTOR = 'modules/cotizador/domain/motor/'
const DOMINIO = 'modules/cotizador/domain/'

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  )
}

const TODOS = archivos(RAIZ)
  .map((ruta) => ({ ruta: relative(RAIZ, ruta).split(sep).join('/'), texto: readFileSync(ruta, 'utf8') }))
  // Este archivo nombra las reglas que vigila: no se lee a sí mismo.
  .filter((a) => a.ruta !== `${DOMINIO}frontera-del-motor.spec.ts`)

const IMPORTA = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
function importaciones(texto: string): string[] {
  return [...texto.matchAll(IMPORTA)].map((m) => m[1] ?? '')
}

describe('frontera del motor del Cotizador', () => {
  it('hay archivos que vigilar', () => {
    expect(TODOS.filter((a) => a.ruta.startsWith(MOTOR)).length).toBeGreaterThan(50)
  })

  it('solo motor/base/dinero.ts importa big.js', () => {
    const quienes = TODOS.filter((a) => importaciones(a.texto).includes('big.js')).map((a) => a.ruta)
    expect(quienes).toEqual([`${MOTOR}base/dinero.ts`])
  })

  it('fuera de modules/cotizador/domain/ nadie importa una ruta con /domain/motor/', () => {
    const infractores = TODOS.filter(
      (a) => !a.ruta.startsWith(DOMINIO) && importaciones(a.texto).some((i) => i.includes('/domain/motor/')),
    ).map((a) => a.ruta)
    expect(infractores).toEqual([])
  })

  it('dentro de motor/ nadie importa de fuera de motor/ salvo zod, big.js y vitest', () => {
    const infractores: string[] = []
    for (const a of TODOS.filter((x) => x.ruta.startsWith(MOTOR))) {
      const dir = a.ruta.split('/').slice(0, -1).join('/')
      for (const i of importaciones(a.texto)) {
        if (['zod', 'big.js', 'vitest'].includes(i)) continue
        if (i.startsWith('.')) {
          const partes: string[] = dir.split('/')
          for (const p of i.split('/')) {
            if (p === '..') partes.pop()
            else if (p !== '.') partes.push(p)
          }
          if ((partes.join('/') + '/').startsWith(MOTOR)) continue
        }
        infractores.push(`${a.ruta} -> ${i}`)
      }
    }
    expect(infractores).toEqual([])
  })

  it('Math.log y Math.exp aparecen solo en motor/escala/precio-por-escala.ts', () => {
    const quienes = TODOS.filter((a) => /Math\.(log|exp)\b/.test(a.texto)).map((a) => a.ruta)
    expect(quienes).toEqual([`${MOTOR}escala/precio-por-escala.ts`])
  })
})
