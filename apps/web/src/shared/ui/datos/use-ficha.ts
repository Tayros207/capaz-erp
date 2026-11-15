import { useReducer } from 'react';
import { FICHA_INICIAL, reducirFicha } from './logica-ficha.ts';

/** Estado de una `Ficha`: modo, cambios sin guardar y guardado en curso. */
export function useFicha() {
  const [estado, enviar] = useReducer(reducirFicha, FICHA_INICIAL);
  return { estado, enviar };
}
