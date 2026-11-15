import { NavLink } from 'react-router';
import { Insignia, type TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { IconoMenu } from './iconos-menu.tsx';
import type { EstadoDeItem, ItemDeMenu, MenuDeYo } from './menu.ts';
import { solicitarModulo } from './solicitar.ts';

export const TONO_DE_ESTADO: Record<EstadoDeItem, TonoDeInsignia> = {
  entra: 'exito', prueba: 'info', solo_lectura: 'aviso', bloqueado: 'neutro', proximamente: 'neutro',
};

/** `iconos`: solo iconos; `auto`: solo iconos únicamente en tableta; `completo`: siempre con texto. */
export type ModoDeMenu = 'completo' | 'iconos' | 'auto';

type Props = {
  menu: MenuDeYo;
  modo: ModoDeMenu;
  alNavegar?: () => void;
};

const SOLO_LECTORES: Record<ModoDeMenu, string> = { completo: '', iconos: 'sr-only', auto: 'md:max-lg:sr-only' };
const OCULTO: Record<ModoDeMenu, string> = { completo: '', iconos: 'hidden', auto: 'md:max-lg:hidden' };

const base = 'flex min-h-(--alto-control) items-center gap-3 rounded-control px-3 text-menu-texto';

function Fila({ item, modo, alNavegar }: { item: ItemDeMenu; modo: ModoDeMenu; alNavegar?: () => void }) {
  const texto = unir('min-w-0 flex-1 truncate', SOLO_LECTORES[modo]);
  const conTitulo = modo !== 'completo';
  if (item.ruta) {
    return (
      <NavLink to={item.ruta} onClick={alNavegar} title={conTitulo ? item.nombre : undefined}
        className={({ isActive }) => unir(base, 'hover:bg-menu-activo', isActive && 'bg-menu-activo font-semibold')}>
        <IconoMenu nombre={item.icono} />
        <span className={texto}>{item.nombre}</span>
        {item.etiqueta ? <span className={OCULTO[modo]}><Insignia tono={TONO_DE_ESTADO[item.estado]}>{item.etiqueta}</Insignia></span> : null}
      </NavLink>
    );
  }
  return (
    <div className={unir(base, 'flex-wrap py-2 opacity-80')} title={conTitulo ? `${item.nombre} · ${item.nota}` : undefined}>
      <IconoMenu nombre="candado" />
      <span className={texto}>{item.nombre}</span>
      <div className={unir('flex w-full flex-wrap items-center gap-2', OCULTO[modo])}>
          <span className="w-full pl-8 text-xs text-menu-texto/80">{item.nota}</span>
          {item.accion ? (
            <button type="button" className="ml-8 cursor-pointer rounded-control border border-menu-texto/50 px-3 py-1 text-xs font-semibold hover:bg-menu-activo"
              onClick={() => void solicitarModulo(item.accion!.codigo, item.nombre)}>
              Solicitar
            </button>
          ) : (
            <Insignia tono="neutro">{item.etiqueta}</Insignia>
          )}
      </div>
    </div>
  );
}

function Grupo({ titulo, items, modo, alNavegar }: { titulo?: string; items: ItemDeMenu[]; modo: ModoDeMenu; alNavegar?: () => void }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-0.5">
      {titulo ? <h2 className={unir('px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-menu-texto/70 uppercase', SOLO_LECTORES[modo])}>{titulo}</h2> : null}
      {items.map((i) => <Fila key={i.clave} item={i} modo={modo} alNavegar={alNavegar} />)}
      {items.length === 0 ? <p className={unir('px-3 pb-1 text-xs text-menu-texto/70', SOLO_LECTORES[modo])}>Sin módulos disponibles todavía.</p> : null}
    </section>
  );
}

/** Todo el menú: núcleo, familias y ajustes. Lo usan la barra lateral y la hoja «Más» del móvil. */
export function ListaDeMenu({ menu, modo, alNavegar }: Props) {
  return (
    <>
      <Grupo items={menu.nucleo} modo={modo} alNavegar={alNavegar} />
      {menu.familias.map((f) => <Grupo key={f.familia} titulo={f.nombre} items={f.items} modo={modo} alNavegar={alNavegar} />)}
      <Grupo titulo="Ajustes" items={menu.ajustes} modo={modo} alNavegar={alNavegar} />
    </>
  );
}
