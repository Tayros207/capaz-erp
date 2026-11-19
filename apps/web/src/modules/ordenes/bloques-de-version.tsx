import type { CorreccionDePedidoDto } from '@capaz/shared';
import { lineasDeCambio, textoDeMotivo } from './huella-de-correccion.ts';

/** Recuadro «Qué cambió» de un documento de una versión corregida: antes → después, sin salirse de la hoja impresa. */
export function RecuadroQueCambio({ correccion }: { correccion: CorreccionDePedidoDto }) {
  return (
    <section className="evitar-corte border border-black p-2 text-[9pt]" aria-label="Qué cambió">
      <h2 className="mb-1 text-[10pt] font-bold uppercase">Qué cambió respecto a la versión {correccion.versionAnterior}</h2>
      <p className="mb-1">Motivo: {textoDeMotivo(correccion.motivoCodigo, correccion.motivoTexto)}</p>
      <ul className="flex flex-col gap-0.5">
        {lineasDeCambio(correccion).map((l) => <li key={l} className="break-words">{l}</li>)}
      </ul>
    </section>
  );
}

/** Sello bien visible (también en papel, en blanco y negro) para una versión que ya no vale. */
export function SelloDeReemplazada({ texto }: { texto: string }) {
  return (
    <p role="note" className="evitar-corte border-4 border-double border-black p-2 text-center text-[16pt] font-extrabold uppercase tracking-widest">
      {texto}
    </p>
  );
}
