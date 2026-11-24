// Lector de un flujo SSE (`text/event-stream`) sin dependencias. Entrega el texto de cada línea `data:`.
// Salta los comentarios (líneas que empiezan por `:`, como `: OPENROUTER PROCESSING`) y aguanta que un trozo de red
// corte una línea por la mitad.

/** Quita el prefijo `data:` y un único espacio opcional. `null` si la línea no es de datos. */
function datosDeLinea(linea: string): string | null {
  if (!linea.startsWith('data:')) return null;
  const resto = linea.slice(5);
  return resto.startsWith(' ') ? resto.slice(1) : resto;
}

/**
 * `alLeer` se llama con CADA trozo de bytes que llega, también cuando solo trae comentarios: quien vigila el silencio del flujo
 * debe saber que el proveedor sigue vivo aunque todavía no mande datos (un modelo en cola manda `: OPENROUTER PROCESSING`).
 */
export async function* leerSse(cuerpo: ReadableStream<Uint8Array>, alLeer?: () => void): AsyncIterable<string> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      alLeer?.();
      pendiente += decodificador.decode(value, { stream: true });
      const lineas = pendiente.split('\n');
      pendiente = lineas.pop() ?? '';
      for (const cruda of lineas) {
        const datos = datosDeLinea(cruda.replace(/\r$/, ''));
        if (datos !== null) yield datos;
      }
    }
    // Lo que quedó sin salto de línea al final también cuenta.
    const ultimo = datosDeLinea((pendiente + decodificador.decode()).replace(/\r$/, ''));
    if (ultimo !== null) yield ultimo;
  } finally {
    // Si se sale antes de terminar (`[DONE]`, un aborto), se cancela el cuerpo para no dejar la conexión abierta.
    await lector.cancel().catch(() => undefined);
    lector.releaseLock();
  }
}
