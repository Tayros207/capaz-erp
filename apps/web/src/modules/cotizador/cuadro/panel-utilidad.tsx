import { useState } from 'react';
import { centimosSchema, type Centimos } from '@capaz/shared';
import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { fijarPrecioFinal, fijarUtilidad } from './api-cuadro.ts';
import { CampoAlSalir } from './campo-al-salir.tsx';
import { mostrarDecimal } from '../logica-taller.ts';
import { argumentosDeBaseDeUtilidad, argumentosDeDescuento, argumentosDePrecioFinal, argumentosDeUtilidad } from './logica-cuadro-precio.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** El precio final escrito a mano: se fija al salir del campo; vacío lo quita. */
function PrecioAMano({ precio, editable, alFijar }: { precio: number | null; editable: boolean; alFijar: (centimos: number | null) => void }) {
  const [valor, setValor] = useState<Centimos | null>(precio === null ? null : centimosSchema.parse(precio));
  return (
    <CampoMonto
      etiqueta="Precio final a mano (sin IGV)" valor={valor} disabled={!editable} alCambiar={setValor} ayuda="Si lo dejas vacío rige el precio sugerido."
      onBlur={() => { if (valor !== precio && (valor === null || valor > 0)) alFijar(valor); }}
    />
  );
}

/** Utilidad (porcentaje y base) y precio final a mano o con descuento. El servidor recalcula todo. Solo con permiso de costos. */
export function PanelUtilidad({ id, vista, aplicar, editable }: ContextoDelCuadro) {
  const u = vista.interno?.utilidad;
  const precio = vista.precioFinalCentimos;
  if (!u) return null;
  return (
    <Seccion titulo="Utilidad y precio final">
      <div className="grid grid-cols-2 gap-3">
        <CampoAlSalir
          etiqueta="Utilidad (%)" valor={mostrarDecimal(u.pct)} decimal deshabilitado={!editable}
          alConfirmar={async (t) => { const r = argumentosDeUtilidad(id, t); return 'error' in r ? r.error : (await aplicar(fijarUtilidad(r.args))) ? null : 'No se guardó.'; }}
        />
        <CampoSelect etiqueta="Se calcula sobre" value={u.base} disabled={!editable} onChange={(e) => void aplicar(fijarUtilidad(argumentosDeBaseDeUtilidad(id, e.target.value === 'costo' ? 'costo' : 'venta')))}>
          <option value="venta">El precio de venta</option>
          <option value="costo">El costo</option>
        </CampoSelect>
      </div>
      <PrecioAMano key={precio ?? 'sin-precio'} precio={precio} editable={editable} alFijar={(n) => void aplicar(fijarPrecioFinal(argumentosDePrecioFinal(id, { precioCentimos: n })))} />
      <CampoAlSalir
        etiqueta="Descuento sobre el precio sugerido (%)" valor="" decimal deshabilitado={!editable} ayuda="Escribe un porcentaje y se fija el precio final con ese descuento."
        alConfirmar={async (t) => { const r = argumentosDeDescuento(id, t); return 'error' in r ? r.error : (await aplicar(fijarPrecioFinal(r.args))) ? null : 'No se guardó.'; }}
      />
    </Seccion>
  );
}
