import type { ReactNode } from 'react';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';

const SECCIONES = [
  { a: '/m/crm', texto: 'Tablero', fin: true },
  { a: '/m/crm/lista', texto: 'Oportunidades' },
  { a: '/m/crm/actividades', texto: 'Actividades' },
  { a: '/m/crm/ajustes', texto: 'Etapas' },
];

/** Navegación entre las secciones del CRM sobre cada pantalla. */
export function MarcoCrm({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <NavegacionDeSeccion etiqueta="Secciones del CRM" secciones={SECCIONES} />
      {children}
    </div>
  );
}
