import { lazy, Suspense } from 'react';

// La sección de cotizaciones de la ficha del cliente se descarga solo cuando la ficha la dibuja.
const SeccionCotizaciones = lazy(async () => ({
  default: (await import('./seccion-cotizaciones-de-cliente.tsx')).SeccionCotizacionesDeCliente,
}));

export function SeccionCotizacionesDiferida({ clienteId }: { clienteId: string }) {
  return (
    <Suspense fallback={null}>
      <SeccionCotizaciones clienteId={clienteId} />
    </Suspense>
  );
}
