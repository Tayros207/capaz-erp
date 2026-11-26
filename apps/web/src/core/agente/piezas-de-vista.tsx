import type { ReactNode } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import type { NombreDeIcono } from '../../shared/ui/iconos.tsx';

// Las piezas que comparten el historial y los ajustes del asistente: la barra de volver y los estados de carga, error y vacío.

/** Una tarjeta de las vistas del asistente. */
export const TARJETA = 'rounded-3xl border border-borde/80 bg-superficie/85 shadow-sutil';

export function EncabezadoDeVista({ titulo, alVolver }: { titulo: string; alVolver: () => void }): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <Boton variante="secundario" icono="atras" aria-label="Volver a la conversación" className="rounded-full" onClick={alVolver} />
      <h3 className="font-titulo text-lg font-semibold tracking-tight text-texto">{titulo}</h3>
    </div>
  );
}

export function CargandoLista({ etiqueta, alto = 'h-16' }: { etiqueta: string; alto?: string }): ReactNode {
  return (
    <div aria-busy="true" aria-label={etiqueta} className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => <Esqueleto key={i} className={`w-full rounded-3xl ${alto}`} />)}
    </div>
  );
}

export function ErrorConReintento({ mensaje, alReintentar }: { mensaje: string; alReintentar: () => void }): ReactNode {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-3xl border border-peligro/40 bg-peligro/10 p-4 text-sm text-texto">
      <p>{mensaje}</p>
      <Boton variante="secundario" onClick={alReintentar}>Reintentar</Boton>
    </div>
  );
}

export function SinNada({ icono, texto }: { icono: NombreDeIcono; texto: string }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-asistente-2/12 text-asistente-tinta-2"><Icono nombre={icono} className="size-6" /></span>
      <p className="max-w-[30ch] text-sm text-balance text-texto-suave">{texto}</p>
    </div>
  );
}
