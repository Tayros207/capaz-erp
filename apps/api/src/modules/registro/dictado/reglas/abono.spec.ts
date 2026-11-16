/**
 * RED DE SEGURIDAD — deteccion de abonos a deudas existentes.
 * Confundir un abono con un movimiento nuevo duplica plata en la contabilidad,
 * asi que este es el limite mas delicado del parser.
 */

import { describe, expect, test } from 'vitest'
import { esAbonoDeuda, contactoDeAbono } from './abono.js'

describe('esAbonoDeuda', () => {
  test('detecta pagos contra una deuda existente', () => {
    expect(esAbonoDeuda('Juan abona 100 soles de su deuda')).toBe(true)
    expect(esAbonoDeuda('me pagó 50 a cuenta')).toBe(true)
    expect(esAbonoDeuda('amortiza 200 la señora Cristina')).toBe(true)
    expect(esAbonoDeuda('me dio 80 de lo que me debe')).toBe(true)
  })

  test('un registro NUEVO con adelanto no es abono a deuda anterior', () => {
    // Critico: si esto se invirtiera, cada contrato con adelanto intentaria
    // descontarse de una deuda inexistente en vez de crear el movimiento.
    expect(esAbonoDeuda('Contrato 240, adelanto 100, cliente Cristina')).toBe(false)
    expect(esAbonoDeuda('trabajo por 500 con adelanto de 200')).toBe(false)
    expect(esAbonoDeuda('pedido de 300, anticipo 100')).toBe(false)
    expect(esAbonoDeuda('servicio de diseño 150 adelanto 50')).toBe(false)
  })

  test('un movimiento normal no es abono', () => {
    expect(esAbonoDeuda('Ingreso 500 soles, cliente Juan, flyers')).toBe(false)
    expect(esAbonoDeuda('Egreso 200 soles, proveedor Pacheco, cartulina')).toBe(false)
  })
})

describe('contactoDeAbono', () => {
  test('nombre antes del verbo', () => {
    expect(contactoDeAbono('Juan abona 100 soles de su deuda')).toBe('Juan')
    expect(contactoDeAbono('Juan Pablo Pérez abona 100 soles más de su deuda')).toBe(
      'Juan Pablo Pérez'
    )
  })

  test('nombre con titulo al final de la frase', () => {
    expect(contactoDeAbono('amortiza 200 la señora Cristina')).toBe('Cristina')
  })

  test('no confunde pronombres con nombres', () => {
    expect(contactoDeAbono('me pagó 50 a cuenta')).toBeNull()
    expect(contactoDeAbono('ya pagó 50')).toBeNull()
  })

  test('sin nombre reconocible devuelve null', () => {
    expect(contactoDeAbono('abonaron 100 soles')).toBeNull()
  })
})
