import { SeccionComercial } from './seccion-comercial.tsx';
import { SeccionContactos } from './seccion-contactos.tsx';
import { SeccionDirecciones } from './seccion-direcciones.tsx';

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <h2 className="text-base font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

/** Lo que una empresa grande anota de un cliente o proveedor, debajo de sus datos básicos. */
export function SeccionesAmpliadasDeCliente({ clienteId, puedeEditar }: { clienteId: string; puedeEditar: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Bloque titulo="Condiciones comerciales"><SeccionComercial clienteId={clienteId} puedeEditar={puedeEditar} /></Bloque>
      <Bloque titulo="Contactos"><SeccionContactos clienteId={clienteId} puedeEditar={puedeEditar} /></Bloque>
      <Bloque titulo="Direcciones"><SeccionDirecciones clienteId={clienteId} puedeEditar={puedeEditar} /></Bloque>
    </div>
  );
}
