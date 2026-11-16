import type { EmpresaDeLista } from './consultas.ts';
import { BarraDeBusqueda } from '../shared/ui/datos/barra-de-busqueda.tsx';
import { CampoSelect } from '../shared/ui/campo-select.tsx';
import { unir } from '../shared/ui/unir.ts';
import { ESTADO_DE_EMPRESA, estadoDeEmpresa, FILTRO_VACIO, modulosPresentes, nombreDeModulo, type EstadoDeEmpresa, type FiltroDeEmpresas } from './logica.ts';

const ORDEN_DE_ESTADOS: ReadonlyArray<EstadoDeEmpresa> = ['activa', 'prueba', 'suspendida', 'baja', 'sin_modulos'];

export function FiltrosDeEmpresas({ empresas, filtro, alCambiar }: { empresas: readonly EmpresaDeLista[]; filtro: FiltroDeEmpresas; alCambiar: (f: FiltroDeEmpresas) => void }) {
  const cuenta = (s: EstadoDeEmpresa) => empresas.filter((e) => estadoDeEmpresa(e) === s).length;
  const opciones: Array<{ id: EstadoDeEmpresa | 'todas'; texto: string; n: number }> = [
    { id: 'todas', texto: 'Todas', n: empresas.length },
    ...ORDEN_DE_ESTADOS.map((s) => ({ id: s, texto: ESTADO_DE_EMPRESA[s].texto, n: cuenta(s) })).filter((o) => o.n > 0 || filtro.estado === o.id),
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_14rem]">
        <BarraDeBusqueda id="buscar-empresa" valor={filtro.texto} onCambio={(texto) => alCambiar({ ...filtro, texto })} etiqueta="Buscar empresa" placeholder="Buscar por empresa, id o módulo (crm, pedidos…)   ·   atajo: /" />
        <CampoSelect etiqueta="Módulo" value={filtro.modulo} onChange={(e) => alCambiar({ ...filtro, modulo: e.target.value })} className="[&]:min-h-(--alto-control)">
          <option value="todos">Todos los módulos</option>
          {modulosPresentes(empresas).map((c) => <option key={c} value={c}>{`${nombreDeModulo(c)} · ${c}`}</option>)}
        </CampoSelect>
      </div>
      <div role="group" aria-label="Filtrar por estado" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {opciones.map((o) => {
          const activo = filtro.estado === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={activo}
              onClick={() => alCambiar({ ...filtro, estado: o.id })}
              className={unir(
                'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                activo ? 'border-texto bg-texto text-texto-inverso shadow-sutil' : 'border-borde bg-superficie text-texto-suave hover:border-borde-fuerte hover:text-texto',
              )}
            >
              {o.texto}
              <span className={unir('rounded-full px-1.5 text-[0.6875rem] tabular-nums', activo ? 'bg-white/20' : 'bg-superficie-alta')}>{o.n}</span>
            </button>
          );
        })}
        {filtro.vencenEn !== null ? (
          <button type="button" onClick={() => alCambiar({ ...filtro, vencenEn: null })} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-aviso/40 bg-aviso/10 px-3.5 text-sm font-medium whitespace-nowrap text-aviso">
            Vencen en {filtro.vencenEn} días <span aria-hidden>×</span><span className="sr-only">Quitar este filtro</span>
          </button>
        ) : null}
        {JSON.stringify(filtro) !== JSON.stringify(FILTRO_VACIO) ? (
          <button type="button" onClick={() => alCambiar(FILTRO_VACIO)} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap text-accion underline-offset-2 hover:underline">
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
