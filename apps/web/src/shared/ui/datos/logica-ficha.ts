// Estado de una Ficha (lectura o edición con cambios sin guardar). Puro, sin React.

export type ModoDeFicha = 'lectura' | 'edicion';
export type EstadoDeFicha = { modo: ModoDeFicha; sucio: boolean; guardando: boolean };
export type AccionDeFicha = 'editar' | 'cambio' | 'guardar' | 'guardado' | 'fallo' | 'descartar';

export const FICHA_INICIAL: EstadoDeFicha = { modo: 'lectura', sucio: false, guardando: false };

export function reducirFicha(estado: EstadoDeFicha, accion: AccionDeFicha): EstadoDeFicha {
  switch (accion) {
    case 'editar':
      return estado.modo === 'lectura' ? { ...estado, modo: 'edicion' } : estado;
    case 'cambio':
      return estado.modo === 'edicion' ? { ...estado, sucio: true } : estado;
    case 'guardar':
      return estado.modo === 'edicion' && !estado.guardando ? { ...estado, guardando: true } : estado;
    case 'guardado':
      return estado.guardando ? FICHA_INICIAL : estado;
    case 'fallo': // el guardado falló: se sigue editando, sin perder lo escrito
      return { ...estado, guardando: false };
    case 'descartar':
      return estado.guardando ? estado : FICHA_INICIAL;
  }
}

/** Descartar con cambios pide confirmación; sin cambios se descarta directo. */
export function descartarPideConfirmar(estado: EstadoDeFicha): boolean {
  return estado.modo === 'edicion' && estado.sucio;
}
