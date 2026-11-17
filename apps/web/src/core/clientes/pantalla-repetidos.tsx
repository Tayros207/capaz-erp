import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import type { ParSimilarDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { datosOError } from './api.ts';
import { fusionarClientes, buscarRepetidos } from './api-fusion.ts';
import { CLAVE_CLIENTES } from './claves.ts';
import { mensajeDeRechazo } from './logica.ts';

const UMBRALES = [{ v: 0.7, t: 'Muy parecidos' }, { v: 0.55, t: 'Parecidos' }, { v: 0.4, t: 'Algo parecidos' }] as const;

const detalle = (c: ParSimilarDto['a']) => [c.documentoNumero, c.tipo === 'ambos' ? 'cliente y proveedor' : c.tipo].filter(Boolean).join(' · ');

function Lado({ c, titulo }: { c: ParSimilarDto['a']; titulo: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-texto-suave">{titulo}</span>
      <Link className="break-words font-medium text-texto underline-offset-2 hover:underline" to={`/clientes/${c.id}`}>{c.nombre}</Link>
      <span className="text-sm text-texto-suave">{detalle(c) || 'Sin documento'}</span>
    </div>
  );
}

function Pareja({ par, puedeFusionar, alFusionar }: { par: ParSimilarDto; puedeFusionar: boolean; alFusionar: (origenId: string, destinoId: string, nombre: string) => void }) {
  return (
    <li className="grid gap-3 rounded-control border border-borde p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
      <Lado c={par.a} titulo="Ficha A" />
      <Lado c={par.b} titulo="Ficha B" />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-texto-suave">Parecido: {Math.round(par.similitud * 100)} %</span>
        {puedeFusionar ? (
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => alFusionar(par.b.id, par.a.id, par.a.nombre)}>Conservar A</Boton>
            <Boton onClick={() => alFusionar(par.a.id, par.b.id, par.b.nombre)}>Conservar B</Boton>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Parejas de clientes o proveedores con nombres parecidos, para reunirlas en una sola ficha. */
export function PantallaRepetidos() {
  const yo = useYo();
  const [umbral, setUmbral] = useState<number>(0.55);
  const consulta = useQuery({ queryKey: [...CLAVE_CLIENTES, 'repetidos', umbral], queryFn: async () => datosOError(await buscarRepetidos(umbral)).items });
  const puedeFusionar = !!yo && puede(yo, 'clientes:editar');

  async function fusionar(origenId: string, destinoId: string, nombre: string) {
    const r = await fusionarClientes(origenId, destinoId);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      notificar(`Fusionados en «${nombre}»: ${r.datos.totalFilas} registros reunidos.`, 'exito');
      await clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_CLIENTES });
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Clientes repetidos" migas={[{ texto: 'Clientes', a: '/clientes' }, { texto: 'Repetidos' }]} />
      <div className="sm:max-w-xs">
        <CampoSelect etiqueta="Qué tan parecidos" value={String(umbral)} onChange={(e) => setUmbral(Number(e.target.value))}>
          {UMBRALES.map((u) => <option key={u.v} value={u.v}>{u.t}</option>)}
        </CampoSelect>
      </div>
      {consulta.isPending ? (
        <div aria-busy="true" aria-label="Buscando repetidos" className="flex flex-col gap-2"><Esqueleto className="h-16" /><Esqueleto className="h-16" /></div>
      ) : consulta.isError ? (
        <EstadoVacio titulo="No pudimos buscar repetidos" descripcion={consulta.error.message} icono="usuario" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />
      ) : consulta.data.length === 0 ? (
        <EstadoVacio titulo="No hay clientes repetidos" descripcion="Ninguna pareja de fichas activas se parece tanto. Prueba con «Algo parecidos»." icono="usuario" />
      ) : (
        <ul aria-label="Parejas de clientes parecidos" className="flex flex-col gap-2">
          {consulta.data.map((p) => <Pareja key={`${p.a.id}-${p.b.id}`} par={p} puedeFusionar={puedeFusionar} alFusionar={(o, d, n) => void fusionar(o, d, n)} />)}
        </ul>
      )}
    </div>
  );
}
