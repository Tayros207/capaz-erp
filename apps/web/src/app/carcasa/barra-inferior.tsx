import { useState } from 'react';
import { NavLink } from 'react-router';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { IconoMenu } from './iconos-menu.tsx';
import { InsigniaDePendientes } from './insignia-de-pendientes.tsx';
import { ListaDeMenu } from './lista-de-menu.tsx';
import { DESTINOS_INFERIORES, type MenuDeYo } from './menu.ts';

const clase = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-lateral-suave';

/** Barra inferior del móvil: cuatro destinos y «Más», que abre todo el menú. */
export function BarraInferior({ menu, alSalir, pendientes = 0 }: { menu: MenuDeYo; alSalir: () => void; pendientes?: number }) {
  const [abierta, setAbierta] = useState(false);
  const destinos = DESTINOS_INFERIORES.map((c) => menu.nucleo.find((i) => i.clave === c)).filter((i) => i !== undefined);
  return (
    <>
      <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-lateral-borde bg-lateral/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
        {destinos.map((d) => (
          <NavLink key={d.clave} to={d.ruta ?? '/inicio'} className={({ isActive }) => unir(clase, isActive && 'font-medium text-lateral-activo-texto')}>
            <span className="relative">
              <IconoMenu nombre={d.icono} />
              {d.clave === 'bandeja' ? <InsigniaDePendientes cantidad={pendientes} className="absolute -top-1.5 left-3 h-4 text-[0.6875rem]" /> : null}
            </span>
            {d.nombre}
          </NavLink>
        ))}
        <button type="button" className={unir(clase, 'cursor-pointer')} onClick={() => setAbierta(true)} aria-haspopup="dialog">
          <Icono nombre="menu" />
          Más
        </button>
      </nav>
      <HojaInferior abierto={abierta} alCerrar={() => setAbierta(false)} titulo="Menú">
        <nav aria-label="Menú completo" className="flex flex-col gap-1 rounded-tarjeta bg-lateral p-2">
          <ListaDeMenu menu={menu} modo="completo" alNavegar={() => setAbierta(false)} pendientes={pendientes} />
          <button type="button" className="flex min-h-(--alto-control) cursor-pointer items-center gap-3 rounded-control px-3 text-lateral-texto hover:bg-lateral-activo/60" onClick={alSalir}>
            <IconoMenu nombre="salir" />
            Cerrar sesión
          </button>
        </nav>
      </HojaInferior>
    </>
  );
}
