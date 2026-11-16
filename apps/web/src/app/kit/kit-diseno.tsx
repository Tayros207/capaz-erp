import { MemoryRouter } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { ChipDeCliente, EnlaceDeEntidad, InsigniaDeEstado } from '../../shared/ui/entidades.tsx';
import { notificar } from '../../shared/ui/notificar.ts';

/** Piezas del rediseño: avisos de Sonner, entidades enlazables y estados coherentes. La paleta de comandos se abre con Ctrl K. */
export function KitDiseno() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-borde pb-1 font-titulo text-xl font-semibold">Diseño compartido (módulos conectados)</h2>
      <p className="text-sm text-texto-suave">
        Los módulos usan estas piezas para verse y conectarse igual: <code>EnlaceDeEntidad</code>, <code>ChipDeCliente</code>,{' '}
        <code>InsigniaDeEstado</code> y <code>notificar</code> (único sistema de avisos, Sonner). Ctrl K abre la paleta de comandos.
      </p>
      <MemoryRouter>
        <div className="flex flex-wrap items-center gap-3">
          <ChipDeCliente id="demo" nombre="Imprenta Los Andes" />
          <EnlaceDeEntidad tipo="pedido" id="demo">Pedido P-0012</EnlaceDeEntidad>
          <EnlaceDeEntidad tipo="deuda" id="demo">Deuda D-0007</EnlaceDeEntidad>
        </div>
      </MemoryRouter>
      <div className="flex flex-wrap gap-2">
        {['Pagada', 'Entregado', 'Vencida', 'Anulada', 'Pendiente', 'Borrador', 'En producción', 'Otro'].map((e) => <InsigniaDeEstado key={e} estado={e} />)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => notificar('Guardado correctamente.', 'exito')}>Aviso de éxito</Boton>
        <Boton onClick={() => notificar('Revisa los datos antes de seguir.', 'aviso')}>Aviso</Boton>
        <Boton onClick={() => notificar('No se pudo guardar.', 'error')}>Aviso de error</Boton>
      </div>
    </section>
  );
}
