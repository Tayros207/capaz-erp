import type { ReactNode } from 'react';

// Iconos propios, trazo de 2 px sobre una rejilla de 24. Se dibujan aquí; ninguno viene de otra librería.
export const ICONOS = {
  inicio: <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'flecha-abajo': <path d="m6 9.5 6 6 6-6" />,
  'flecha-derecha': <path d="m9.5 6 6 6-6 6" />,
  aviso: (
    <>
      <path d="M12 4 3 19.5h18L12 4Z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.9v.1" />
    </>
  ),
  exito: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.3 2.5 2.5 4.7-5" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  carpeta: <path d="M3.5 7.5v10.5h17V9H12l-2-2H3.5Z" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </>
  ),
  luna: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  caja: <path d="M4 8 12 4l8 4v8.5L12 20.5 4 16.5V8Zm0 0 8 4m8-4-8 4m0 0v8.5" />,
} satisfies Record<string, ReactNode>;

export type NombreDeIcono = keyof typeof ICONOS;
