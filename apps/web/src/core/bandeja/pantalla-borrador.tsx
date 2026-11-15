import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Borrador } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { aprobarBorrador, corregirBorrador, datosOError, descartarBorrador, verBorrador } from './api.ts';
import { CLAVE_BANDEJA } from './claves.ts';
import { FormularioCorreccion } from './formulario-correccion.tsx';
import { HojaDescartar } from './hoja-descartar.tsx';
import { InsigniasDeBorrador } from './insignias.tsx';
import {
  accionDeAtajo,
  argumentosCorregidos,
  clavesCorregidas,
  esObjetoPlano,
  filasDeArgumentos,
  formularioDeCorreccion,
  hayCambios,
  mensajeDeRechazo,
  mensajeDeRechazoAlAprobar,
  titularDeHerramienta,
} from './logica.ts';

function esCampoDeTexto(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
}

function Dato({ etiqueta, valor, corregido }: { etiqueta: string; valor: string; corregido: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">
        {etiqueta}
        {corregido ? <span className="ml-2 font-medium text-aviso">corregido</span> : null}
      </dt>
      <dd className="break-words text-lg font-medium text-texto">{valor}</dd>
    </div>
  );
}

export function PantallaBorrador() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const consulta = useQuery({ queryKey: [...CLAVE_BANDEJA, 'ver', id], queryFn: async () => datosOError(await verBorrador(id)) });
  const b = consulta.data;

  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<null | 'aprobar' | 'guardar' | 'descartar'>(null);
  const [fallo, setFallo] = useState('');
  const [descartando, setDescartando] = useState(false);
  const [errorDescarte, setErrorDescarte] = useState('');
  const enCurso = useRef(false); // evita aprobar dos veces con doble clic o atajo repetido

  const pendiente = b?.estado === 'pendiente';

  function refrescar(nuevo: Borrador) {
    cliente.setQueryData([...CLAVE_BANDEJA, 'ver', id], nuevo);
    void cliente.invalidateQueries({ queryKey: [...CLAVE_BANDEJA, 'lista'] });
  }

  function empezarCorreccion() {
    if (!b || !pendiente) return;
    setValores(formularioDeCorreccion(b.args));
    setErrores({});
    setFallo('');
    setEditando(true);
  }

  async function guardar() {
    if (!b || enCurso.current) return;
    const r = argumentosCorregidos(b.args, valores);
    if (!r.ok) {
      setErrores(r.errores);
      return;
    }
    enCurso.current = true;
    setOcupado('guardar');
    const res = await corregirBorrador(b.id, r.args);
    enCurso.current = false;
    setOcupado(null);
    if (res.ok && 'datos' in res) {
      refrescar(res.datos);
      setEditando(false);
      notificar('Cambios guardados. Revisa y aprueba.', 'exito');
    } else if ('error' in res) {
      setFallo(mensajeDeRechazo(res.error.codigo, res.error.mensaje));
    }
  }

  async function aprobar() {
    if (!b || !pendiente || editando || enCurso.current) return;
    enCurso.current = true;
    setOcupado('aprobar');
    setFallo('');
    const res = await aprobarBorrador(b.id, b.resumen || titularDeHerramienta(b.herramienta));
    enCurso.current = false;
    setOcupado(null);
    if ('cancelada' in res) return;
    if (res.ok && 'datos' in res) {
      void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
      notificar('Aprobado', 'exito');
      void navegar('/bandeja');
    } else if ('error' in res) {
      const mensaje = mensajeDeRechazoAlAprobar(res.error.codigo, res.error.mensaje);
      setFallo(mensaje);
      notificar(mensaje, 'error');
    } else {
      setFallo('El servidor pidió una confirmación que no se pudo completar. El borrador sigue pendiente.');
    }
  }

  async function descartar(motivo: string) {
    if (!b) return;
    setOcupado('descartar');
    setErrorDescarte('');
    const res = await descartarBorrador(b.id, motivo);
    setOcupado(null);
    if (res.ok && 'datos' in res) {
      void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
      notificar('Borrador descartado', 'info');
      void navegar('/bandeja');
    } else if ('error' in res) {
      setErrorDescarte(mensajeDeRechazo(res.error.codigo, res.error.mensaje));
    }
  }

  // Atajos en escritorio: A aprueba, C corrige. Siempre con la versión más reciente de las funciones.
  const manejador = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    manejador.current = (e) => {
      if (descartando || e.repeat) return;
      const accion = accionDeAtajo({ key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, escribiendo: esCampoDeTexto(e.target) });
      if (accion === 'aprobar') {
        e.preventDefault();
        void aprobar();
      } else if (accion === 'corregir' && !editando) {
        e.preventDefault();
        empezarCorreccion();
      }
    };
  });
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => manejador.current(e);
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando borrador" className="flex flex-col gap-3">
        <Esqueleto className="h-10" />
        <Esqueleto className="h-40" />
      </div>
    );
  }
  if (consulta.isError || !b) {
    return (
      <EstadoVacio
        titulo="No encontramos ese borrador"
        descripcion={consulta.error?.message}
        icono="caja"
        accion={<Boton onClick={() => void navegar('/bandeja')}>Volver a la bandeja</Boton>}
      />
    );
  }

  const filas = filasDeArgumentos(b.args);
  const corregidas = clavesCorregidas(b.args, b.argsOriginales);

  return (
    <div className="flex flex-col gap-4 pb-28 sm:pb-0">
      <EncabezadoDePagina titulo={b.resumen || titularDeHerramienta(b.herramienta)} migas={[{ texto: 'Bandeja', a: '/bandeja' }, { texto: 'Borrador' }]} />
      <InsigniasDeBorrador b={b} />

      <section aria-labelledby="propone" className="rounded-tarjeta border border-borde bg-superficie">
        <h2 id="propone" className="border-b border-borde px-4 py-2 font-titulo text-base font-semibold">Lo que propone</h2>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-texto-suave">
            Operación: <strong className="text-texto">{titularDeHerramienta(b.herramienta)}</strong> · módulo {b.modulo}
          </p>
          {editando && esObjetoPlano(b.args) ? (
            <form
              id="corregir"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void guardar();
              }}
            >
              <FormularioCorreccion original={b.args} valores={valores} errores={errores} alCambiar={(k, v) => setValores({ ...valores, [k]: v })} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Boton variante="fantasma" disabled={ocupado === 'guardar'} onClick={() => setEditando(false)}>Cancelar</Boton>
                <Boton type="submit" variante="primario" cargando={ocupado === 'guardar'} disabled={!hayCambios(b.args, valores)}>Guardar corrección</Boton>
              </div>
            </form>
          ) : filas.length > 0 ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {filas.map((f) => (
                <Dato key={f.clave} etiqueta={f.etiqueta} valor={f.valor} corregido={corregidas.has(f.clave)} />
              ))}
            </dl>
          ) : (
            <p className="text-texto-suave">Este borrador no trae datos todavía. Corrígelo antes de aprobar.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="origen" className="rounded-tarjeta border border-borde bg-superficie">
        <h2 id="origen" className="border-b border-borde px-4 py-2 font-titulo text-base font-semibold">Origen y trazabilidad</h2>
        <dl className="grid gap-3 p-4 sm:grid-cols-2">
          <Dato etiqueta="Propuesto" valor={formatearFechaHora(b.propuestoEn)} corregido={false} />
          <Dato etiqueta="Referencia del origen" valor={b.origenRef ?? '—'} corregido={false} />
          {b.estado !== 'pendiente' && b.resueltoEn ? <Dato etiqueta="Resuelto" valor={formatearFechaHora(b.resueltoEn)} corregido={false} /> : null}
          {b.motivoDescarte ? <Dato etiqueta="Motivo del descarte" valor={b.motivoDescarte} corregido={false} /> : null}
        </dl>
      </section>

      {fallo ? (
        <p role="alert" className="rounded-tarjeta border border-peligro/40 bg-peligro/10 p-3 font-medium text-peligro">{fallo}</p>
      ) : null}

      {pendiente ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-borde bg-fondo p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
          <Boton variante="primario" tamano="grande" className="w-full sm:w-auto" cargando={ocupado === 'aprobar'} disabled={editando || ocupado !== null} onClick={() => void aprobar()} icono="check">
            Aprobar <kbd className="ml-1 hidden rounded-control border border-current px-1.5 text-xs sm:inline">A</kbd>
          </Boton>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Boton tamano="grande" disabled={editando || ocupado !== null} onClick={empezarCorreccion}>
              Corregir <kbd className="ml-1 hidden rounded-control border border-current px-1.5 text-xs sm:inline">C</kbd>
            </Boton>
            <Boton variante="peligro" tamano="grande" disabled={ocupado !== null} onClick={() => { setErrorDescarte(''); setDescartando(true); }}>Descartar</Boton>
          </div>
        </div>
      ) : null}

      <HojaDescartar abierto={descartando} alCerrar={() => setDescartando(false)} alDescartar={(m) => void descartar(m)} descartando={ocupado === 'descartar'} errorDelServidor={errorDescarte} />
    </div>
  );
}
