/** Cola en serie: cada tarea empieza cuando termina la anterior, falle o no. Las escrituras no se pisan. */
export function crearColaEnSerie() {
  let cola: Promise<unknown> = Promise.resolve();
  return function enSerie<T>(tarea: () => Promise<T>): Promise<T> {
    const solicitud = cola.then(tarea);
    cola = solicitud.then(
      () => undefined,
      () => undefined,
    );
    return solicitud;
  };
}
