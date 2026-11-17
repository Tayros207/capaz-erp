import { useState } from 'react';
import type { TarifaDelTallerDto } from '@capaz/shared';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { archivarTarifa, listarTarifas } from './api-taller.ts';
import { FACTORES, etiquetaDeEscala, etiquetaDeFactor, mostrarDecimal, type Factor } from './logica-taller.ts';
import { HojaDeTarifa } from './taller-hoja-tarifa.tsx';
import { PanelDelTaller } from './taller-panel.tsx';

const columnas: Array<Columna<TarifaDelTallerDto>> = [
  { id: 'nombre', titulo: 'Tarifa', principal: true, celda: (t) => t.nombre },
  { id: 'factor', titulo: 'Factor', celda: (t) => etiquetaDeFactor(t.factor) },
  { id: 'costo', titulo: 'Costo', alinear: 'derecha', celda: (t) => `${mostrarDecimal(t.costoUnitario)} por ${t.unidad}` },
  { id: 'escala', titulo: 'Escala', celda: (t) => etiquetaDeEscala(t.escalaPorDefecto).replace(/ \(.*\)$/, '') },
];

/** Tarifas del taller: lo que cuesta cada material o servicio. El costo se muestra tal cual, sin redondear. */
export function PanelDeTarifas({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const [factor, setFactor] = useState<Factor | ''>('');
  const [hoja, setHoja] = useState<{ tarifa: TarifaDelTallerDto | null } | null>(null);
  return (
    <>
      <PanelDelTaller<TarifaDelTallerDto>
        clave="tarifas"
        etiqueta="tarifas"
        puedeConfigurar={puedeConfigurar}
        columnas={columnas}
        textoNuevo="Nueva tarifa"
        vacioTitulo="Todavía no hay tarifas"
        vacioDescripcion="Anota lo que cuesta tu papel, tus planchas, la hora de máquina y los acabados. También puedes cargar los valores de ejemplo."
        claveExtra={factor}
        cargar={async (estado, buscar, cursor) => listarTarifas({ estado, ...(buscar !== '' && { buscar }), ...(factor !== '' && { factor }) }, cursor)}
        filtroExtra={
          <CampoSelect etiqueta="Factor" value={factor} onChange={(e) => setFactor(e.target.value as Factor | '')}>
            <option value="">Todos</option>
            {FACTORES.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
          </CampoSelect>
        }
        onNuevo={() => setHoja({ tarifa: null })}
        onEditar={(t) => setHoja({ tarifa: t })}
        archivar={archivarTarifa}
      />
      <HojaDeTarifa abierto={hoja !== null} tarifa={hoja?.tarifa ?? null} alCerrar={() => setHoja(null)} />
    </>
  );
}
