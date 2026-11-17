import { Cifra, GrupoDeCifras } from '../../../shared/ui/cifra.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_SEMAFORO, agruparPorFactor, textoDeImporte, textoDePorcentaje, textoDeUnitario } from './logica-cuadro.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

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
        <GrupoDeCifras etiqueta="Precio de la cantidad del trabajo">
          <Cifra etiqueta="Precio (sin IGV)" valor={textoDeImporte(c.precioCentimos)} tono="exito" />
          {c.impuesto ? <Cifra etiqueta={`${c.impuesto.nombre} ${textoDePorcentaje(c.impuesto.pct)}`} valor={textoDeImporte(c.impuesto.montoCentimos)} /> : null}
          <Cifra etiqueta="Total con impuesto" valor={textoDeImporte(c.totalConImpuestoCentimos)} />
          <Cifra etiqueta="Cada unidad (referencial)" valor={textoDeUnitario(c.unitarioMilesimas)} ayuda="Manda el total del lote." />
        </GrupoDeCifras>
      )}
      {interno ? (
        <>
          <GrupoDeCifras etiqueta="Costo y margen (solo para ti)">
            <Cifra etiqueta="Costo" valor={textoDeImporte(interno.costoCentimos)} />
            <Cifra etiqueta="Precio sugerido" valor={textoDeImporte(interno.precioSugeridoCentimos)} />
            <Cifra etiqueta="Utilidad" valor={textoDeImporte(interno.utilidadCentimos)} tono={interno.utilidadCentimos < 0 ? 'peligro' : 'neutro'} />
            <Cifra etiqueta="Margen" valor={textoDePorcentaje(interno.margenPct)} tono={interno.semaforo === 'rojo' ? 'peligro' : interno.semaforo === 'verde' ? 'exito' : 'aviso'} />
          </GrupoDeCifras>
          <dl aria-label="Costo por factor" className="flex flex-col gap-1 text-sm">
            {agruparPorFactor(vista).map((g) => (
              <div key={g.factor} className="flex justify-between gap-2"><dt className="text-texto-suave">{g.etiqueta}</dt><dd className="tabular-nums text-texto">{textoDeImporte(g.subtotalCentimos)}</dd></div>
            ))}
          </dl>
        </>
      ) : null}
    </Seccion>
  );
}
