import { useState } from 'react';
import { MAX_CARACTERES_DE_ARCHIVO, MAX_FILAS_EXPORTAR, MAX_FILAS_IMPORTAR, type EntidadDeIntercambio } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { exportarCsv } from './api.ts';
import { PanelDeImportacion } from './panel-de-importacion.tsx';
import { SelectorDeEntidad, type Separador } from './selector-de-entidad.tsx';
import { nombreDeArchivoSeguro } from './logica.ts';
import { descargarTexto } from './navegador.ts';

function PanelDeExportacion() {
  const [entidad, setEntidad] = useState<EntidadDeIntercambio>('clientes');
  const [separador, setSeparador] = useState<Separador>(',');
  const [archivados, setArchivados] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();

  async function exportar() {
    setOcupado(true);
    setAviso(undefined);
    const r = await exportarCsv({ entidad, separador, incluirArchivados: archivados });
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      descargarTexto(nombreDeArchivoSeguro(r.datos.nombreDeArchivo), r.datos.contenido);
      notificar(`${r.datos.filas} filas exportadas.`, 'exito');
      if (r.datos.truncado) setAviso(`Había más de ${MAX_FILAS_EXPORTAR.toLocaleString('es-PE')} filas: solo se exportaron las primeras.`);
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  return (
    <section aria-labelledby="titulo-exportar" className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <h2 id="titulo-exportar" className="font-titulo text-lg font-semibold">Exportar</h2>
      <p className="text-texto-suave">Descarga tus datos en un archivo CSV que abre Excel. Hasta {MAX_FILAS_EXPORTAR.toLocaleString('es-PE')} filas.</p>
      <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-3">
        <SelectorDeEntidad valor={entidad} alCambiar={setEntidad} />
        <CampoSelect etiqueta="Separador" value={separador} onChange={(e) => setSeparador(e.target.value as Separador)}>
          <option value=",">Coma (,)</option>
          <option value=";">Punto y coma (;) · Excel en español</option>
        </CampoSelect>
        <CampoSelect etiqueta="Archivados" value={archivados ? 'si' : 'no'} onChange={(e) => setArchivados(e.target.value === 'si')}>
          <option value="no">No incluir</option>
          <option value="si">Incluir</option>
        </CampoSelect>
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-aviso">{aviso}</p> : null}
      <div><Boton variante="primario" cargando={ocupado} onClick={() => void exportar()}>Descargar CSV</Boton></div>
    </section>
  );
}

export function SeccionIntercambio({ puedeImportar, puedeExportar }: { puedeImportar: boolean; puedeExportar: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">
        Límites de la importación: {MAX_FILAS_IMPORTAR.toLocaleString('es-PE')} filas y {MAX_CARACTERES_DE_ARCHIVO.toLocaleString('es-PE')} caracteres por archivo. Si tienes más, divídelo en partes.
      </p>
      {puedeImportar ? <PanelDeImportacion /> : <p className="text-texto-suave">No tienes permiso para importar datos.</p>}
      {puedeExportar ? <PanelDeExportacion /> : <p className="text-texto-suave">No tienes permiso para exportar datos.</p>}
    </div>
  );
}

