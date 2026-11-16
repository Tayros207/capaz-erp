import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, test } from 'vitest'
import {
  CATEGORIAS,
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  categoriaCoincideConTipo,
  categoriasPara,
  esCategoriaValida,
  etiquetaCategoria,
} from './categorias-de-rubro.js'

describe('el catalogo de TypeScript y el de SQL no pueden divergir', () => {
  test('coincide exactamente con categorias_validas() de la migracion 005', () => {
    // Si alguien agrega una categoria en un lado y no en el otro, la BD
    // rechaza el insert con un check violation en produccion. Este test lo
    // detecta antes.
    const sql = readFileSync(
      join(process.cwd(), 'src/modules/registro/dictado/reglas/fixtures/005_proformas_y_categorias.sql'),
      'utf8'
    )
    const bloque = sql.slice(
      sql.indexOf('function public.categorias_validas'),
      sql.indexOf("]::text[]")
    )
    const enSql = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    const enTs = [...CATEGORIAS_EGRESO, ...CATEGORIAS_INGRESO].sort()

    expect(enSql).toEqual(enTs)
  })
})

describe('catalogo', () => {
  test('toda categoria declarada tiene etiqueta, ejemplos y color', () => {
    for (const c of [...CATEGORIAS_EGRESO, ...CATEGORIAS_INGRESO]) {
      expect(CATEGORIAS[c].label.length).toBeGreaterThan(0)
      expect(CATEGORIAS[c].ejemplos.length).toBeGreaterThan(0)
      expect(CATEGORIAS[c].color).toMatch(/^bg-\S+ text-\S+$/)
    }
  })

  test('no hay categorias repetidas entre ingreso y egreso', () => {
    const cruce = CATEGORIAS_EGRESO.filter((c) =>
      (CATEGORIAS_INGRESO as readonly string[]).includes(c)
    )
    expect(cruce).toEqual([])
  })
})

describe('una categoria de egreso no puede usarse en un ingreso', () => {
  test('categoriasPara devuelve solo las del lado correcto', () => {
    expect(categoriasPara('egreso')).toContain('materia_prima')
    expect(categoriasPara('egreso')).not.toContain('impresion_offset')
    expect(categoriasPara('ingreso')).toContain('impresion_offset')
    expect(categoriasPara('ingreso')).not.toContain('materia_prima')
  })

  test('categoriaCoincideConTipo bloquea el cruce', () => {
    expect(categoriaCoincideConTipo('materia_prima', 'egreso')).toBe(true)
    expect(categoriaCoincideConTipo('materia_prima', 'ingreso')).toBe(false)
    expect(categoriaCoincideConTipo('impresion_offset', 'ingreso')).toBe(true)
    expect(categoriaCoincideConTipo('impresion_offset', 'egreso')).toBe(false)
  })
})

describe('tolerancia a datos viejos o sucios', () => {
  test('esCategoriaValida rechaza cualquier cosa ajena', () => {
    expect(esCategoriaValida('materia_prima')).toBe(true)
    expect(esCategoriaValida('papel')).toBe(false)
    expect(esCategoriaValida(null)).toBe(false)
    expect(esCategoriaValida(undefined)).toBe(false)
    expect(esCategoriaValida(42)).toBe(false)
  })

  test('etiquetaCategoria nunca revienta: null es "Sin clasificar"', () => {
    // Todos los movimientos ya registrados tienen categoria null.
    expect(etiquetaCategoria(null)).toBe('Sin clasificar')
    expect(etiquetaCategoria(undefined)).toBe('Sin clasificar')
    expect(etiquetaCategoria('sin_categoria')).toBe('Sin clasificar')
    expect(etiquetaCategoria('categoria_borrada')).toBe('Sin clasificar')
    expect(etiquetaCategoria('materia_prima')).toBe('Materia prima')
  })
})
