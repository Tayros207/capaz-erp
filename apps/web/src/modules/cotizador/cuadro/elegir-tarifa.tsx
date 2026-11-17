import { useRef } from 'react';
import type { TarifaDelTallerDto } from '@capaz/shared';
import { datosOError } from '../../../shared/api/consultas.ts';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { SelectorDeRegistro, type Opcion } from '../../../shared/ui/selector-de-registro.tsx';
import { listarTarifas } from '../api-taller.ts';
import { FACTORES, etiquetaDeEscala, mostrarDecimal, type Factor } from '../logica-taller.ts';

type Props = { factor: Factor; tarifa: TarifaDelTallerDto | null; error?: string; conCosto: boolean; alElegirFactor: (f: Factor) => void; alElegir: (t: TarifaDelTallerDto | null) => void };

/** Filtro por factor y selector de tarifa del taller; al elegir una se copian su nombre, unidad, costo y escala. */
export function ElegirTarifa({ factor, tarifa, error, conCosto, alElegirFactor, alElegir }: Props) {
  const tarifas = useRef(new Map<string, TarifaDelTallerDto>());
  async function buscar(texto: string): Promise<Opcion[]> {
    const { items } = datosOError(await listarTarifas({ buscar: texto, estado: 'activas', factor }));
    for (const t of items) tarifas.current.set(t.id, t);
    return items.map((t) => ({ id: t.id, nombre: t.nombre, detalle: `${etiquetaDeEscala(t.escalaPorDefecto)} · ${t.unidad}` }));
  }
  return (
    <>
      <CampoSelect etiqueta="Filtrar tarifas por factor" value={factor} onChange={(e) => alElegirFactor(e.target.value as Factor)}>
        {FACTORES.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
      </CampoSelect>
      <SelectorDeRegistro
        key={factor} etiqueta="Tarifa" valor={tarifa ? { id: tarifa.id, nombre: tarifa.nombre } : null} buscar={buscar} error={error}
        textoSinResultados="Ninguna tarifa se parece a eso" ayuda="Se copian nombre, unidad, costo y escala."
        alCambiar={(o) => alElegir(o ? (tarifas.current.get(o.id) ?? null) : null)}
      />
      {tarifa ? <p className="text-sm text-texto-suave">Unidad: {tarifa.unidad} · escala: {etiquetaDeEscala(tarifa.escalaPorDefecto)}{conCosto ? ` · S/ ${mostrarDecimal(tarifa.costoUnitario)}` : ''}</p> : null}
    </>
  );
}
