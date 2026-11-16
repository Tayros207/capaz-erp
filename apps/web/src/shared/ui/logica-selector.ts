export type EstadoDeTeclado = { abierto: boolean; activo: number; total: number };
export type ResultadoDeTeclado = { abierto: boolean; activo: number; accion: 'ninguna' | 'elegir' | 'cerrar' };

/** Qué hace una tecla en el selector de registro. `activo` es -1 cuando ninguna opción está resaltada. */
export function teclaDelSelector(estado: EstadoDeTeclado, tecla: string): ResultadoDeTeclado {
  const { abierto, activo, total } = estado;
  const sigue = { abierto, activo, accion: 'ninguna' as const };
  switch (tecla) {
    case 'ArrowDown':
      if (!abierto) return { abierto: true, activo: total > 0 ? 0 : -1, accion: 'ninguna' };
      return { ...sigue, activo: total === 0 ? -1 : (activo + 1) % total };
    case 'ArrowUp':
      if (!abierto) return { abierto: true, activo: total > 0 ? total - 1 : -1, accion: 'ninguna' };
      return { ...sigue, activo: total === 0 ? -1 : activo <= 0 ? total - 1 : activo - 1 };
    case 'Home':
      return abierto && total > 0 ? { ...sigue, activo: 0 } : sigue;
    case 'End':
      return abierto && total > 0 ? { ...sigue, activo: total - 1 } : sigue;
    case 'Enter':
      return abierto && activo >= 0 && activo < total ? { abierto: false, activo: -1, accion: 'elegir' } : sigue;
    case 'Escape':
      return abierto ? { abierto: false, activo: -1, accion: 'cerrar' } : sigue;
    default:
      return sigue;
  }
}
