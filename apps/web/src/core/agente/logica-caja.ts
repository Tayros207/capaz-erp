// Reglas de teclado de la caja de mensaje. Aparte del componente para probarlas sin navegador.

type TeclaDeCaja = { key: string; shiftKey: boolean; isComposing?: boolean };

/**
 * Enter envía; Mayús+Enter salta de línea. Mientras el teclado compone texto (acentos, teclado de móvil)
 * el Enter es de la composición y no debe enviar.
 */
export function teclaDeEnvio(e: TeclaDeCaja): 'enviar' | 'salto' | null {
  if (e.key !== 'Enter' || e.isComposing === true) return null;
  return e.shiftKey ? 'salto' : 'enviar';
}

/** El botón de enviar solo vale con texto y sin una respuesta en curso. */
export const puedeEnviar = (valor: string, ocupado: boolean): boolean => !ocupado && valor.trim().length > 0;
