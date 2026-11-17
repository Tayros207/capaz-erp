import { useState } from 'react';
import { Boton } from '../../../shared/ui/boton.tsx';
import { HojaDeReferencias } from './hoja-referencias.tsx';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** Atajo a «Precios 100 / 1.000 / 5.000»: se calculan en el servidor y se pueden guardar en la lista de precios. */
export function PreciosDeReferencia(ctx: ContextoDelCuadro) {
  const [abierta, setAbierta] = useState(false);
  return (
    <Seccion titulo="Lista de precios">
      <p className="text-sm text-texto-suave">Con este cuadro se calculan los precios para 100, 1.000 y 5.000 unidades, y se pueden guardar como precios por escala de un producto.</p>
      <div><Boton variante="secundario" disabled={ctx.vista.comercial === null} onClick={() => setAbierta(true)}>Precios 100 / 1.000 / 5.000</Boton></div>
      <HojaDeReferencias ctx={ctx} abierta={abierta} alCerrar={() => setAbierta(false)} />
    </Seccion>
  );
}
