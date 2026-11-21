import { useState } from 'react';
import { Link } from 'react-router';
import { CORTE_DE_HISTORIAL_POR_DEFECTO, type FilaConMotivo } from '@capaz/shared';
import { validarArchivoCsv } from '../../core/conecta/logica.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { importarHistorial, previsualizarHistorial } from './api.ts';
import { refrescarPedidos } from './acciones.ts';
import {
  avisoDeErrores, avisoDeRecorte, mensajeDeImportacion, textoDeBotonImportar, textoDeMonto, textoDeRango, validarCorte, type LecturaDeHistorial,
} from './logica-historial.ts';

const COLUMNAS_DE_FILA: Array<Columna<FilaConMotivo>> = [
  { id: 'fila', titulo: 'Fila', principal: true, alinear: 'derecha', celda: (f) => f.fila },
  { id: 'motivo', titulo: 'Motivo', celda: (f) => <span className="break-words">{f.motivo}</span> },
];

function Detalle({ titulo, total, filas }: { titulo: string; total: number; filas: FilaConMotivo[] }) {
  if (total === 0) return null;
  const recorte = avisoDeRecorte(filas.length, total);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-titulo font-semibold">{titulo} ({total})</h3>
      <Lista etiqueta={titulo} columnas={COLUMNAS_DE_FILA} filas={filas} clave={(f) => `${f.fila}-${f.motivo}`} />
      {recorte ? <p className="text-sm text-texto-suave">{recorte}</p> : null}
    </section>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col rounded-control border border-borde bg-superficie-alta p-3">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="font-medium text-texto">{valor}</dd>
    </div>
  );
}

function Resumen({ l, aplicada }: { l: LecturaDeHistorial; aplicada: boolean }) {
  const nuevas = aplicada ? (l.creadas ?? 0) : (l.nuevas ?? 0);
  const errores = avisoDeErrores(l.erroresTotal);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <h2 className="font-titulo text-lg font-semibold">{aplicada ? 'Importación terminada' : 'Vista previa'}</h2>
      {aplicada ? <p className="font-medium text-exito">{mensajeDeImportacion(l)}</p> : <p className="text-texto-suave">Todavía no se creó nada. Revisa y, si todo está bien, importa.</p>}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Dato rotulo={aplicada ? 'Trabajos importados' : 'Trabajos nuevos'} valor={String(nuevas)} />
        <Dato rotulo="Repetidos (ya estaban)" valor={String(l.duplicadasTotal)} />
        <Dato rotulo="Omitidos por la fecha de corte" valor={String(l.omitidasPorFecha)} />
        <Dato rotulo="Con error" valor={String(l.erroresTotal)} />
        <Dato rotulo="Monto total" valor={textoDeMonto(l.totalCentimos)} />
        <Dato rotulo="Fechas de los trabajos" valor={textoDeRango(l)} />
        <Dato rotulo={aplicada ? 'Clientes creados' : 'Clientes por crear'} valor={String(aplicada ? (l.clientesCreados ?? 0) : l.clientesPorCrearTotal)} />
      </dl>
      {errores ? <p role="alert" className="text-sm font-medium text-peligro">{errores}</p> : null}
    </div>
  );
}

type Lectura = LecturaDeHistorial & { errores: FilaConMotivo[]; duplicadas: FilaConMotivo[]; clientesPorCrear: string[] };
type Argumentos = { contenido: string; desde: string; crearClientesFaltantes: boolean };

