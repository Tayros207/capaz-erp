import type { ReactNode } from 'react';
import { textoDeUso } from './logica-uso.ts';
import type { UsoMostrado } from './use-turno.ts';

/** Una línea discreta bajo la respuesta con lo que costó el turno: tokens, duración y dólares. El modelo va en el título (al pasar el cursor). */
export function InsigniaDeUso({ uso }: { uso: UsoMostrado }): ReactNode {
  return (
    <p className="text-right text-xs text-texto-suave" title={`Modelo: ${uso.modelo}`}>
      {textoDeUso(uso)}
    </p>
  );
}
