import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Esqueleto } from '../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { unir } from '../shared/ui/unir.ts';
import { ErrorDeApi } from './api.ts';

// Cliente de consultas propio de la consola, mientras no exista un proveedor global.
const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: false } } });


const SECCIONES = [
  { a: '/plataforma', texto: 'Empresas', fin: false },
  { a: '/plataforma/planes', texto: 'Planes', fin: true },
  { a: '/plataforma/solicitudes', texto: 'Solicitudes', fin: true },
] as const;

/** Proveedor de consultas más el menú propio de la consola. */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={cliente}>
      <div className="flex flex-col gap-4">
        <nav aria-label="Consola de plataforma" className="flex gap-1 overflow-x-auto border-b border-borde-fuerte">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.a}
              to={s.a}
              end={s.fin}
              className={({ isActive }) =>
                unir(
                  '-mb-px inline-flex min-h-(--alto-control) items-center border-b-2 px-4 font-medium whitespace-nowrap',
                  isActive ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto',
                )
              }
            >
              {s.texto}
            </NavLink>
          ))}
        </nav>
        {children}
      </div>
    </QueryClientProvider>
  );
}

/** Estado de error de una consulta; `sin_permiso` es «No tienes acceso a la consola». */
export function ErrorDeConsulta({ error }: { error: unknown }) {
  const codigo = error instanceof ErrorDeApi ? error.codigo : '';
  if (codigo === 'sin_permiso') return <EstadoVacio titulo="No tienes acceso a la consola" descripcion="Esta consola es solo para operadores de la plataforma." icono="usuario" />;
  return <EstadoVacio titulo="No pudimos cargar los datos" descripcion={error instanceof Error ? error.message : 'Inténtalo de nuevo.'} icono="caja" />;
}

export function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-3">
      <Esqueleto className="h-10" />
      <Esqueleto className="h-10" />
      <Esqueleto className="h-10" />
    </div>
  );
}
