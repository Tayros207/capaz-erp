import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';

export function SeccionesDelCotizador() {
  return (
    <NavegacionDeSeccion
      etiqueta="Secciones del Cotizador"
      secciones={[
        { a: '/m/cotizador', texto: 'Cotización rápida', fin: true },
        { a: '/m/cotizador/cuadro/nuevo', texto: 'Por partes' },
        { a: '/m/cotizador/cotizaciones', texto: 'Cotizaciones' },
        { a: '/m/cotizador/precios', texto: 'Lista de precios' },
        { a: '/m/cotizador/ajustes', texto: 'Ajustes' },
        { a: '/m/cotizador/taller', texto: 'Taller' },
      ]}
    />
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
