import type { ListaDePrecioDto, ProductoCotizableDto } from '@capaz/shared';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EnlaceDeEntidad } from '../../shared/ui/entidades.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { REFERENCIAS, soles, resumenDeLista } from './logica.ts';
import { calcularParaMostrar, validarCantidadDeCatalogo } from './logica-catalogo.ts';

const PRECIO_DE: Record<(typeof REFERENCIAS)[number]['clave'], 'p100Centimos' | 'p1000Centimos' | 'p5000Centimos'> = {
  p100: 'p100Centimos', p1000: 'p1000Centimos', p5000: 'p5000Centimos',
};

export function PreciosDeLista({ lista }: { lista: ListaDePrecioDto }) {
  return (
    <section aria-label="Precios de la lista" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-lg font-semibold text-texto">{lista.productoId ? <EnlaceDeEntidad tipo="producto" id={lista.productoId}>{lista.nombre}</EnlaceDeEntidad> : lista.nombre}</h2>
        <Insignia tono="info">Precios por escala</Insignia>
        {lista.porRevisar ? <Insignia tono="aviso">Revisar precios</Insignia> : null}
      </div>
      <GrupoDeCifras etiqueta="Precios de referencia, sin IGV">
        {REFERENCIAS.map((r) => <Cifra key={r.clave} etiqueta={`${r.etiqueta} (sin IGV)`} valor={soles(lista[PRECIO_DE[r.clave]])} />)}
      </GrupoDeCifras>
      <p className="sr-only">{resumenDeLista(lista)}</p>
    </section>
  );
}

/** Producto sin lista: se cotiza con el precio del catálogo; el servidor recalcula al crear. */
export function PrecioDeCatalogo({ p, cantidad, igv, alFijar }: { p: ProductoCotizableDto; cantidad: number | null; igv: number | undefined; alFijar?: () => void }) {
  const unitario = p.precioCatalogoSinIgvMilesimas ?? 0;
  const c = cantidad !== null && igv !== undefined && validarCantidadDeCatalogo(cantidad) === undefined ? calcularParaMostrar(cantidad, unitario, igv) : null;
  return (
    <section aria-label="Precio del catálogo" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-lg font-semibold text-texto">{p.productoId ? <EnlaceDeEntidad tipo="producto" id={p.productoId}>{p.nombre}</EnlaceDeEntidad> : p.nombre}</h2>
        <Insignia tono="neutro">Precio del catálogo</Insignia>
        {alFijar ? <Boton variante="secundario" onClick={alFijar}>Fijar precios por escala</Boton> : null}
      </div>
      <GrupoDeCifras etiqueta="Precio de esta cantidad">
        <Cifra etiqueta={igv ? `Cada ${p.unidad} (sin IGV)` : `Cada ${p.unidad}`} valor={`S/ ${milesimasATexto(unitario)}`} />
        {c ? <Cifra etiqueta={igv ? 'Importe (sin IGV)' : 'Total'} valor={soles(c.importeCentimos)} {...(!igv && { tono: 'exito' as const })} /> : null}
        {c && igv ? <Cifra etiqueta={`IGV (${igv} %)`} valor={soles(c.igvCentimos)} /> : null}
        {c && igv ? <Cifra etiqueta="Total" valor={soles(c.totalCentimos)} tono="exito" /> : null}
      </GrupoDeCifras>
    </section>
  );
}
