import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { ConteoDto, ConteoLineaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_INSUMOS } from './api.ts';
import { anularConteo, cerrarConteo, registrarConteo, verConteo } from './api-operaciones.ts';
import { HojaDeAnularConteo } from './hoja-anular-conteo.tsx';
import { avanceDeConteo, cambiosDeConteo, codigoDeConteo, ETIQUETA_DE_CONTEO, TONO_DE_CONTEO } from './logica-operaciones.ts';
import { mensajeDeRechazo, textoDeCantidad } from './logica.ts';
import { Cargando } from './marco.tsx';
import { refrescarInventario, resolverAccion, usePermisosDeInventario } from './use-inventario.ts';

function Diferencia({ l }: { l: ConteoLineaDto }) {
  if (l.diferenciaMilesimas === null) return <span className="text-texto-suave">Sin contar</span>;
  if (l.diferenciaMilesimas === 0) return <span className="text-exito">Coincide</span>;
  const signo = l.diferenciaMilesimas > 0 ? '+' : '';
  return <span className={`font-medium tabular-nums ${l.diferenciaMilesimas > 0 ? 'text-exito' : 'text-peligro'}`}>{signo}{textoDeCantidad(l.diferenciaMilesimas, l.unidad)}</span>;
}

function HojaDeConteo({ c }: { c: ConteoDto }) {
  const { editar } = usePermisosDeInventario();
  const abierto = c.estado === 'abierto';
  const [tecleado, setTecleado] = useState<Map<string, number | null>>(new Map());
  const [guardando, setGuardando] = useState(false);
  const pendientes = cambiosDeConteo(c.lineas, tecleado);

  async function guardar() {
    setGuardando(true);
    const r = await registrarConteo({ id: c.id, lineas: pendientes });
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      setTecleado(new Map());
      notificar(`${pendientes.length} artículos anotados.`, 'exito');
      await refrescarInventario();
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <ul aria-label="Artículos del inventario" className="flex flex-col gap-2">
      {c.lineas.map((l) => (
        <li key={l.articuloId} className="grid gap-2 rounded-control border border-borde p-3 sm:grid-cols-[1fr_9rem_9rem_10rem] sm:items-center">
          <span className="font-medium text-texto">{l.nombre}</span>
          <span className="text-sm text-texto-suave">Sistema: <span className="tabular-nums text-texto">{textoDeCantidad(l.sistemaMilesimas, l.unidad)}</span></span>
          {abierto && editar ? (
            <CampoCantidad etiqueta="Contado" unidad={l.unidad} valor={tecleado.has(l.articuloId) ? (tecleado.get(l.articuloId) ?? null) : l.contadaMilesimas} alCambiar={(v) => setTecleado((m) => new Map(m).set(l.articuloId, v))} />
          ) : (
            <span className="text-sm text-texto-suave">Contado: <span className="tabular-nums text-texto">{l.contadaMilesimas === null ? '—' : textoDeCantidad(l.contadaMilesimas, l.unidad)}</span></span>
          )}
          <Diferencia l={l} />
        </li>
      ))}
      {abierto && editar ? (
        <li className="flex justify-end">
          <Boton variante="primario" cargando={guardando} disabled={pendientes.length === 0} onClick={() => void guardar()}>Guardar lo contado ({pendientes.length})</Boton>
        </li>
      ) : null}
    </ul>
  );
}

function Contenido({ c }: { c: ConteoDto }) {
  const { editar, ajustar } = usePermisosDeInventario();
  const avance = avanceDeConteo(c);
  const abierto = c.estado === 'abierto';

  async function cerrar() {
    await resolverAccion(cerrarConteo(c.id), `Inventario ${codigoDeConteo(c)} cerrado: las diferencias quedaron ajustadas.`);
  }

  const [anulando, setAnulando] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={`Inventario ${codigoDeConteo(c)}`}
        migas={[{ texto: 'Inventario físico', a: '/m/insumos/conteos' }, { texto: codigoDeConteo(c) }]}
        accionPrincipal={abierto && ajustar ? <Boton variante="primario" disabled={!avance.puedeCerrar} onClick={() => void cerrar()}>Cerrar y ajustar</Boton> : undefined}
        accionesSecundarias={
          <>
            <Insignia tono={TONO_DE_CONTEO[c.estado]}>{ETIQUETA_DE_CONTEO[c.estado]}</Insignia>
            {abierto && editar ? <Boton variante="peligro" onClick={() => setAnulando(true)}>Anular</Boton> : null}
          </>
        }
      />
      <GrupoDeCifras etiqueta="Avance del inventario">
        <Cifra etiqueta="Sucursal" valor={c.sucursalCodigo} />
        <Cifra etiqueta="Avance" valor={avance.texto} />
        <Cifra etiqueta="Con diferencia" valor={String(c.lineas.filter((l) => l.diferenciaMilesimas !== null && l.diferenciaMilesimas !== 0).length)} tono="aviso" />
      </GrupoDeCifras>
      {c.nota ? <p className="text-sm text-texto-suave">{c.nota}</p> : null}
      <HojaDeAnularConteo abierto={anulando} alCerrar={() => setAnulando(false)} alEnviar={(motivo) => resolverAccion(anularConteo({ id: c.id, motivo }), `Inventario ${codigoDeConteo(c)} anulado.`)} />
      <HojaDeConteo key={`${c.id}-${c.lineasContadas}-${c.estado}`} c={c} />
    </div>
  );
}

/** Hoja de conteo de un inventario físico: lo que dice el sistema, lo contado y la diferencia de cada artículo. */
export function PantallaConteo() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_INSUMOS, 'conteo', id], queryFn: async () => datosOError(await verConteo(id)) });
  if (consulta.isPending) return <Cargando etiqueta="Cargando inventario físico" />;
  if (consulta.isError) return <EstadoVacio titulo="No encontramos este inventario" descripcion={consulta.error.message} icono="caja" />;
  return <Contenido c={consulta.data} />;
}
