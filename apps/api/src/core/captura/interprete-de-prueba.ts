import type { InterpreteDeCaptura } from './tipos.js';

/** Intérprete fijo para las pruebas de la captura (modulo `registro`). No lo usa ningún código de producción. */
export const interpreteDePrueba: InterpreteDeCaptura = {
  modulo: 'registro',
  async interpretar(_tx, _ctx, e) {
    if (e.texto === 'nada') return { propuestas: [], faltan: ['el monto'], pista: 'Di el monto y si entró o salió, por ejemplo «cobré 50 soles».' };
    if (e.texto === 'ajena') {
      return { propuestas: [{ herramienta: 'pedido_crear', args: {}, resumen: 'Pedido ajeno' }], faltan: [], pista: null };
    }
    return {
      propuestas: [{ herramienta: 'movimiento_registrar', args: { tipo: 'ingreso', montoCentimos: 50000, origen: 'voz' }, resumen: 'Ingreso de S/ 500.00' }],
      faltan: [],
      pista: null,
    };
  },
};
