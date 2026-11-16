import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { EstadoDeAsistencia } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { resolverAccion, usePermisosDePersonal } from './acciones.ts';
import { cargarActivos, cargarAsistenciasDelDia, marcarAsistencia } from './api.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { FilaDeAsistencia } from './fila-asistencia.tsx';
import { HojaDeCorreccion, type CorreccionPedida } from './hoja-correccion.tsx';
import { argumentosDeEstadoDeHoy, diaEnZona, ETIQUETA_DE_ESTADO, filasDelDia, formatearDia, modoDelDia, moverDia, resumenDelDia, textoDeResumenDelDia, type FilaDelDia } from './logica.ts';
import { Cargando } from './marco.tsx';

const AVISO_DE_MODO = {
  hoy: null,
  pasado: 'Es un día pasado: para cambiar una asistencia indica el motivo.',
  futuro: 'Todavía no llega ese día: no se puede marcar la asistencia.',
} as const;

function Selector({ fecha, hoy, alCambiar }: { fecha: string; hoy: string; alCambiar: (f: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Boton aria-label="Día anterior" onClick={() => alCambiar(moverDia(fecha, -1))}>‹</Boton>
      <div className="w-44"><Campo etiqueta="Día" type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && alCambiar(e.target.value)} /></div>
      <Boton aria-label="Día siguiente" disabled={fecha >= hoy} onClick={() => alCambiar(moverDia(fecha, 1))}>›</Boton>
      {fecha !== hoy ? <Boton variante="fantasma" onClick={() => alCambiar(hoy)}>Ir a hoy</Boton> : null}
    </div>
  );
}

/** El parte del día: una fila por colaborador activo. Hoy se marca; un día pasado se corrige con motivo. */
export function PantallaAsistencia() {
  const { editar } = usePermisosDePersonal();
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [fecha, setFecha] = useState(hoy);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [correccion, setCorreccion] = useState<CorreccionPedida | null>(null);
  const modo = modoDelDia(fecha, hoy);
  const dia = useQuery({
    queryKey: [...CLAVE_PERSONAL, 'asistencia', fecha],
    queryFn: async () => filasDelDia(await cargarActivos(), await cargarAsistenciasDelDia(fecha)),
  });

  async function elegir(fila: FilaDelDia, estado: EstadoDeAsistencia) {
    if (modo === 'pasado') return setCorreccion({ colaboradorId: fila.colaborador.id, nombre: fila.colaborador.nombre, fecha, estado });
    setOcupado(fila.colaborador.id);
    await resolverAccion(marcarAsistencia(argumentosDeEstadoDeHoy(fila, estado)), `${fila.colaborador.nombre}: ${ETIQUETA_DE_ESTADO[estado].toLowerCase()}.`);
    setOcupado(null);
  }
  async function marcarSalida(fila: FilaDelDia) {
    setOcupado(fila.colaborador.id);
    await resolverAccion(marcarAsistencia({ colaboradorId: fila.colaborador.id, salida: true }), `Salida de ${fila.colaborador.nombre} marcada.`);
    setOcupado(null);
  }

  const resumen = dia.data ? textoDeResumenDelDia(resumenDelDia(dia.data)) : null;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo={`Asistencia · ${formatearDia(fecha)}`} />
      <Selector fecha={fecha} hoy={hoy} alCambiar={setFecha} />
      {resumen ? <p role="status" className="font-medium text-texto">{resumen}</p> : null}
      {AVISO_DE_MODO[modo] ? <p className="text-sm text-texto-suave">{AVISO_DE_MODO[modo]}</p> : null}
      {dia.isPending ? (
        <Cargando etiqueta="Cargando el parte del día" />
      ) : dia.isError ? (
        <EstadoVacio titulo="No pudimos cargar el parte del día" descripcion={dia.error.message} icono="usuario" accion={<Boton onClick={() => void dia.refetch()}>Reintentar</Boton>} />
      ) : dia.data.length === 0 ? (
        <EstadoVacio titulo="No hay colaboradores activos" descripcion="Agrega a tu equipo en la sección Colaboradores para marcar su asistencia." icono="usuario" />
      ) : (
        <ul aria-label="Parte del día" className="flex flex-col gap-3">
          {dia.data.map((fila) => (
            <FilaDeAsistencia
              key={fila.colaborador.id}
              fila={fila}
              modo={modo}
              puedeEditar={editar}
              ocupado={ocupado === fila.colaborador.id}
              alElegir={(estado) => void elegir(fila, estado)}
              alMarcarSalida={() => void marcarSalida(fila)}
            />
          ))}
        </ul>
      )}
      <HojaDeCorreccion correccion={correccion} alCerrar={() => setCorreccion(null)} />
    </div>
  );
}
