import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { usePendientes } from '../../core/bandeja/use-pendientes.ts';
import { cerrarSesion } from '../../core/acceso/api.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { BarraInferior } from './barra-inferior.tsx';
import { BarraSuperior } from './barra-superior.tsx';
import { MenuLateral } from './menu-lateral.tsx';
import { avisoDeAccesoDenegado, menuDesdeYo } from './menu.ts';
import { migasDeRuta } from './migas.ts';
import { leerPlegado, guardarPlegado } from './plegado.ts';

async function salir() {
  await cerrarSesion();
  // Recarga completa para soltar la sesión en memoria.
  window.location.assign('/iniciar-sesion');
}

/** Disposición de la app: barra superior, menú lateral, barra inferior móvil y contenido. Sin sesión o sin empresa, solo el contenido (pantallas de acceso). */
export function Carcasa() {
  const yo = useYo();
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const [plegado, setPlegado] = useState(leerPlegado);
  const menu = useMemo(() => (yo?.empresa ? menuDesdeYo(yo) : null), [yo]);
  const { pendientes } = usePendientes(Boolean(yo?.empresa) && (yo?.permisos.includes('borradores:ver') ?? false));
  const aviso = yo?.empresa ? avisoDeAccesoDenegado(yo, pathname) : null;

  useEffect(() => {
    if (!aviso) return;
    notificar(aviso, 'aviso');
    void navegar('/inicio', { replace: true });
  }, [aviso, navegar]);

  if (!yo || !yo.empresa || !menu) {
    return (
      <main className="min-h-dvh">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-superficie focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <BarraSuperior yo={yo} migas={migasDeRuta(menu, pathname)} plegado={plegado}
        alPlegar={() => { guardarPlegado(!plegado); setPlegado(!plegado); }} alSalir={() => void salir()} />
      <div className="flex">
        <MenuLateral menu={menu} plegado={plegado} pendientes={pendientes} />
        <main id="contenido" className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-6 md:pb-8">
          {aviso ? null : <Outlet />}
        </main>
      </div>
      <BarraInferior menu={menu} alSalir={() => void salir()} pendientes={pendientes} />
    </div>
  );
}
