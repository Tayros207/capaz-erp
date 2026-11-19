import { useState } from 'react';
import { SelectorDeCliente } from '../../core/clientes/selector-de-cliente.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import type { Opcion } from '../../shared/ui/logica-selector.ts';

type Props = { abierto: boolean; alElegir: (clienteId: string) => void; alCerrar: () => void };

/** «Nueva guía» desde la lista de guías: se elige el cliente y se pasa al armado con sus pedidos pendientes. */
export function HojaElegirCliente({ abierto, alElegir, alCerrar }: Props) {
  const [cliente, setCliente] = useState<Opcion | null>(null);
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Nueva guía de remisión">
      {abierto ? (
        <div className="flex flex-col gap-4">
          <SelectorDeCliente valor={cliente} alCambiar={(o) => { setCliente(o); if (o) alElegir(o.id); }} ayuda="Elige al cliente: verás sus pedidos listos para enviar." />
        </div>
      ) : null}
    </HojaInferior>
  );
}
