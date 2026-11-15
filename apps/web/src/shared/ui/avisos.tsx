import { useSyncExternalStore } from 'react';
import { Boton } from './boton.tsx';
import { Icono } from './icono.tsx';
import type { NombreDeIcono } from './iconos.tsx';
import { almacenDeAvisos, descartarAviso, type TipoDeAviso } from './notificar.ts';
import { unir } from './unir.ts';

const ICONO_DE: Record<TipoDeAviso, NombreDeIcono> = { exito: 'exito', info: 'info', aviso: 'aviso', error: 'error' };
const COLOR_DE: Record<TipoDeAviso, string> = {
  exito: 'text-exito',
  info: 'text-info',
  aviso: 'text-aviso',
  error: 'text-peligro',
};

/** Zona de avisos: se monta una sola vez (en `Proveedores`). */
export function Avisos() {
  const lista = useSyncExternalStore(almacenDeAvisos.suscribir, almacenDeAvisos.leer, almacenDeAvisos.leer);
  return (
    <div
      role="region"
      aria-label="Avisos"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {lista.map((a) => (
        <div
          key={a.id}
          role={a.tipo === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-tarjeta border border-borde bg-superficie py-1 pl-3 text-texto shadow-elevada"
        >
          <Icono nombre={ICONO_DE[a.tipo]} className={unir(COLOR_DE[a.tipo])} />
          <p className="flex-1">{a.mensaje}</p>
          <Boton variante="fantasma" icono="cerrar" aria-label="Cerrar aviso" onClick={() => descartarAviso(a.id)} />
        </div>
      ))}
    </div>
  );
}
