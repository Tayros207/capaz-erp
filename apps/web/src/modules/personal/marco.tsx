import { Outlet } from 'react-router';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';

/** Marco de Personal: la navegación entre sus secciones y, debajo, la pantalla. */
export function MarcoDePersonal() {
  return (
    <div className="flex flex-col gap-4">
      <NavegacionDeSeccion
        etiqueta="Secciones de Personal"
        secciones={[
          { a: '/m/personal', texto: 'Colaboradores', fin: true },
          { a: '/m/personal/asistencia', texto: 'Asistencia' },
          { a: '/m/personal/adelantos', texto: 'Adelantos' },
        ]}
      />
      <Outlet />
    </div>
  );
}

export function Cargando({ etiqueta }: { etiqueta: string }) {
  return (
    <div aria-busy="true" aria-label={etiqueta} className="flex flex-col gap-2">
      <Esqueleto className="h-12" />
      <Esqueleto className="h-12" />
      <Esqueleto className="h-12" />
    </div>
  );
}
