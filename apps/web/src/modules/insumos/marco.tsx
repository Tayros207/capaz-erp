import { Outlet } from 'react-router';
import type { MovimientoDeInsumoDto } from '@capaz/shared';
import { seccionesDe } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';
import { cantidadConSigno, ETIQUETA_DE_TIPO } from './logica.ts';

const RAIZ = '/m/insumos';

/** Marco de Inventario: navegación entre sus secciones construidas (las del manifiesto). */
export function MarcoDeInventario() {
  const yo = useYo();
  const secciones = seccionesDe(yo, 'insumos').map((s) => ({ a: s.ruta, texto: s.nombre, fin: s.ruta === RAIZ }));
  return (
    <div className="flex flex-col gap-4">
      {secciones.length > 0 ? <NavegacionDeSeccion etiqueta="Secciones de Inventario" secciones={secciones} /> : null}
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

/** «Bajo mínimo» siempre con texto: el color solo nunca comunica un estado. */
export const InsigniaBajoMinimo = ({ bajo }: { bajo: boolean }) => (bajo ? <Insignia tono="aviso">Bajo mínimo</Insignia> : null);

// En la insignia el ajuste va en «info»: el ámbar queda para «Bajo mínimo».
const TONO_DE_INSIGNIA = { entrada: 'exito', salida: 'peligro', ajuste: 'info' } as const;

export const InsigniaDeTipo = ({ m }: { m: Pick<MovimientoDeInsumoDto, 'tipo'> }) => <Insignia tono={TONO_DE_INSIGNIA[m.tipo]}>{ETIQUETA_DE_TIPO[m.tipo]}</Insignia>;

const CLASE_DE_TONO = { exito: 'text-exito', peligro: 'text-peligro', aviso: 'text-aviso', neutro: 'text-texto' } as const;

/** Cantidad de un movimiento con signo y tono. */
export function CantidadDeMovimiento({ m }: { m: Pick<MovimientoDeInsumoDto, 'cantidadMilesimas' | 'unidad' | 'tipo'> }) {
  const { texto, tono } = cantidadConSigno(m);
  return <span className={`font-medium tabular-nums ${CLASE_DE_TONO[tono]}`}>{texto}</span>;
}
