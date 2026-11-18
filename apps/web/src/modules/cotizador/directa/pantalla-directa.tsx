import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { usePermisosDeCotizaciones } from '../acciones-cotizacion.ts';
import { SeccionesDelCotizador } from '../marco.tsx';
import { DirectaCabecera } from './directa-cabecera.tsx';
import { DirectaFilas } from './directa-filas.tsx';
import { DirectaPie } from './directa-pie.tsx';
import { opcionesDeValidez } from './logica-directa.ts';
import { useHojaDirecta } from './use-hoja-directa.ts';

/** Cotización directa: la hoja de cotización escrita como en papel; al emitir se numera y queda de solo lectura. */
export function PantallaDirecta() {
  const { editar } = usePermisosDeCotizaciones();
  const h = useHojaDirecta();
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cotización directa" />
      <SeccionesDelCotizador />
      {!editar ? (
        <EstadoVacio titulo="No puedes crear cotizaciones" descripcion="Pide a quien administra tu empresa el permiso para editar en el Cotizador." icono="carpeta" />
      ) : (
        <>
          <DirectaCabecera hoja={h.hoja} errores={h.errores} emitida={h.emitida} alCambiar={h.cambiar} />
          <DirectaFilas
            filas={h.hoja.filas}
            incluyeIgv={h.hoja.incluyeIgv}
            igv={h.igv}
            clienteId={h.hoja.cliente?.id}
            unidades={h.config?.unidades ?? []}
            errores={h.errores.porFila}
            errorGeneral={h.errores.filas}
            soloLectura={h.emitida !== null}
            nuevaClave={h.nuevaClave}
            alCambiar={(filas) => h.cambiar({ filas })}
          />
          <DirectaPie hoja={h.hoja} igv={h.igv} opcionesDeValidez={opcionesDeValidez(h.config)} emitida={h.emitida} emitiendo={h.emitiendo} alCambiar={h.cambiar} alEmitir={() => void h.emitir()} alNuevaHoja={h.nuevaHoja} />
        </>
      )}
    </div>
  );
}
