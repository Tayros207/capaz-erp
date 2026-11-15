import { useSyncExternalStore } from 'react';
import { Boton } from './boton.tsx';
import { almacenDeConfirmacion, responderConfirmacion } from './confirmar.ts';
import { Dialogo } from './dialogo.tsx';

/** Diálogo de `confirmar()`: se monta una sola vez (en `Proveedores`). */
export function Confirmaciones() {
  const pedido = useSyncExternalStore(almacenDeConfirmacion.suscribir, almacenDeConfirmacion.leer, almacenDeConfirmacion.leer);
  const responder = (acepto: boolean) => pedido && responderConfirmacion(pedido, acepto);
  return (
    <Dialogo
      abierto={pedido !== null}
      alCerrar={() => responder(false)}
      titulo={pedido?.titulo ?? ''}
      acciones={
        <>
          <Boton onClick={() => responder(false)}>Cancelar</Boton>
          <Boton variante={pedido?.peligroso ? 'peligro' : 'primario'} onClick={() => responder(true)}>
            {pedido?.textoConfirmar}
          </Boton>
        </>
      }
    >
      <p>{pedido?.mensaje}</p>
    </Dialogo>
  );
}
