import { Outlet } from 'react-router';
import { seccionesDe } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';

const RAIZ = '/m/produccion';

/** Marco de Producción: las pestañas de sus secciones construidas (las del manifiesto) sobre cada pantalla, como en Registro. */
export function MarcoDeProduccion() {
  const yo = useYo();
  const secciones = seccionesDe(yo, 'produccion').map((s) => ({ a: s.ruta, texto: s.nombre, fin: s.ruta === RAIZ }));
  return (
    <div className="flex flex-col gap-4">
      {secciones.length > 0 ? <NavegacionDeSeccion etiqueta="Secciones de Producción" secciones={secciones} /> : null}
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
