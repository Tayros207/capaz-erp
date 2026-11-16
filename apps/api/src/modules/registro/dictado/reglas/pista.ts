import {
  todosLosMontosEnCentimos,
  inferirTipo,
  montoACentimos,
} from './monto.js'

function tieneMonto(text: string): boolean {
  return (
    todosLosMontosEnCentimos(text).length > 0 || montoACentimos(text) !== null
  )
}

/** Mensaje guiado cuando la intención es clara pero faltan datos */
export function pistaDeDictadoIncompleto(text: string): string {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  if (/^trato$/i.test(trimmed)) {
    return '¿Quisiste decir "contrato"? Dime valor, adelanto y cliente. Ej: "Contrato 240 soles adelanto 100 cliente Cristina"'
  }

  const esContrato =
    /\b(contrato|trato|trabajo|pedido|servicio|flyers|tarjetas|banners)\b/.test(lower) ||
    /\b(anota|anotar|registra|registrar|apunta|apuntar)\b/.test(lower)

  const tipo = inferirTipo(text)

  if (esContrato && !tieneMonto(text)) {
    return 'Entiendo un contrato o trabajo. Dime el monto y, si hubo adelanto, el cliente. Ejemplo:\n"Contrato 240 soles, adelanto 100, cliente Cristina"'
  }

  if (tipo === 'ingreso' && !tieneMonto(text)) {
    return '¿Cuánto fue el ingreso? Ejemplo: "Ingreso 500 soles de Juan por flyers"'
  }

  if (tipo === 'egreso' && !tieneMonto(text)) {
    return '¿Cuánto fue el egreso? Ejemplo: "Egreso 200 soles en tinta"'
  }

  if (/\b(abono|adelanto|anticipo)\b/.test(lower) && !tieneMonto(text)) {
    return '¿Cuánto abonó? Ejemplo: "Abono 100 soles de Cristina por el contrato de flyers"'
  }

  return 'No detecté el monto. Prueba en una frase: "Ingreso 500 soles de Juan" o "Contrato 240 adelanto 100 cliente Cristina"'
}
