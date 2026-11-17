import { Outlet } from 'react-router';
import { seccionesDe } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';

const RAIZ = '/m/compras';

/** Marco de Compras: navegación entre sus secciones construidas (las del manifiesto) sobre cada pantalla. */
export function MarcoDeCompras() {
  const yo = useYo();
  const secciones = seccionesDe(yo, 'compras').map((s) => ({ a: s.ruta, texto: s.nombre, fin: s.ruta === RAIZ }));
  return (
    <div className="flex flex-col gap-4">
      {secciones.length > 1 ? <NavegacionDeSeccion etiqueta="Secciones de Compras" secciones={secciones} /> : null}
      <Outlet />
    </div>
  );
}
