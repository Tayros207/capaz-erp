import { Command } from 'cmdk';
import { CornerDownLeft, Layers, Search } from 'lucide-react';
import { createElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useEmpresas } from './consultas.ts';
import { iconoDeModulo } from './iconos-de-modulo.ts';
import { estadoDeEmpresa, ESTADO_DE_EMPRESA, filtrarEmpresas, FILTRO_VACIO, inicialesDeEmpresa, modulosPresentes, nombreDeModulo } from './logica.ts';

const CLASE_ITEM = 'flex min-h-10 cursor-pointer items-center gap-3 rounded-control px-3 text-sm text-texto data-[selected=true]:bg-superficie-alta';
const CLASE_GRUPO =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-texto-suave';

const SIN_EMPRESAS: never[] = [];
const SECCIONES = [
  { ruta: '/plataforma', nombre: 'Empresas' },
  { ruta: '/plataforma/planes', nombre: 'Planes y precios' },
  { ruta: '/plataforma/solicitudes', nombre: 'Solicitudes de módulos' },
];

/** Ctrl/Cmd + K de la consola: salta a una empresa por nombre, id o módulo, a una sección o a la lista filtrada por módulo. */
export function PaletaDeOperador({ abierta, alCambiar }: { abierta: boolean; alCambiar: (a: boolean) => void }) {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const empresas = useEmpresas();
  const cambiar = (a: boolean) => {
    if (!a) setTexto('');
    alCambiar(a);
  };

  const lista = empresas.data ?? SIN_EMPRESAS;
  const coinciden = useMemo(() => filtrarEmpresas(lista, { ...FILTRO_VACIO, texto }).slice(0, 8), [lista, texto]);
  const modulos = useMemo(() => modulosPresentes(lista).filter((c) => !texto.trim() || `${c} ${nombreDeModulo(c)}`.toLowerCase().includes(texto.trim().toLowerCase())), [lista, texto]);
  const secciones = SECCIONES.filter((s) => !texto.trim() || s.nombre.toLowerCase().includes(texto.trim().toLowerCase()));

  const ir = (ruta: string) => {
    cambiar(false);
    void navegar(ruta);
  };

  return (
    <Command.Dialog open={abierta} onOpenChange={cambiar} label="Buscar en la consola" shouldFilter={false} loop
      overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px]"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[min(38rem,calc(100%-1.5rem))] -translate-x-1/2 overflow-hidden rounded-tarjeta border border-borde bg-superficie text-texto shadow-elevada">
      <div className="flex items-center gap-3 border-b border-borde px-4">
        <Search aria-hidden className="size-4 shrink-0 text-texto-suave" strokeWidth={1.75} />
        <Command.Input value={texto} onValueChange={setTexto} placeholder="Empresa, id, módulo o código (crm, ordenes…)"
          className="h-12 w-full bg-transparent text-sm text-texto outline-none placeholder:text-texto-suave focus-visible:!shadow-none" />
        <kbd className="hidden shrink-0 rounded-chip border border-borde px-1.5 py-0.5 font-mono text-[0.6875rem] text-texto-suave sm:block">Esc</kbd>
      </div>
      <Command.List className="max-h-[min(26rem,60dvh)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-texto-suave">No hay resultados.</Command.Empty>
        {coinciden.length > 0 ? (
          <Command.Group heading="Empresas" className={CLASE_GRUPO}>
            {coinciden.map((e) => (
              <Command.Item key={e.id} value={`empresa-${e.id}`} onSelect={() => ir(`/plataforma/empresas/${encodeURIComponent(e.id)}`)} className={CLASE_ITEM}>
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-control bg-superficie-alta text-[0.6875rem] font-semibold text-texto-suave">{inicialesDeEmpresa(e.nombre)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.nombre}</span>
                <span className="text-xs text-texto-suave">{ESTADO_DE_EMPRESA[estadoDeEmpresa(e)].texto}</span>
                <CornerDownLeft aria-hidden className="size-3.5 text-texto-suave" />
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
        {modulos.length > 0 ? (
          <Command.Group heading="Empresas por módulo" className={CLASE_GRUPO}>
            {modulos.map((c) => {
              return (
                <Command.Item key={c} value={`modulo-${c}`} onSelect={() => ir(`/plataforma?modulo=${encodeURIComponent(c)}`)} className={CLASE_ITEM}>
                  {createElement(iconoDeModulo(c), { 'aria-hidden': true, className: 'size-4 text-texto-suave', strokeWidth: 1.75 })}
                  <span className="flex-1">{nombreDeModulo(c)}</span>
                  <span className="rounded-chip bg-superficie-alta px-1.5 py-px font-mono text-[0.6875rem] text-texto-suave">{c}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        ) : null}
        {secciones.length > 0 ? (
          <Command.Group heading="Ir a" className={CLASE_GRUPO}>
            {secciones.map((s) => (
              <Command.Item key={s.ruta} value={`ir-${s.ruta}`} onSelect={() => ir(s.ruta)} className={CLASE_ITEM}>
                <Layers aria-hidden className="size-4 text-texto-suave" strokeWidth={1.75} />
                <span className="flex-1">{s.nombre}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
      <div className="flex items-center gap-4 border-t border-borde bg-superficie-alta/60 px-4 py-2 text-xs text-texto-suave">
        <span>↑↓ moverse</span>
        <span>↵ abrir</span>
        <span className="ml-auto font-mono">Ctrl K</span>
      </div>
    </Command.Dialog>
  );
}
