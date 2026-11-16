/**
 * Deteccion local de cotizaciones. Cubre el camino que corre cuando el LLM no
 * responde: sin esto, pedir una proforma con OpenRouter caido no hacia nada.
 */

import { describe, expect, test } from 'vitest'
import { esProforma, contactoDeProforma } from './proforma.js'

describe('esProforma', () => {
  test('reconoce las formas de pedir una cotizacion', () => {
    expect(esProforma('Hazle una proforma a Juan por 500 tarjetas a 180 soles')).toBe(true)
    expect(esProforma('cotiza a Pacheco 1000 volantes en 250')).toBe(true)
    expect(esProforma('/proforma Maria 300')).toBe(true)
    expect(esProforma('presupuesto para Rosa de 1 banner a 90')).toBe(true)
    expect(esProforma('necesito una cotización para Carlos')).toBe(true)
    expect(esProforma('cotízale a la señora Cristina 200 volantes')).toBe(true)
  })

  test('un movimiento normal NO es cotizacion', () => {
    // Critico: si esto se invirtiera, los ingresos dejarian de registrarse.
    expect(esProforma('Ingreso 500 soles, cliente Juan, flyers')).toBe(false)
    expect(esProforma('Egreso 200 soles, proveedor Pacheco, cartulina')).toBe(false)
    expect(esProforma('Contrato 240, adelanto 100, cliente Cristina')).toBe(false)
  })

  test('un abono a deuda NO es cotizacion', () => {
    expect(esProforma('Juan abona 100 soles de su deuda')).toBe(false)
    expect(esProforma('me pagó 50 a cuenta')).toBe(false)
  })

  test('las consultas no son cotizaciones', () => {
    expect(esProforma('/hoy')).toBe(false)
    expect(esProforma('/deudas clientes')).toBe(false)
  })
})

describe('contactoDeProforma', () => {
  test('nombre tras "a" o "para"', () => {
    expect(contactoDeProforma('Hazle una proforma a Juan por 500 tarjetas')).toBe('Juan')
    expect(contactoDeProforma('proforma para Rosa Diaz de 1 banner a 90')).toBe('Rosa Diaz')
    expect(
      contactoDeProforma('Hazle una proforma a Cristian Neira por 500 tarjetas a 180 soles')
    ).toBe('Cristian Neira')
  })

  test('comando corto', () => {
    expect(contactoDeProforma('/proforma Maria 300')).toBe('Maria')
  })

  test('verbo cotizar sin la palabra proforma', () => {
    expect(contactoDeProforma('cotiza a Pacheco 1000 volantes en 250')).toBe('Pacheco')
  })

  test('descarta articulos y palabras de dinero como nombre', () => {
    expect(contactoDeProforma('hazle una proforma a un cliente por 100')).not.toBe('un')
    expect(contactoDeProforma('proforma de 500 soles')).toBeNull()
  })

  test('sin nombre reconocible devuelve null', () => {
    expect(contactoDeProforma('necesito una proforma')).toBeNull()
  })
})

describe('contactoDeProforma — nombre pegado a la palabra clave', () => {
  // El modo Proforma antepone "Proforma " y el usuario dicta el nombre
  // directo, sin "a" ni "para": es el formato que ensena el campo de texto.
  // Sin estos patrones la cotizacion salia sin cliente.

  test('nombre tras la palabra clave, cortado por la coma', () => {
    expect(contactoDeProforma('Proforma Juan, 500 tarjetas, 180 soles')).toBe('Juan')
    expect(contactoDeProforma('Proforma Rosa, 2 millares de volantes, 250 soles')).toBe('Rosa')
    expect(contactoDeProforma('Proforma Pacheco, 1 banner, 90')).toBe('Pacheco')
  })

  test('nombre tras la palabra clave, cortado por la cantidad', () => {
    expect(contactoDeProforma('Proforma Juan 500 tarjetas a 180')).toBe('Juan')
  })

  test('la preposicion sigue teniendo prioridad', () => {
    expect(contactoDeProforma('Proforma para Juan, 500 tarjetas, 180 soles')).toBe('Juan')
    expect(contactoDeProforma('Proforma a Juan por 500 tarjetas a 180 soles')).toBe('Juan')
  })

  test('apellidos y tildes se devuelven como se escribieron', () => {
    expect(contactoDeProforma('Proforma Juan Pérez, 500 tarjetas, 180 soles')).toBe(
      'Juan Pérez'
    )
    expect(contactoDeProforma('Proforma señora Cristina, 500 tarjetas, 180 soles')).toBe(
      'Cristina'
    )
  })

  test('una preposicion nunca es el cliente', () => {
    // Sin la lista de descartes, admitir el nombre sin preposicion hacia que
    // "proforma de 500 soles" devolviera "de" como nombre del cliente.
    expect(contactoDeProforma('proforma de 500 soles')).toBeNull()
    expect(contactoDeProforma('Proforma 500 tarjetas a 180')).toBeNull()
    expect(contactoDeProforma('proforma por 180')).toBeNull()
  })
})
