import { useQuery } from '@tanstack/react-query';
import { useState, type Dispatch, type SetStateAction } from 'react';
import type { SemanaRevisadaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { resolverAccion } from './acciones.ts';
import { cerrarSemana, revisarSemana } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { diaEnZona } from './logica.ts';
import {
  argumentosDeCierre, motivoParaNoContar, PASOS_DE_CIERRE, semanaQueTocaCerrar, validarConteos, type Conteos, type ErroresDeConteo, type Explicaciones,
} from './logica-cierre.ts';
import { PasoCerrar, PasoContar, PasoRevisar, PasoSemana } from './pasos-de-cierre.tsx';
import { usePuedeEditar } from './use-registro.ts';

function Indicador({ paso }: { paso: number }) {
  return (
    <ol aria-label="Pasos del cierre" className="grid grid-cols-4 gap-1 text-center text-xs">
      {PASOS_DE_CIERRE.map((nombre, i) => (
        <li key={nombre} aria-current={i === paso ? 'step' : undefined} className={unir('rounded-control border px-1 py-1.5 font-medium', i === paso ? 'border-accion bg-superficie-alta text-texto' : 'border-borde text-texto-suave')}>
          {i + 1}. {nombre}
        </li>
      ))}
    </ol>
  );
}

type Semana = SemanaRevisadaDto;

/** Lo que se ve en el paso actual. Solo dibuja: el estado vive en `AsistenteDeSemana`. */
function ContenidoDelPaso({ paso, semana, desde, hoy, alMover, estado, notas, alNotas }: {
  paso: number; semana: Semana; desde: string; hoy: string; alMover: (desde: string) => void; estado: EstadoDelConteo; notas: string; alNotas: (t: string) => void;
}) {
  const { conteos, explicaciones, errores, setConteos, setExplicaciones, setErrores } = estado;
  if (paso === 0) return <PasoSemana desde={desde} hoy={hoy} semana={semana} alMover={alMover} />;
  if (paso === 1) return <PasoRevisar semana={semana} />;
  if (paso === 3) return <PasoCerrar semana={semana} conteos={conteos} explicaciones={explicaciones} notas={notas} alNotas={alNotas} />;
  return (
    <PasoContar
      semana={semana} conteos={conteos} explicaciones={explicaciones} errores={errores}
      alContar={(id, v) => { setConteos((c) => ({ ...c, [id]: v })); setErrores({}); }}
      alExplicar={(id, t) => { setExplicaciones((x) => ({ ...x, [id]: t })); setErrores({}); }}
    />
  );
}

type EstadoDelConteo = {
  conteos: Conteos; explicaciones: Explicaciones; errores: ErroresDeConteo;
  setConteos: Dispatch<SetStateAction<Conteos>>; setExplicaciones: Dispatch<SetStateAction<Explicaciones>>; setErrores: Dispatch<SetStateAction<ErroresDeConteo>>;
};

function useEstadoDelConteo(): EstadoDelConteo {
  const [conteos, setConteos] = useState<Conteos>({});
  const [explicaciones, setExplicaciones] = useState<Explicaciones>({});
  const [errores, setErrores] = useState<ErroresDeConteo>({});
  return { conteos, explicaciones, errores, setConteos, setExplicaciones, setErrores };
}

/** Asistente de una semana ya cargada: pasos, conteos y cierre. */
function AsistenteDeSemana({ semana, desde, hoy, alMover }: { semana: Semana; desde: string; hoy: string; alMover: (desde: string) => void }) {
  const puedeEditar = usePuedeEditar('registro:editar');
  const [paso, setPaso] = useState(0);
  const estado = useEstadoDelConteo();
  const [notas, setNotas] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const motivo = motivoParaNoContar(semana.estado, semana.hasta);
  const sinCuentas = semana.cuentas.length === 0;
  // Sin poder contar (semana cerrada, futura o en curso) el asistente solo llega hasta «Revisar», salvo para ver el cierre hecho.
  const ultimoPaso = semana.cierre ? 3 : motivo ? 1 : 3;

  function avanzar() {
    if (paso === 2) {
      const e = validarConteos(semana.cuentas, estado.conteos, estado.explicaciones);
      estado.setErrores(e);
      if (Object.keys(e).length > 0) return;
    }
    setPaso(semana.cierre && paso === 1 ? 3 : paso + 1); // una semana ya cerrada no se vuelve a contar
  }

  async function cerrar() {
    setCerrando(true);
    const r = await cerrarSemana(argumentosDeCierre(desde, semana.cuentas, estado.conteos, estado.explicaciones, notas));
    setCerrando(false);
    await resolverAccion(r, 'Semana cerrada.');
  }

  return (
    <div className="flex flex-col gap-4">
      <Indicador paso={paso} />
      <ContenidoDelPaso paso={paso} semana={semana} desde={desde} hoy={hoy} alMover={alMover} estado={estado} notas={notas} alNotas={setNotas} />
      {sinCuentas ? <p role="status" className="text-sm text-texto-suave">Todavía no tienes cuentas activas: crea al menos una en «Cuentas y categorías» para poder cerrar la semana.</p> : null}
      <div className="flex justify-between gap-2">
        <Boton variante="fantasma" disabled={paso === 0} onClick={() => setPaso(semana.cierre && paso === 3 ? 1 : paso - 1)}>Atrás</Boton>
        {paso < ultimoPaso ? <Boton variante="primario" disabled={sinCuentas && paso >= 1} onClick={avanzar}>Siguiente</Boton> : null}
        {paso === 3 && !semana.cierre && puedeEditar ? <Boton variante="primario" cargando={cerrando} onClick={() => void cerrar()}>Cerrar la semana</Boton> : null}
      </div>
    </div>
  );
}

/** Carga la semana y, ya cargada, muestra el asistente. Se vuelve a crear (y a vaciar lo contado) al cambiar de semana. */
function Asistente({ desde, hoy, alMover }: { desde: string; hoy: string; alMover: (desde: string) => void }) {
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'cierre', desde], queryFn: async () => datosOError(await revisarSemana(desde)) });
  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando la semana" className="flex flex-col gap-2"><Esqueleto className="h-24" /><Esqueleto className="h-24" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar la semana" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return <AsistenteDeSemana semana={consulta.data} desde={desde} hoy={hoy} alMover={alMover} />;
}

/** Cierre semanal de caja: elegir la semana, revisarla, contar el dinero de cada cuenta y cerrar. Pensado primero para el celular. */
export function PantallaCierre() {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [desde, setDesde] = useState(() => semanaQueTocaCerrar(hoy));
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cierre semanal" />
      <Asistente key={desde} desde={desde} hoy={hoy} alMover={setDesde} />
    </div>
  );
}
