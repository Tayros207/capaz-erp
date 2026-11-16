import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CornerDownLeft, Search } from 'lucide-react';
import { llamar } from '../../shared/api/herramientas.ts';
import { datosOError } from '../../shared/api/consultas.ts';
import { useBusqueda } from '../../shared/ui/use-busqueda.ts';
import { IconoMenu } from './iconos-menu.tsx';
import type { ItemDeMenu, MenuDeYo } from './menu.ts';
import { accionesRapidas, normalizar } from './paleta-logica.ts';

type Cliente = { id: string; nombre: string; documentoNumero: string | null; telefono: string | null };

async function buscarClientes(texto: string): Promise<Cliente[]> {
  if (texto.length < 2) return [];
  const r = datosOError(await llamar('clientes_buscar', { texto, limite: 6 }));
  return r.items.map((c) => ({ id: c.id, nombre: c.nombre, documentoNumero: c.documentoNumero, telefono: c.telefono }));
}

const CLASE_ITEM =
  'flex min-h-10 cursor-pointer items-center gap-3 rounded-control px-3 text-sm text-texto data-[selected=true]:bg-superficie-alta data-[selected=true]:text-texto';
const CLASE_GRUPO = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-texto-suave';

/**
 * Paleta de comandos (Ctrl/Cmd + K): lleva a cualquier pantalla del menú a la que la persona tiene acceso,
 * ofrece accesos rápidos de los módulos activos y busca clientes con `clientes_buscar` (lo que la web ya consume).
 */
export function PaletaDeComandos({ menu, abierta, alCambiar, puedeVerClientes }: { menu: MenuDeYo; abierta: boolean; alCambiar: (a: boolean) => void; puedeVerClientes: boolean }) {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (!abierta) setTexto('');
  }, [abierta]);

  const pantallas = useMemo(() => {
    const todas: Array<{ grupo: string; item: ItemDeMenu }> = [];
    for (const i of menu.nucleo) todas.push({ grupo: 'Principal', item: i });
    for (const f of menu.familias) for (const i of f.items) todas.push({ grupo: f.nombre, item: i });
    for (const i of menu.ajustes) todas.push({ grupo: 'Ajustes', item: i });
    for (const i of menu.operador ?? []) todas.push({ grupo: 'Operador', item: i });
    return todas.filter((p) => p.item.ruta);
  }, [menu]);
  const acciones = useMemo(() => accionesRapidas(pantallas.map((p) => p.item.ruta!)), [pantallas]);

  const q = normalizar(texto);
  const visibles = pantallas.filter((p) => !q || normalizar(`${p.item.nombre} ${p.grupo} ${p.item.descripcion}`).includes(q));
  const accionesVisibles = acciones.filter((a) => !q || normalizar(a.nombre).includes(q));
  const clientes = useBusqueda(texto, abierta && puedeVerClientes && q.length >= 2, buscarClientes, 250);

  function ir(ruta: string) {
    alCambiar(false);
    void navegar(ruta);
  }

  return (
    <Command.Dialog open={abierta} onOpenChange={alCambiar} label="Paleta de comandos" shouldFilter={false} loop
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2 overflow-hidden rounded-tarjeta border border-borde bg-superficie text-texto shadow-elevada">
      <div className="flex items-center gap-3 border-b border-borde px-4">
        <Search aria-hidden className="size-4 shrink-0 text-texto-suave" strokeWidth={1.75} />
        <Command.Input value={texto} onValueChange={setTexto} placeholder="Busca una pantalla o un cliente…"
          className="h-12 w-full bg-transparent text-sm text-texto outline-none placeholder:text-texto-suave" />
        <kbd className="hidden shrink-0 rounded-chip border border-borde px-1.5 py-0.5 text-[0.6875rem] text-texto-suave sm:block">Esc</kbd>
      </div>
      <Command.List className="max-h-[min(24rem,60dvh)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-texto-suave">
          {clientes.cargando ? 'Buscando…' : 'No hay resultados.'}
        </Command.Empty>
        {accionesVisibles.length > 0 ? (
          <Command.Group heading="Acciones rápidas" className={CLASE_GRUPO}>
            {accionesVisibles.map((a) => (
              <Command.Item key={a.ruta} value={`accion-${a.ruta}`} onSelect={() => ir(a.ruta)} className={CLASE_ITEM}>
                <IconoMenu nombre={a.icono} className="text-texto-suave" />
                <span className="flex-1">{a.nombre}</span>
                <CornerDownLeft aria-hidden className="size-3.5 text-texto-suave opacity-0 group-data-[selected=true]:opacity-100" />
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
        {clientes.opciones.length > 0 ? (
          <Command.Group heading="Clientes" className={CLASE_GRUPO}>
            {clientes.opciones.map((c) => (
              <Command.Item key={c.id} value={`cliente-${c.id}`} onSelect={() => ir(`/clientes/${c.id}`)} className={CLASE_ITEM}>
                <IconoMenu nombre="clientes" className="text-texto-suave" />
                <span className="flex-1 truncate">{c.nombre}</span>
                <span className="truncate text-xs text-texto-suave tabular-nums">{c.documentoNumero ?? c.telefono ?? ''}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
        {visibles.length > 0 ? (
          <Command.Group heading="Ir a" className={CLASE_GRUPO}>
            {visibles.map(({ grupo, item }) => (
              <Command.Item key={item.clave} value={`ir-${item.clave}`} onSelect={() => ir(item.ruta!)} className={CLASE_ITEM}>
                <IconoMenu nombre={item.icono} className="text-texto-suave" />
                <span className="flex-1 truncate">{item.nombre}</span>
                <span className="text-xs text-texto-suave">{grupo}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
      <div className="flex items-center gap-4 border-t border-borde bg-superficie-alta/60 px-4 py-2 text-xs text-texto-suave">
        <span>↑↓ moverse</span>
        <span>↵ abrir</span>
        <span className="ml-auto">Ctrl K</span>
      </div>
    </Command.Dialog>
  );
}
