import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { cargarPanel, exportarPanel } from './api.ts';
import { BloqueDeModulo } from './bloque-de-modulo.tsx';
import { CLAVE_REPORTES } from './claves.ts';
import { descargarCsv } from './descargar.ts';
import { diaEnZona, errorDeRango, periodoDe, textoDelPeriodo, type Preset, type RangoDeDias } from './logica.ts';
import { SelectorDePeriodo } from './selector-de-periodo.tsx';

/** Indicadores por período: un bloque por módulo al que la persona puede entrar, y su exportación a CSV. */
export function PantallaIndicadores() {
  const yo = useYo();
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [preset, setPreset] = useState<Preset>('mes');
  const [rango, setRango] = useState<RangoDeDias>({ desde: hoy, hasta: hoy });
  const [exportando, setExportando] = useState(false);

  const periodo = periodoDe(preset, hoy, rango);
  const error = preset === 'rango' ? errorDeRango(periodo) : null;
  const panel = useQuery({
    queryKey: [...CLAVE_REPORTES, 'panel', periodo.desde, periodo.hasta],
    queryFn: async () => datosOError(await cargarPanel(periodo)),
    enabled: error === null,
  });
  const puedeExportar = !!yo && puede(yo, 'reportes:exportar');

  async function exportar() {
    setExportando(true);
    const r = await exportarPanel(periodo);
    setExportando(false);
    if (r.ok && 'datos' in r) {
      descargarCsv(r.datos.nombreDeArchivo, r.datos.contenido);
      notificar(`${r.datos.filas} indicadores exportados.`, 'exito');
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Indicadores"
        accionPrincipal={puedeExportar ? <Boton variante="primario" cargando={exportando} disabled={error !== null} onClick={() => void exportar()}>Exportar CSV</Boton> : undefined}
      />
      <SelectorDePeriodo preset={preset} rango={rango} hoy={hoy} error={error} alElegir={setPreset} alCambiarRango={setRango} />
      {error === null ? <p className="text-sm text-texto-suave">Período: {textoDelPeriodo(periodo)}</p> : null}
      {error !== null ? null : panel.isPending ? (
        <div aria-busy="true" aria-label="Cargando indicadores" className="flex flex-col gap-2"><Esqueleto className="h-24" /><Esqueleto className="h-24" /></div>
      ) : panel.isError ? (
        <EstadoVacio titulo="No pudimos cargar los indicadores" descripcion={panel.error.message} icono="caja" accion={<Boton onClick={() => void panel.refetch()}>Reintentar</Boton>} />
      ) : panel.data.bloques.length === 0 ? (
        <EstadoVacio titulo="Sin indicadores" descripcion="Ninguno de tus módulos tiene un resumen disponible para ti." icono="caja" />
      ) : (
        panel.data.bloques.map((b) => <BloqueDeModulo key={b.modulo} bloque={b} />)
      )}
    </div>
  );
}
