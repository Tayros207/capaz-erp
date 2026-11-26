import type { ReactNode } from 'react';
import type { ConfiguracionDelAgente, ModeloDelCatalogo } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { etiquetasDeModelo } from './logica-modelos.ts';
import { formatoUsd } from './logica-uso.ts';
import { TARJETA } from './piezas-de-vista.tsx';

type Props = {
  configuracion: ConfiguracionDelAgente;
  catalogo: readonly ModeloDelCatalogo[];
  preciosDisponibles: boolean;
  /** Solo quien puede configurar la empresa cambia el modelo; los demás lo ven. */
  puedeConfigurar: boolean;
  ocupado: boolean;
  /** `null` vuelve al modelo del sistema. */
  alElegir: (modelo: string | null) => void;
};

const DE_CUIDADO = new Set(['Sin evaluar', 'Revisar privacidad', 'No disponible hoy']);

function Etiquetas({ m }: { m: ModeloDelCatalogo }): ReactNode {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {etiquetasDeModelo(m).map((e) => (
        <li key={e} className={unir('rounded-full px-2.5 py-0.5 text-xs', DE_CUIDADO.has(e) ? 'bg-aviso/12 text-aviso' : 'bg-superficie-alta text-texto-suave')}>{e}</li>
      ))}
    </ul>
  );
}

function FilaDeModelo({ m, activo, puedeConfigurar, ocupado, alElegir }: { m: ModeloDelCatalogo; activo: boolean } & Pick<Props, 'puedeConfigurar' | 'ocupado' | 'alElegir'>): ReactNode {
  const bloqueado = !puedeConfigurar || ocupado || !m.disponible;
  return (
    <li className={unir(TARJETA, 'flex flex-col gap-2.5 p-4', activo && 'border-asistente-2! bg-asistente-2/10!')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-texto">{m.nombre}</p>
          <p className="text-xs leading-snug text-texto-suave">{m.descripcion}</p>
        </div>
        {activo ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-linear-135 from-asistente-hondo-1 to-asistente-hondo-2 px-2.5 py-1 text-xs font-semibold text-white">
            <Icono nombre="check" className="size-3.5" />
            Activo
          </span>
        ) : null}
      </div>
      <Etiquetas m={m} />
      {activo ? null : (
        <Boton variante="secundario" className="rounded-full" disabled={bloqueado} onClick={() => alElegir(m.id)} aria-label={`Usar ${m.nombre}`}>Usar este modelo</Boton>
      )}
    </li>
  );
}

/** El gasto del mes contra el tope, escrito y con una barra que se pone en aviso cerca del final. */
function Gasto({ configuracion, preciosDisponibles }: Pick<Props, 'configuracion' | 'preciosDisponibles'>): ReactNode {
  const { gastoDelMesMicrousd: gasto, topeEfectivoMicrousd: tope } = configuracion;
  const avance = tope > 0 ? Math.min(1, gasto / tope) : 1;
  return (
    <div className={unir(TARJETA, 'flex flex-col gap-2 p-4 text-sm')}>
      <p className="font-semibold text-texto tabular-nums">{`Gasto de este mes: ${formatoUsd(gasto)} de ${formatoUsd(tope)}`}</p>
      <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-superficie-alta">
        <span className={unir('block h-full origin-left rounded-full', avance >= 0.8 ? 'bg-aviso' : 'bg-linear-90 from-asistente-1 to-asistente-2')} style={{ transform: `scaleX(${avance})` }} />
      </span>
      {preciosDisponibles ? null : <p className="text-xs text-texto-suave">No se pudieron consultar los precios ahora mismo.</p>}
    </div>
  );
}

/**
 * El selector de modelo del asistente. Cambiar el modelo es una acción crítica: al elegir, el servidor redacta un resumen y la
 * persona lo confirma. Un modelo sin evaluar actúa igual: la fila lo dice antes de elegirlo y la bitácora permite revisarlo.
 */
export function SelectorDeModelo({ configuracion, catalogo, preciosDisponibles, puedeConfigurar, ocupado, alElegir }: Props): ReactNode {
  return (
    <section aria-label="Modelo del asistente" className="flex flex-col gap-3">
      <Gasto configuracion={configuracion} preciosDisponibles={preciosDisponibles} />
      {puedeConfigurar ? null : <p role="note" className="px-1 text-xs text-texto-suave">Solo quien administra la empresa puede cambiar el modelo.</p>}
      <ul className="flex flex-col gap-2">
        {catalogo.map((m) => (
          <FilaDeModelo key={m.id} m={m} activo={m.id === configuracion.modeloEfectivo} puedeConfigurar={puedeConfigurar} ocupado={ocupado} alElegir={alElegir} />
        ))}
      </ul>
      {configuracion.modelo === null ? null : (
        <Boton variante="fantasma" className="rounded-full" disabled={!puedeConfigurar || ocupado} onClick={() => alElegir(null)}>Volver al modelo del sistema</Boton>
      )}
    </section>
  );
}
