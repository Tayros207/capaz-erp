import { Boton } from '../../shared/ui/boton.tsx';

type Props = { codigo: string; puedeEnlace: boolean; puedeNuevaVersion: boolean; alImprimir: () => void; alEnlace: () => void; alNuevaVersion: () => void };

/** Con la cotización ya emitida: lo que sigue es entregarla (imprimir o enlace) o rehacerla (nueva versión). */
export function CajaEmitida({ codigo, puedeEnlace, puedeNuevaVersion, alImprimir, alEnlace, alNuevaVersion }: Props) {
  return (
    <section aria-label="Cotización emitida" className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <div className="flex flex-col gap-1">
        <h2 className="font-titulo font-semibold text-texto">Cotización emitida</h2>
        <p className="text-sm text-texto-suave">{codigo} ya tiene número y no se edita. Entrégala al cliente o, si hay cambios, haz una nueva versión.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={alImprimir}>Imprimir</Boton>
        {puedeEnlace ? <Boton onClick={alEnlace}>Enlace para el cliente</Boton> : null}
        {puedeNuevaVersion ? <Boton onClick={alNuevaVersion}>Nueva versión</Boton> : null}
      </div>
    </section>
  );
}
