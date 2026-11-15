import type { ReactNode } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';

// Glifos propios del menú (trazo de 2 px sobre rejilla de 24). Se eligen por el nombre de icono del
// manifiesto o por la clave del destino; lo que no se conoce cae en el icono genérico del kit.
const GLIFOS: Record<string, ReactNode> = {
  bandeja: <path d="M4 13.5 6.5 5h11l2.5 8.5M4 13.5V19h16v-5.5M4 13.5h4.5l1 2h5l1-2H20" />,
  clientes: (<><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.5-3.2 2.6-5 5.5-5s5 1.8 5.5 5M16 6.2a3 3 0 0 1 0 5.6M17.5 14.3c1.8.5 2.8 2.2 3 4.7" /></>),
  productos: <path d="M12 3.5 20 8v8l-8 4.500L4 16V8l8-4.500ZM4 8l8 4.500L20 8M12 12.500v8" />,
  empresa: <path d="M4 20V6l8-2.500V20M12 9.500l8 2.500V20M2.5 20h19M7.5 9v.1M7.5 13v.1M16 15v.1" />,
  sucursales: (<><path d="M12 20.500s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" /><circle cx="12" cy="10.5" r="2" /></>),
  conecta: <path d="M9.5 14.5 14.5 9.500M8 11 6 13a3.5 3.5 0 0 0 5 5l2-2M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2" />,
  automatizaciones: <path d="M13 3.5 5.5 13.500H11L10 20.500l8-10h-5.500L13 3.500Z" />,
  historial: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.500V12l3 2" /></>),
  ventas: <path d="M4 19V9m5.5 10V5m5.5 14v-7m5.5 7V8" />,
  compras: (<><path d="M4 5h2.500l2 10h9l2-7.500H8" /><circle cx="10" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></>),
  inventario: <path d="M3.5 9 12 4l8.5 5v10.500h-17V9ZM8 19.500v-6h8v6" />,
  finanzas: (<><rect x="3.5" y="6" width="17" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
  personal: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-4 3.2-6 7-6s6.4 2 7 6" /></>),
  produccion: <path d="M4 20V10l5 3V9l5 3V6h6v14H4Z" />,
  analisis: <path d="M4 20h16M7 16v-4m5 4V8m5 8v-6" />,
  conexiones: (<><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="m8 11 8-4M8 13l8 4" /></>),
  candado: (<><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.500V8a3.5 3.5 0 0 1 7 0v2.5" /></>),
  salir: <path d="M10 4.500H5.500v15H10M14.5 8.5 18 12l-3.5 3.500M18 12H9.5" />,
  'panel-izquierda': <path d="M4.5 5h15v14h-15zM9.5 5v14" />,
};

export function IconoMenu({ nombre, className }: { nombre: string; className?: string }) {
  const glifo = GLIFOS[nombre];
  if (!glifo) return <Icono nombre={nombre === 'inicio' || nombre === 'usuario' || nombre === 'menu' || nombre === 'mas' ? nombre : 'caja'} className={className} />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={unir('size-5 shrink-0', className)} aria-hidden="true" focusable="false">
      {glifo}
    </svg>
  );
}
