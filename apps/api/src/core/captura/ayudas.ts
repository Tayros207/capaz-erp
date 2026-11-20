import type { Ayuda } from '@capaz/shared';

export const AYUDAS = {
  proponer: {
    titulo: 'Dictar o escribir una frase para registrarla',
    paraQueSirve: 'Convierte lo que dictas o escribes en borradores que esperan tu aprobación. No registra nada por sí sola.',
    cuandoUsarla: 'Cuando quieras anotar un ingreso, un gasto, una deuda o un pedido hablando o escribiendo en lenguaje corriente.',
    campos: [
      { nombre: 'texto', queSeAnota: 'La frase tal como la dijiste o la escribiste (hasta 500 caracteres).', ejemplo: 'Cobré 500 soles de la impresión de tarjetas' },
      { nombre: 'origen', queSeAnota: 'voz si la dictaste, texto si la escribiste.', ejemplo: 'voz' },
      { nombre: 'transcurridoMs', queSeAnota: 'Milisegundos desde que empezaste a dictar o escribir hasta que enviaste.', ejemplo: '8000' },
      { nombre: 'modulo', queSeAnota: 'Módulo para el que dictas (opcional; hoy solo registro, que también propone pedidos).', ejemplo: 'registro' },
      { nombre: 'modo', queSeAnota: 'ingreso o egreso si ya lo elegiste con el botón (opcional).', ejemplo: 'ingreso' },
    ],
    ejemploTecleado: 'cobré 500 de las tarjetas',
    ejemploHablado: 'ayer pagué 120 soles de luz',
    erroresComunes: [
      'No puedes dictar para un módulo al que no entras o en el que solo puedes leer.',
      'Para dictar un pedido necesitas poder registrar en Pedidos.',
      'Hace falta el permiso de lo que se propone: nadie propone lo que no podría aprobar.',
      'Si no se entiende la frase, no se guarda nada y se te dice qué falta.',
    ],
    relacionadas: ['borradores_listar', 'borrador_aprobar', 'borrador_corregir'],
  },
} as const satisfies Record<string, Ayuda>;
