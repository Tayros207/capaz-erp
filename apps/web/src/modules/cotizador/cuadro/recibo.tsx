import { Cifra } from '../../../shared/ui/cifra.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { unir } from '../../../shared/ui/unir.ts';
import { ETIQUETA_DE_SEMAFORO, agruparPorFactor, textoDeImporte, textoDePorcentaje, textoDeUnitario } from './logica-cuadro.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

const TONOS_DE_RENGLON = { neutro: ['text-texto', ''], exito: ['text-exito', 'Favorable'], peligro: ['text-peligro', 'Atención'], aviso: ['text-aviso', 'Pendiente'] } as const;

/** Un renglón del recibo: el recibo vive en una columna angosta, así que la etiqueta va a la izquierda y el importe a la derecha. */
function Renglon({ etiqueta, valor, tono = 'neutro', ayuda }: { etiqueta: string; valor: string; tono?: keyof typeof TONOS_DE_RENGLON; ayuda?: string }) {
  const [color, texto] = TONOS_DE_RENGLON[tono];
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-texto-suave">{etiqueta}</dt>
      <dd className={unir('ml-auto font-semibold whitespace-nowrap tabular-nums', color)}>
        {valor}
        {texto ? <span className="sr-only"> ({texto})</span> : null}
      </dd>
      {ayuda ? <dd className="w-full text-xs text-texto-suave">{ayuda}</dd> : null}
    </div>
  );
}

/** El recibo: lo comercial lo ve cualquiera; costo por factor, utilidad, margen y semáforo, solo con permiso de costos. */
export function Recibo({ vista, costos }: ContextoDelCuadro) {
  const c = vista.comercial;
  const interno = costos ? vista.interno?.costos : null;
  const semaforo = interno?.semaforo ? ETIQUETA_DE_SEMAFORO[interno.semaforo] : null;
  return (
    <Seccion titulo="Recibo" accion={semaforo ? <Insignia tono={semaforo.tono}>{semaforo.texto}</Insignia> : undefined}>
      {c === null ? (
        <p role="status" className="text-sm text-texto-suave">Todavía no se puede calcular el precio: completa los datos del trabajo, la imposición y las filas.</p>
      ) : (
        <div role="group" aria-label="Precio de la cantidad del trabajo" className="flex flex-col gap-3">
          <Cifra etiqueta="Precio (sin IGV)" valor={textoDeImporte(c.precioCentimos)} tono="exito" />
          <dl className="flex flex-col gap-1 text-sm">
            {c.impuesto ? <Renglon etiqueta={`${c.impuesto.nombre} ${textoDePorcentaje(c.impuesto.pct)}`} valor={textoDeImporte(c.impuesto.montoCentimos)} /> : null}
            <Renglon etiqueta="Total con impuesto" valor={textoDeImporte(c.totalConImpuestoCentimos)} />
            <Renglon etiqueta="Cada unidad (referencial)" valor={textoDeUnitario(c.unitarioMilesimas)} ayuda="Manda el total del lote." />
          </dl>
        </div>
      )}
      {interno ? (
        <>
          <dl role="group" aria-label="Costo y margen (solo para ti)" className="flex flex-col gap-1 border-t border-borde pt-3 text-sm">
            <Renglon etiqueta="Costo" valor={textoDeImporte(interno.costoCentimos)} />
            <Renglon etiqueta="Precio sugerido" valor={textoDeImporte(interno.precioSugeridoCentimos)} />
            <Renglon etiqueta="Utilidad" valor={textoDeImporte(interno.utilidadCentimos)} tono={interno.utilidadCentimos < 0 ? 'peligro' : 'neutro'} />
            <Renglon etiqueta="Margen" valor={textoDePorcentaje(interno.margenPct)} tono={interno.semaforo === 'rojo' ? 'peligro' : interno.semaforo === 'verde' ? 'exito' : 'aviso'} />
          </dl>
          <dl aria-label="Costo por factor" className="flex flex-col gap-1 border-t border-borde pt-3 text-sm">
            {agruparPorFactor(vista).map((g) => (
              <div key={g.factor} className="flex justify-between gap-2"><dt className="text-texto-suave">{g.etiqueta}</dt><dd className="tabular-nums text-texto">{textoDeImporte(g.subtotalCentimos)}</dd></div>
            ))}
          </dl>
        </>
      ) : null}
    </Seccion>
  );
}
