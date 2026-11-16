import { useState } from 'react';
import type { EtapaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { archivarEtapa, crearEtapa, ordenarEtapas, renombrarEtapa } from './api.ts';
import { useEscribir } from './acciones.ts';
import { useEtapas } from './consultas.ts';
import { etapasAbiertas, moverEnOrden } from './logica.ts';
import { MarcoCrm } from './marco.tsx';
import { usePermisosCrm } from './permisos.ts';

type Edicion = { etapa: EtapaDto | null; nombre: string };

function FilaEtapa({ e, i, ids, configurar, alRenombrar }: { e: EtapaDto; i: number; ids: string[]; configurar: boolean; alRenombrar: () => void }) {
  const escribir = useEscribir();
  const abierta = e.tipo === 'abierta';
  const mover = (paso: -1 | 1) => {
    const nuevo = moverEnOrden(ids, i, paso);
    if (nuevo) void escribir(ordenarEtapas(nuevo));
  };
  async function archivar() {
    if (await confirmar('Archivar etapa', `«${e.nombre}» dejará de verse en el tablero.`, { textoConfirmar: 'Archivar', peligroso: true })) {
      await escribir(archivarEtapa(e.id), 'Etapa archivada.');
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="flex items-center gap-2 font-medium text-texto">
        {e.nombre}
        {abierta ? null : <Insignia tono={e.tipo === 'ganada' ? 'exito' : 'peligro'}>Cierre</Insignia>}
      </span>
      {configurar ? (
        <span className="flex flex-wrap gap-2">
          {abierta ? <Boton disabled={i === 0} onClick={() => mover(-1)}>Subir</Boton> : null}
          {abierta ? <Boton disabled={i === ids.length - 1} onClick={() => mover(1)}>Bajar</Boton> : null}
          <Boton onClick={alRenombrar}>Renombrar</Boton>
          {abierta ? <Boton variante="peligro" onClick={() => void archivar()}>Archivar</Boton> : null}
        </span>
      ) : null}
    </li>
  );
}

/** Etapas del embudo: crear, renombrar, ordenar (Subir/Bajar) y archivar. Las de cierre quedan al final. */
export function PantallaEtapas() {
  const { configurar } = usePermisosCrm();
  const escribir = useEscribir();
  const etapas = useEtapas();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function guardar() {
    if (!edicion) return;
    const nombre = edicion.nombre.trim();
    if (!nombre) return setError('Indica el nombre.');
    const r = await escribir(edicion.etapa ? renombrarEtapa(edicion.etapa.id, nombre) : crearEtapa(nombre), edicion.etapa ? 'Etapa renombrada.' : 'Etapa creada.');
    if (r) setEdicion(null);
  }

  const todas = etapas.data ?? [];
  const ids = etapasAbiertas(todas).map((e) => e.id);
  return (
    <MarcoCrm>
      <EncabezadoDePagina titulo="Etapas del embudo" accionPrincipal={configurar ? <Boton variante="primario" icono="mas" onClick={() => { setError(undefined); setEdicion({ etapa: null, nombre: '' }); }}>Nueva etapa</Boton> : undefined} />
      {etapas.isPending ? (
        <Esqueleto className="h-40" />
      ) : etapas.isError ? (
        <EstadoVacio titulo="No pudimos cargar las etapas" descripcion={etapas.error.message} icono="caja" />
      ) : todas.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay etapas" descripcion="Se crean solas la primera vez que alguien con acceso completo entra al CRM." icono="caja" />
      ) : (
        <ul aria-label="Etapas" className="flex flex-col divide-y divide-borde">
          {todas.map((e) => (
            <FilaEtapa key={e.id} e={e} i={ids.indexOf(e.id)} ids={ids} configurar={configurar} alRenombrar={() => { setError(undefined); setEdicion({ etapa: e, nombre: e.nombre }); }} />
          ))}
        </ul>
      )}
      <HojaInferior abierto={edicion !== null} alCerrar={() => setEdicion(null)} titulo={edicion?.etapa ? 'Renombrar etapa' : 'Nueva etapa'}>
        <form className="flex flex-col gap-3" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
          <Campo etiqueta="Nombre" value={edicion?.nombre ?? ''} onChange={(ev) => setEdicion((x) => (x ? { ...x, nombre: ev.target.value } : x))} error={error} maxLength={60} />
          <Boton variante="primario" type="submit">Guardar</Boton>
        </form>
      </HojaInferior>
    </MarcoCrm>
  );
}
