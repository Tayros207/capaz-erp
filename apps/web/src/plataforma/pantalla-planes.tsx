import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Minus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatearSoles } from '../shared/formato/soles.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { unir } from '../shared/ui/unir.ts';
import { datosOError, listarPlanes } from './api.ts';
import { ChipDeModulo, CodigoDeModulo } from './chip-modulo.tsx';
import { HojaPlan, type Plan } from './hoja-plan.tsx';
import { CLAVE_PLANES } from './claves.ts';
import { nombreDeModulo } from './logica.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

function TarjetaDePlan({ p, alAbrir }: { p: Plan; alAbrir: () => void }) {
  return (
    <li className={unir('relative flex flex-col gap-4 overflow-hidden rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta transition-shadow hover:shadow-elevada', !p.activo && 'opacity-70')}>
      <span aria-hidden className={unir('absolute inset-x-0 top-0 h-0.5', p.activo ? 'bg-accion' : 'bg-borde-fuerte')} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h3 className="font-titulo text-lg leading-tight font-semibold text-texto">{p.nombre}</h3>
          <CodigoDeModulo codigo={p.codigo} />
        </div>
        <Insignia tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Insignia>
      </div>
      <p className="flex items-baseline gap-1">
        <span className="font-titulo text-3xl font-semibold tracking-tight text-texto tabular-nums">{formatearSoles(p.precioCentimos)}</span>
        <span className="text-sm text-texto-suave">/ mes</span>
      </p>
      {p.descripcion ? <p className="text-sm text-texto-suave">{p.descripcion}</p> : null}
      <p className="flex items-center gap-2 text-sm text-texto-suave">
        <Users aria-hidden className="size-4" strokeWidth={1.75} />
        {p.usuariosIncluidos === null ? 'Sin tope de usuarios' : `${p.usuariosIncluidos} ${p.usuariosIncluidos === 1 ? 'usuario incluido' : 'usuarios incluidos'}`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {p.modulos.length === 0 ? <span className="text-sm text-texto-suave">Sin módulos</span> : p.modulos.map((c) => <ChipDeModulo key={c} codigo={c} />)}
      </div>
      <Boton className="mt-auto" onClick={alAbrir}>Editar plan</Boton>
    </li>
  );
}

function Comparativa({ planes }: { planes: readonly Plan[] }) {
  const modulos = useMemo(() => [...new Set(planes.flatMap((p) => p.modulos))].sort(), [planes]);
  if (modulos.length === 0 || planes.length < 2) return null;
  return (
    <section aria-labelledby="titulo-comparativa" className="flex flex-col gap-3">
      <h2 id="titulo-comparativa" className="font-titulo text-lg font-semibold">Comparativa por módulo</h2>
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie shadow-tarjeta">
        <table className="w-full min-w-max border-collapse text-left">
          <caption className="sr-only">Qué módulos incluye cada plan</caption>
          <thead className="bg-superficie-alta/70">
            <tr className="border-b border-borde">
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-texto-suave uppercase">Módulo</th>
              {planes.map((p) => (
                <th key={p.codigo} scope="col" className="px-4 py-3 text-center">
                  <span className="block text-sm font-semibold text-texto">{p.nombre}</span>
                  <span className="block text-xs font-normal text-texto-suave tabular-nums">{formatearSoles(p.precioCentimos)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modulos.map((c) => (
              <tr key={c} className="border-b border-borde last:border-b-0 hover:bg-superficie-alta/50">
                <th scope="row" className="px-4 py-2.5 font-normal">
                  <span className="mr-2 text-sm font-medium text-texto">{nombreDeModulo(c)}</span>
                  <CodigoDeModulo codigo={c} />
                </th>
                {planes.map((p) => (
                  <td key={p.codigo} className="px-4 py-2.5 text-center">
                    {p.modulos.includes(c) ? (
                      <><Check aria-hidden className="mx-auto size-4 text-exito" strokeWidth={2.25} /><span className="sr-only">Incluido</span></>
                    ) : (
                      <><Minus aria-hidden className="mx-auto size-4 text-borde-fuerte" strokeWidth={2} /><span className="sr-only">No incluido</span></>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PantallaPlanes() {
  const cliente = useQueryClient();
  const [abierto, setAbierto] = useState<{ plan: Plan | null } | null>(null);
  const consulta = useQuery({ queryKey: CLAVE_PLANES, queryFn: async () => datosOError(await listarPlanes()).items });

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoDePagina
        titulo="Planes y precios"
        accionPrincipal={<Boton variante="primario" icono="mas" onClick={() => setAbierto({ plan: null })}>Plan nuevo</Boton>}
      />
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : consulta.data.length === 0 ? (
        <EstadoVacio titulo="Sin planes" descripcion="Crea el primer plan con su precio." icono="caja" accion={<Boton variante="primario" icono="mas" onClick={() => setAbierto({ plan: null })}>Plan nuevo</Boton>} />
      ) : (
        <>
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3" aria-label="Planes">
            {[...consulta.data].sort((a, b) => Number(b.activo) - Number(a.activo) || a.precioCentimos - b.precioCentimos).map((p) => <TarjetaDePlan key={p.codigo} p={p} alAbrir={() => setAbierto({ plan: p })} />)}
          </ul>
          <Comparativa planes={[...consulta.data].filter((p) => p.activo).sort((a, b) => a.precioCentimos - b.precioCentimos)} />
        </>
      )}
      <HojaPlan
        key={abierto?.plan?.codigo ?? 'nuevo'}
        abierto={abierto !== null}
        plan={abierto?.plan ?? null}
        alCerrar={() => setAbierto(null)}
        alCambiar={() => void cliente.invalidateQueries({ queryKey: CLAVE_PLANES })}
      />
    </div>
  );
}
