import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './shared/estilos/tokens.css';
import { Proveedores } from './app/proveedores.tsx';
import { recargarTrasDespliegue } from './app/recarga-tras-despliegue.ts';
import { router } from './app/rutas.tsx';

recargarTrasDespliegue();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Proveedores>
      <RouterProvider router={router} />
    </Proveedores>
  </StrictMode>,
);
