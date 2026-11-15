export type PedidoDeConfirmacion = {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  peligroso: boolean;
  resolver: (acepto: boolean) => void;
};

let actual: PedidoDeConfirmacion | null = null;
const oyentes = new Set<() => void>();

function fijar(pedido: PedidoDeConfirmacion | null) {
  actual = pedido;
  oyentes.forEach((o) => o());
}

/** Pregunta antes de una acción importante. Devuelve `true` si la persona acepta. Lo dibuja `<Confirmaciones />`. */
export function confirmar(
  titulo: string,
  mensaje: string,
  opciones: { textoConfirmar?: string; peligroso?: boolean } = {},
): Promise<boolean> {
  actual?.resolver(false); // una confirmación nueva cancela la pendiente
  return new Promise((resolver) => {
    fijar({ titulo, mensaje, textoConfirmar: opciones.textoConfirmar ?? 'Confirmar', peligroso: opciones.peligroso ?? false, resolver });
  });
}

/** Cierra el pedido dado con la respuesta (si sigue siendo el actual). */
export function responderConfirmacion(pedido: PedidoDeConfirmacion, acepto: boolean): void {
  pedido.resolver(acepto);
  if (actual === pedido) fijar(null);
}

/** Para `useSyncExternalStore` de `<Confirmaciones />`. */
export const almacenDeConfirmacion = {
  suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => void oyentes.delete(oyente);
  },
  leer: () => actual,
};
