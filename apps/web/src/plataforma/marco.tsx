import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Esqueleto } from '../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { ErrorDeApi } from './api.ts';
import { CabeceraDeConsola } from './cabecera-de-consola.tsx';
import { PaletaDeOperador } from './paleta-de-operador.tsx';

// Cliente de consultas propio de la consola, mientras no exista un proveedor global.
const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: false } } });


/** Proveedor de consultas, cabecera de «centro de control» y paleta propia de la consola. */
export function Marco({ children, conIndicadores = true }: { children: ReactNode; conIndicadores?: boolean }) {
  return (
    <QueryClientProvider client={cliente}>
      <Contenido conIndicadores={conIndicadores}>{children}</Contenido>
    </QueryClientProvider>
  );
}

function Contenido({ children, conIndicadores }: { children: ReactNode; conIndicadores: boolean }) {
  const [paleta, setPaleta] = useState(false);
  useEffect(() => {
    // En fase de captura y deteniendo la propagación: la paleta de la carcasa (operadores con empresa) no se abre a la vez.
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setPaleta((a) => !a);
      }
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  }, []);
  return (
    <div className="flex flex-col gap-5">
      <CabeceraDeConsola conIndicadores={conIndicadores} alBuscar={() => setPaleta(true)} />
      {children}
      <PaletaDeOperador abierta={paleta} alCambiar={setPaleta} />
    </div>
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
