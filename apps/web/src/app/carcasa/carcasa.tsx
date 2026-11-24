import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { usePendientes } from '../../core/bandeja/use-pendientes.ts';
import { cerrarSesion } from '../../core/acceso/api.ts';
import { LanzadorDelAgente } from '../../core/agente/lanzador-del-agente.tsx';
import { esAtajoDelAgente } from '../../core/agente/logica-lanzador.ts';
import { puedeDictar } from '../../core/agente/logica-panel.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { BarraInferior } from './barra-inferior.tsx';
import { BarraSuperior } from './barra-superior.tsx';
import { MenuLateral } from './menu-lateral.tsx';
import { PaletaDeComandos } from './paleta-de-comandos.tsx';
import { avisoDeAccesoDenegado, menuDesdeYo } from './menu.ts';
import { migasDeRuta } from './migas.ts';
import { leerPlegado, guardarPlegado } from './plegado.ts';

// El panel del asistente no pesa nada hasta que alguien lo abre: se descarga en el primer clic.
const PanelDelAgente = lazy(() => import('../../core/agente/panel-del-agente.tsx').then((m) => ({ default: m.PanelDelAgente })));

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
  const [paleta, setPaleta] = useState(false);
  const [agente, setAgente] = useState(false);
  const [agenteCargado, setAgenteCargado] = useState(false);
  const menu = useMemo(() => (yo?.empresa ? menuDesdeYo(yo) : null), [yo]);
  const { pendientes } = usePendientes(Boolean(yo?.empresa) && (yo?.permisos.includes('borradores:ver') ?? false));
  const aviso = yo?.empresa ? avisoDeAccesoDenegado(yo, pathname) : null;

  useEffect(() => {
    if (!aviso) return;
    notificar(aviso, 'aviso');
    void navegar('/inicio', { replace: true });
  }, [aviso, navegar]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((a) => !a);
      }
      if (esAtajoDelAgente(e)) {
        e.preventDefault();
        setAgente((a) => !a);
        setAgenteCargado(true);
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  if (yo && !yo.empresa && yo.operador && pathname.startsWith('/plataforma')) {
    return (
      <div className="min-h-dvh bg-fondo">
        <header className="flex items-center justify-between border-b border-borde bg-superficie px-4 py-3 md:px-6">
          <span className="truncate font-titulo text-lg font-semibold">Capaz<span className="hidden sm:inline"> · Consola de plataforma</span></span>
          <span className="flex shrink-0 items-center gap-3 text-sm text-texto-suave">
            <span className="hidden sm:inline">{yo.usuario.correo}</span>
            <button type="button" onClick={() => void salir()} className="cursor-pointer font-semibold text-accion underline underline-offset-2">Cerrar sesión</button>
          </span>
        </header>
        <main id="contenido" className="mx-auto max-w-6xl px-4 py-6 md:px-6"><Outlet /></main>
      </div>
    );
  }

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
        alPlegar={() => { guardarPlegado(!plegado); setPlegado(!plegado); }} alSalir={() => void salir()} alBuscar={() => setPaleta(true)} />
      <div className="flex">
        <MenuLateral menu={menu} plegado={plegado} pendientes={pendientes} />
        <main id="contenido" className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-6 md:pb-8">
          {aviso ? null : <Outlet />}
        </main>
      </div>
      <PaletaDeComandos menu={menu} abierta={paleta} alCambiar={setPaleta} puedeVerClientes={menu.nucleo.some((i) => i.clave === 'clientes' && i.ruta !== null)} />
      <BarraInferior menu={menu} alSalir={() => void salir()} pendientes={pendientes} />
      <LanzadorDelAgente abierto={agente} alAbrir={() => { setAgente(true); setAgenteCargado(true); }} />
      {agenteCargado ? (
        <Suspense fallback={null}>
          <PanelDelAgente abierto={agente} alCerrar={() => setAgente(false)} migas={migasDeRuta(menu, pathname)} puedeDictar={puedeDictar(yo)} />
        </Suspense>
      ) : null}
    </div>
  );
}
