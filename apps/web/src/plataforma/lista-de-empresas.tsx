import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';
import { formatearFecha } from '../shared/formato/fechas.ts';
import { Insignia } from '../shared/ui/insignia.tsx';
import { unir } from '../shared/ui/unir.ts';
import { AvatarDeEmpresa } from './avatar-de-empresa.tsx';
import { ChipDeModulo, CodigoDeModulo } from './chip-modulo.tsx';
import type { EmpresaDeLista } from './consultas.ts';
import { ESTADO_DE_EMPRESA, estadoDeEmpresa, proximoVencimiento, textoDeVencimiento, type ClaveDeOrden, type OrdenDeEmpresas } from './logica.ts';

const MAXIMO_DE_CHIPS = 3;
const ruta = (e: EmpresaDeLista) => `/plataforma/empresas/${encodeURIComponent(e.id)}`;

function Vencimiento({ e, ahora }: { e: EmpresaDeLista; ahora: Date }) {
  const v = proximoVencimiento(e, ahora);
  if (!v) return <span className="text-texto-suave">—</span>;
  const tono = v.dias < 0 ? 'text-peligro' : v.dias <= 7 ? 'text-aviso' : 'text-texto-suave';
  return (
    <span className="flex flex-col leading-tight">
      <span className={unir('text-sm font-medium whitespace-nowrap', tono)}>{textoDeVencimiento(v.dias)}</span>
      <span className="text-[0.6875rem] whitespace-nowrap text-texto-suave">{v.tipo === 'prueba' ? 'Prueba' : 'Vigencia'} · <CodigoDeModulo codigo={v.modulo} /></span>
    </span>
  );
}

function Modulos({ e }: { e: EmpresaDeLista }) {
  if (e.modulos.length === 0) return <span className="text-sm text-texto-suave">Sin módulos</span>;
  const visibles = e.modulos.slice(0, MAXIMO_DE_CHIPS);
  const resto = e.modulos.length - visibles.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visibles.map((m) => <ChipDeModulo key={m.modulo} codigo={m.modulo} estado={m.estado} />)}
      {resto > 0 ? (
        <span title={e.modulos.slice(MAXIMO_DE_CHIPS).map((m) => m.modulo).join(', ')} className="rounded-chip bg-superficie-alta px-1.5 py-0.5 text-xs font-medium text-texto-suave">+{resto}</span>
      ) : null}
    </span>
  );
}

function Estado({ e }: { e: EmpresaDeLista }) {
  const s = ESTADO_DE_EMPRESA[estadoDeEmpresa(e)];
  return <Insignia tono={s.tono}>{s.texto}</Insignia>;
}

type Cabecera = { clave: ClaveDeOrden; texto: string; derecha?: boolean };
const CABECERAS: Cabecera[] = [
  { clave: 'nombre', texto: 'Empresa' },
  { clave: 'estado', texto: 'Estado' },
  { clave: 'vence', texto: 'Vence' },
  { clave: 'miembros', texto: 'Usuarios', derecha: true },
  { clave: 'alta', texto: 'Alta' },
];

function BotonDeOrden({ c, orden, alOrdenar }: { c: Cabecera; orden: OrdenDeEmpresas; alOrdenar: (o: OrdenDeEmpresas) => void }) {
  const activo = orden.clave === c.clave;
  const Flecha = !activo ? ArrowUpDown : orden.direccion === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => alOrdenar({ clave: c.clave, direccion: activo && orden.direccion === 'asc' ? 'desc' : 'asc' })}
      className={unir('inline-flex cursor-pointer items-center gap-1 rounded-chip py-1 text-xs font-semibold tracking-wide uppercase transition-colors hover:text-texto', activo ? 'text-texto' : 'text-texto-suave', c.derecha && 'flex-row-reverse')}
    >
      {c.texto}
      <Flecha aria-hidden className={unir('size-3', !activo && 'opacity-50')} strokeWidth={2} />
    </button>
  );
}

export function ListaDeEmpresas({ empresas, orden, alOrdenar, ahora }: { empresas: readonly EmpresaDeLista[]; orden: OrdenDeEmpresas; alOrdenar: (o: OrdenDeEmpresas) => void; ahora: Date }) {
  const sentido = (c: ClaveDeOrden) => (orden.clave === c ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none');
  return (
    <>
      <div className="hidden overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-tarjeta md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Empresas de la plataforma. Usa los encabezados para ordenar.</caption>
          <thead className="bg-superficie-alta/70">
            <tr className="border-b border-borde">
              {CABECERAS.map((c) => (
                <Fragment key={c.clave}>
                  <th scope="col" aria-sort={sentido(c.clave)} className={unir('px-4 py-2 font-normal', c.derecha && 'text-right')}>
                    <BotonDeOrden c={c} orden={orden} alOrdenar={alOrdenar} />
                  </th>
                  {c.clave === 'nombre' ? <th scope="col" className="px-4 py-2 text-xs font-semibold tracking-wide text-texto-suave uppercase">Módulos</th> : null}
                </Fragment>
              ))}
              <th scope="col" className="w-10"><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} className="group border-b border-borde last:border-b-0 transition-colors hover:bg-superficie-alta/60 has-[a:focus-visible]:bg-superficie-alta/60">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <Link to={ruta(e)} className="flex items-center gap-3 rounded-control after:absolute after:inset-0 after:content-['']">
                    <AvatarDeEmpresa nombre={e.nombre} />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate font-semibold text-texto">{e.nombre}</span>
                      <span className="font-mono text-[0.6875rem] text-texto-suave">{e.id.slice(0, 8)}</span>
                    </span>
                  </Link>
                </th>
                <td className="relative z-10 min-w-72 px-4 py-3"><Modulos e={e} /></td>
                <td className="px-4 py-3"><Estado e={e} /></td>
                <td className="px-4 py-3"><Vencimiento e={e} ahora={ahora} /></td>
                <td className="px-4 py-3 text-right tabular-nums">{e.miembros}</td>
                <td className="px-4 py-3 text-sm text-texto-suave tabular-nums">{formatearFecha(e.altaEn)}</td>
                <td className="pr-3"><ChevronRight aria-hidden className="size-4 text-texto-suave transition-transform group-hover:translate-x-0.5 group-hover:text-texto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex list-none flex-col gap-2 p-0 md:hidden" aria-label="Empresas de la plataforma">
        {empresas.map((e) => (
          <li key={e.id} className="relative flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-3 shadow-tarjeta active:bg-superficie-alta">
            <Link to={ruta(e)} className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']">
              <AvatarDeEmpresa nombre={e.nombre} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-semibold text-texto">{e.nombre}</span>
                <span className="text-xs text-texto-suave">{e.miembros} {e.miembros === 1 ? 'usuario' : 'usuarios'} · alta {formatearFecha(e.altaEn)}</span>
              </span>
              <Estado e={e} />
            </Link>
            <div className="relative z-10 flex flex-col gap-2"><Modulos e={e} /><Vencimiento e={e} ahora={ahora} /></div>
          </li>
        ))}
      </ul>
    </>
  );
}