/** La vista previa y la importación: llamadas al servidor y lo que se muestra de su respuesta. */
function useImportacion(argumentos: () => Argumentos | null, alImportar: () => void) {
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [aplicada, setAplicada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();
  const reiniciar = () => { setLectura(null); setAplicada(false); setAviso(undefined); };

  async function previsualizar() {
    const args = argumentos();
    if (!args) return;
    setOcupado(true);
    reiniciar();
    const r = await previsualizarHistorial(args);
    setOcupado(false);
    if (r.ok && 'datos' in r) setLectura(r.datos);
    else if ('error' in r) setAviso(r.error.mensaje);
  }

  async function importar() {
    const args = argumentos();
    if (!args) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await importarHistorial(args);
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      setLectura(r.datos);
      setAplicada(true);
      alImportar();
      await refrescarPedidos();
      notificar(mensajeDeImportacion(r.datos), 'exito');
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  return { lectura, aplicada, ocupado, aviso, reiniciar, previsualizar, importar };
}

type Importacion = ReturnType<typeof useImportacion>;

function ClientesPorCrear({ lectura, crear }: { lectura: Lectura; crear: boolean }) {
  const recorte = avisoDeRecorte(lectura.clientesPorCrear.length, lectura.clientesPorCrearTotal);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-titulo font-semibold">Clientes que no existen ({lectura.clientesPorCrearTotal})</h3>
      <p className="text-sm text-texto-suave">{crear ? 'Se crearán al importar.' : 'Esos trabajos darán error. Marca «Crear los clientes que falten» o créalos antes.'}</p>
      <ul className="list-disc pl-5 text-sm">{lectura.clientesPorCrear.map((c) => <li key={c} className="break-words">{c}</li>)}</ul>
      {recorte ? <p className="text-sm text-texto-suave">{recorte}</p> : null}
    </section>
  );
}

function ResultadoDeImportacion({ lectura, aplicada, crear }: { lectura: Lectura; aplicada: boolean; crear: boolean }) {
  return (
    <section className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4">
      <Resumen l={lectura} aplicada={aplicada} />
      {lectura.clientesPorCrearTotal > 0 && !aplicada ? <ClientesPorCrear lectura={lectura} crear={crear} /> : null}
      <Detalle titulo="Filas con error" total={lectura.erroresTotal} filas={lectura.errores} />
      <Detalle titulo="Filas repetidas (se omiten)" total={lectura.duplicadasTotal} filas={lectura.duplicadas} />
      {aplicada ? <Link to="/m/ordenes" className="font-medium underline underline-offset-2">Ver los pedidos</Link> : null}
    </section>
  );
}

type PropsDeFormulario = {
  imp: Importacion; archivo: { nombre: string; contenido: string } | null; errorDeArchivo: string | undefined; clave: number;
  desde: string; errorDeCorte: string | undefined; crear: boolean;
  alElegir: (f: File | undefined) => void; alCambiarCorte: (v: string) => void; alCambiarCrear: (v: boolean) => void;
};

function FormularioDeImportacion({ imp, archivo, errorDeArchivo, clave, desde, errorDeCorte, crear, alElegir, alCambiarCorte, alCambiarCrear }: PropsDeFormulario) {
  const nuevas = imp.lectura?.nuevas ?? 0;
  const puedeImportar = !!imp.lectura && !imp.aplicada && nuevas > 0;
  return (
    <section aria-labelledby="titulo-historial" className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <h2 id="titulo-historial" className="font-titulo text-lg font-semibold">Trabajos de años anteriores</h2>
      <p className="text-texto-suave">Sube un archivo CSV con el historial. Los trabajos entran como ya entregados y marcados «Importado»; no generan deudas ni avisos. Si subes el mismo archivo otra vez, los trabajos repetidos se omiten. No se crea nada hasta que lo confirmes.</p>
      <fieldset disabled={imp.ocupado} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo key={clave} etiqueta="Archivo CSV" type="file" accept=".csv,.txt,text/csv" error={errorDeArchivo} ayuda={archivo ? `Listo: ${archivo.nombre}` : 'Máximo 1,000 filas por archivo; si tienes más, súbelo por partes.'} onChange={(e) => alElegir(e.target.files?.[0])} />
        </div>
        <Campo etiqueta="Fecha de corte" type="date" value={desde} error={errorDeCorte} ayuda="Los trabajos anteriores a este día se omiten." onChange={(e) => alCambiarCorte(e.target.value)} />
        <label className="flex items-center gap-2 self-end py-2 text-texto">
          <input type="checkbox" className="size-5" checked={crear} onChange={(e) => alCambiarCrear(e.target.checked)} />
          Crear los clientes que falten
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Boton variante={puedeImportar ? 'secundario' : 'primario'} disabled={!archivo || !!errorDeCorte} cargando={imp.ocupado && !imp.lectura} onClick={() => void imp.previsualizar()}>Previsualizar</Boton>
        {puedeImportar ? <Boton variante="primario" cargando={imp.ocupado} onClick={() => void imp.importar()}>{textoDeBotonImportar(nuevas)}</Boton> : null}
      </div>
      {imp.aviso ? <p role="alert" className="text-sm font-medium text-peligro">{imp.aviso}</p> : null}
    </section>
  );
}

/** Importar el historial de trabajos de años anteriores desde un CSV: `/m/ordenes/importar-historial`. Solo dueño y administrador (lo exige el servidor). */
export function PantallaImportarHistorial() {
  const [archivo, setArchivo] = useState<{ nombre: string; contenido: string } | null>(null);
  const [errorDeArchivo, setErrorDeArchivo] = useState<string | undefined>();
  const [desde, setDesde] = useState(CORTE_DE_HISTORIAL_POR_DEFECTO);
  const [crear, setCrear] = useState(false);
  const [clave, setClave] = useState(0); // reinicia el campo de archivo
  const errorDeCorte = validarCorte(desde);
  const imp = useImportacion(
    () => (archivo && !errorDeCorte ? { contenido: archivo.contenido, desde: desde.trim(), crearClientesFaltantes: crear } : null),
    () => { setArchivo(null); setClave((n) => n + 1); },
  );

  async function elegirArchivo(f: File | undefined) {
    imp.reiniciar();
    setArchivo(null);
    setErrorDeArchivo(undefined);
    if (!f) return;
    const contenido = await f.text();
    const e = validarArchivoCsv(f.name, contenido);
    if (e) return setErrorDeArchivo(e);
    setArchivo({ nombre: f.name, contenido });
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Importar historial" migas={[{ texto: 'Pedidos', a: '/m/ordenes' }, { texto: 'Importar historial' }]} />
      <FormularioDeImportacion
        imp={imp} archivo={archivo} errorDeArchivo={errorDeArchivo} clave={clave} desde={desde} errorDeCorte={errorDeCorte} crear={crear}
        alElegir={(f) => void elegirArchivo(f)} alCambiarCorte={(v) => { setDesde(v); imp.reiniciar(); }} alCambiarCrear={(v) => { setCrear(v); imp.reiniciar(); }}
      />
      {imp.lectura ? <ResultadoDeImportacion lectura={imp.lectura} aplicada={imp.aplicada} crear={crear} /> : null}
    </div>
  );
}
