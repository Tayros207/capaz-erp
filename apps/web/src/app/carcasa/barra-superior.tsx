import type { Yo } from '@capaz/shared';
import { Link } from 'react-router';
import { useTema } from '../../shared/estilos/use-tema.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { IconoMenu } from './iconos-menu.tsx';
import { SelectorDeEmpresa } from './selector-empresa.tsx';
import { IndicadorDeGuardado } from '../../shared/api/llamador/indicador-de-guardado.tsx';

type Props = { yo: Yo; migas: string[]; plegado: boolean; alPlegar: () => void; alSalir: () => void };

export function BarraSuperior({ yo, migas, plegado, alPlegar, alSalir }: Props) {
  const { tema, fijar } = useTema();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-borde bg-superficie px-3 md:px-4">
      <Boton variante="fantasma" aria-label={plegado ? 'Expandir el menú' : 'Plegar el menú'} aria-pressed={plegado}
        className="hidden lg:inline-flex" onClick={alPlegar}>
        <IconoMenu nombre="panel-izquierda" />
      </Boton>
      <Link to="/inicio" className="flex min-h-(--alto-control) items-center gap-2 rounded-control px-1 font-titulo text-lg font-bold text-texto">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-control bg-menu text-menu-texto">C</span>
        <span className="hidden sm:inline">Capaz</span>
      </Link>
      <nav aria-label="Ubicación" className="hidden min-w-0 items-center gap-1 text-sm text-texto-suave lg:flex">
        <Link to="/inicio" className="rounded-control px-1 hover:text-texto">Inicio</Link>
        {migas.filter((m) => m !== 'Inicio').map((m, i, todas) => (
          <span key={m} className="flex items-center gap-1">
            <Icono nombre="flecha-derecha" className="size-4" />
            <span aria-current={i === todas.length - 1 ? 'page' : undefined} className={i === todas.length - 1 ? 'font-semibold text-texto' : undefined}>{m}</span>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-1">
        <IndicadorDeGuardado />
        {yo.empresa ? <SelectorDeEmpresa activa={yo.empresa} empresas={yo.empresas} /> : null}
        <Boton variante="fantasma" icono={tema === 'oscuro' ? 'sol' : 'luna'}
          aria-label={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          onClick={() => fijar(tema === 'oscuro' ? 'claro' : 'oscuro')} />
        <span className="hidden max-w-40 truncate text-sm text-texto-suave xl:inline" title={yo.usuario.correo}>{yo.usuario.nombre}</span>
        <Boton variante="fantasma" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={alSalir}>
          <IconoMenu nombre="salir" />
        </Boton>
      </div>
    </header>
  );
}
