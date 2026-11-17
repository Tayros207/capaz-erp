import { useState } from 'react';
import { useParams } from 'react-router';
import { Boton } from '../../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { unir } from '../../../shared/ui/unir.ts';
import { usePermisosDeCotizaciones } from '../acciones-cotizacion.ts';
import { HojaMotivo } from '../hoja-motivo.tsx';
import { Cargando } from '../marco.tsx';
import { usePermisosDelCotizador } from '../use-cotizador.ts';
import { BarraInferior } from './barra-inferior.tsx';
import { CajaEmitida } from './caja-emitida.tsx';
import { CuadroDirecto } from './cuadro-directo.tsx';
import { DesgloseDePliegos } from './desglose-de-pliegos.tsx';
import { estaEnBorrador, sePuedeEmitir, type Pestana } from './logica-cuadro.ts';
import { PanelFactores } from './panel-factores.tsx';
import { PanelImposicion } from './panel-imposicion.tsx';
import { PanelTrabajo } from './panel-trabajo.tsx';
import { PanelUtilidad } from './panel-utilidad.tsx';
import { PestanasDelCuadro } from './pestanas-del-cuadro.tsx';
import { PreciosDeReferencia } from './precios-de-referencia.tsx';
import { Recibo } from './recibo.tsx';
import { useCuadro, type ContextoDelCuadro } from './use-cuadro.ts';
import { useEmision } from './use-emision.ts';

const columna = (activa: Pestana, esta: Pestana) => unir('min-w-0 flex-col gap-4 xl:flex', activa === esta ? 'flex' : 'hidden');

function Contenido({ ctx }: { ctx: ContextoDelCuadro }) {
  const [pestana, setPestana] = useState<Pestana>('trabajo');
  const emision = useEmision(ctx);
  const { vista } = ctx;
  const puedeEmitir = ctx.emitir && sePuedeEmitir(vista);
  const emitida = !estaEnBorrador(vista);
  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      <EncabezadoDePagina
        titulo={vista.trabajo.producto || 'Cotización por partes'}
        migas={[{ texto: 'Cotizador', a: '/m/cotizador' }, { texto: 'Por partes' }]}
        accionPrincipal={puedeEmitir ? <span className="hidden xl:inline"><Boton variante="primario" cargando={emision.ocupado} onClick={() => void emision.pedir()}>Emitir</Boton></span> : undefined}
      />
      {emitida ? <CajaEmitida id={ctx.id} emitir={ctx.emitir} editar={ctx.editable || ctx.emitir} /> : null}
      <PestanasDelCuadro activa={pestana} alCambiar={setPestana} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <div id="parte-trabajo" role="tabpanel" aria-labelledby="pestana-trabajo" className={columna(pestana, 'trabajo')}>
          <PanelTrabajo {...ctx} />
          <PanelImposicion {...ctx} />
        </div>
        <div id="parte-costos" role="tabpanel" aria-labelledby="pestana-costos" className={columna(pestana, 'costos')}>
          <PanelFactores {...ctx} />
          {ctx.costos ? <CuadroDirecto {...ctx} /> : null}
        </div>
        <div id="parte-precio" role="tabpanel" aria-labelledby="pestana-precio" className={columna(pestana, 'precio')}>
          <Recibo {...ctx} />
          {ctx.costos ? <PanelUtilidad {...ctx} /> : null}
          <DesgloseDePliegos {...ctx} />
          {ctx.costos ? <PreciosDeReferencia {...ctx} /> : null}
        </div>
      </div>
      <BarraInferior vista={vista} puedeEmitir={puedeEmitir} emitiendo={emision.ocupado} alEmitir={() => void emision.pedir()} />
      <HojaMotivo
        abierto={emision.pidiendoMotivo} titulo="Margen por debajo del mínimo" etiqueta="¿Por qué se emite así?" textoEnviar="Continuar" obligatorio
        ayuda="El margen está en rojo. Anota el motivo para poder emitirla." alCerrar={emision.cerrarMotivo} alEnviar={emision.emitir}
      />
    </div>
  );
}

/** Cotizar por partes: trabajo e imposición, costos por factor y cuadro directo, recibo y precio. Todo lo calcula el servidor. */
export function PantallaCuadro() {
  const { id = '' } = useParams();
  const { vista, cargando, error, aplicar } = useCuadro(id);
  const p = usePermisosDeCotizaciones();
  const { configurar } = usePermisosDelCotizador();
  if (cargando) return <Cargando etiqueta="Cargando el cuadro" />;
  if (error || !vista) return <EstadoVacio titulo="No encontramos este cuadro" descripcion={error ?? undefined} icono="caja" />;
  const ctx: ContextoDelCuadro = { id, vista, aplicar, editable: estaEnBorrador(vista) && p.editar, costos: p.costos, configurar, emitir: p.emitir };
  return <Contenido ctx={ctx} />;
}
