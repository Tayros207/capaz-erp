import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { EntidadDeIntercambio, FilaConMotivo } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { aplicarCsv, previsualizarCsv } from './api.ts';
import { resumenDeLectura, validarArchivoCsv } from './logica.ts';
import { SelectorDeEntidad, type Separador } from './selector-de-entidad.tsx';

type Lectura = { total: number; nuevas?: number; creadas?: number; duplicadasTotal: number; erroresTotal: number; errores: FilaConMotivo[]; duplicadas: FilaConMotivo[]; columnasIgnoradas: string[] };

const COLUMNAS_DE_FILA: Array<Columna<FilaConMotivo>> = [
  { id: 'fila', titulo: 'Fila', principal: true, alinear: 'derecha', celda: (f) => f.fila },
  { id: 'motivo', titulo: 'Motivo', celda: (f) => <span className="break-words">{f.motivo}</span> },
];

function Detalle({ titulo, total, filas }: { titulo: string; total: number; filas: FilaConMotivo[] }) {
  if (total === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-titulo font-semibold">{titulo} ({total})</h3>
      <Lista etiqueta={titulo} columnas={COLUMNAS_DE_FILA} filas={filas} clave={(f) => `${f.fila}-${f.motivo}`} />
      {total > filas.length ? <p className="text-sm text-texto-suave">Se muestran las primeras {filas.length} de {total}.</p> : null}
    </section>
  );
}

export function PanelDeImportacion() {
  const consultas = useQueryClient();
  const [entidad, setEntidad] = useState<EntidadDeIntercambio>('clientes');
  const [separador, setSeparador] = useState<Separador | ''>('');
  const [archivo, setArchivo] = useState<{ nombre: string; contenido: string } | null>(null);
  const [errorDeArchivo, setErrorDeArchivo] = useState<string | undefined>();
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [aplicada, setAplicada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();
  const [clave, setClave] = useState(0); // reinicia el campo de archivo

  const reiniciarLectura = () => {
    setLectura(null);
    setAplicada(false);
    setAviso(undefined);
  };

  async function elegirArchivo(f: File | undefined) {
    reiniciarLectura();
    setArchivo(null);
    setErrorDeArchivo(undefined);
    if (!f) return;
    const contenido = await f.text();
    const e = validarArchivoCsv(f.name, contenido);
    if (e) return setErrorDeArchivo(e);
    setArchivo({ nombre: f.name, contenido });
  }

  const argumentos = () => (archivo ? { entidad, contenido: archivo.contenido, ...(separador ? { separador } : {}) } : null);

  async function previsualizar() {
    const args = argumentos();
    if (!args) return;
    setOcupado(true);
    reiniciarLectura();
    const r = await previsualizarCsv(args);
    setOcupado(false);
    if (r.ok && 'datos' in r) setLectura(r.datos);
    else if ('error' in r) setAviso(r.error.mensaje);
  }

  async function aplicar() {
    const args = argumentos();
    if (!args) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await aplicarCsv(args);
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      setLectura(r.datos);
      setAplicada(true);
      setArchivo(null);
      setClave((n) => n + 1);
      await consultas.invalidateQueries({ queryKey: [entidad] });
      notificar(`Importación lista: ${r.datos.creadas} creadas.`, 'exito');
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  const hayNuevas = (lectura?.nuevas ?? 0) > 0 && !aplicada;
  return (
    <section aria-labelledby="titulo-importar" className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <h2 id="titulo-importar" className="font-titulo text-lg font-semibold">Importar</h2>
      <p className="text-texto-suave">Elige qué datos traes, sube tu archivo CSV y revisa la vista previa. No se crea nada hasta que lo confirmes.</p>
      <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2">
        <SelectorDeEntidad valor={entidad} alCambiar={(e) => { setEntidad(e); reiniciarLectura(); }} />
        <CampoSelect etiqueta="Separador" value={separador} onChange={(e) => { setSeparador(e.target.value as Separador | ''); reiniciarLectura(); }}>
          <option value="">Detectar solo</option>
          <option value=",">Coma (,)</option>
          <option value=";">Punto y coma (;)</option>
        </CampoSelect>
        <div className="sm:col-span-2">
          <Campo key={clave} etiqueta="Archivo CSV" type="file" accept=".csv,.txt,text/csv" error={errorDeArchivo} ayuda={archivo ? `Listo: ${archivo.nombre}` : 'La primera fila debe llevar los nombres de las columnas.'} onChange={(e) => void elegirArchivo(e.target.files?.[0])} />
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Boton variante={hayNuevas ? 'secundario' : 'primario'} disabled={!archivo} cargando={ocupado && !lectura} onClick={() => void previsualizar()}>Previsualizar</Boton>
        {hayNuevas ? <Boton variante="primario" cargando={ocupado} onClick={() => void aplicar()}>Importar {lectura?.nuevas} filas</Boton> : null}
      </div>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      {lectura ? (
        <div className="flex flex-col gap-4" aria-live="polite">
          <p className="font-medium">{aplicada ? 'Importación aplicada. ' : 'Vista previa. '}{resumenDeLectura(lectura)}</p>
          {lectura.columnasIgnoradas.length ? <p className="text-sm text-texto-suave">Columnas que no se usan: {lectura.columnasIgnoradas.join(', ')}.</p> : null}
          <Detalle titulo="Filas con error" total={lectura.erroresTotal} filas={lectura.errores} />
          <Detalle titulo="Filas repetidas (se omiten)" total={lectura.duplicadasTotal} filas={lectura.duplicadas} />
        </div>
      ) : null}
    </section>
  );
}
