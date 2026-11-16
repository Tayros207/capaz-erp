import { createElement } from 'react';
import type { ModuloDeEmpresaDto } from '@capaz/shared';
import { notificar } from '../shared/ui/notificar.ts';
import { unir } from '../shared/ui/unir.ts';
import { iconoDeModulo } from './iconos-de-modulo.ts';
import { nombreDeModulo } from './logica.ts';

type Estado = ModuloDeEmpresaDto['estado'];


const PUNTO: Record<Estado, string> = { prueba: 'bg-info', activo: 'bg-exito', suspendido: 'bg-aviso', baja: 'bg-peligro' };
const TEXTO_DE_ESTADO: Record<Estado, string> = { prueba: 'en prueba', activo: 'activo', suspendido: 'suspendido', baja: 'de baja' };

async function copiar(codigo: string) {
  try {
    await navigator.clipboard.writeText(codigo);
    notificar(`Código «${codigo}» copiado.`, 'exito');
  } catch {
    notificar('No se pudo copiar. Selecciona el código a mano.', 'aviso');
  }
}

/** Código técnico del módulo en tipografía mono; al pulsarlo se copia. */
export function CodigoDeModulo({ codigo, className }: { codigo: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copiar(codigo);
      }}
      title="Copiar el código"
      aria-label={`Copiar el código ${codigo}`}
      className={unir(
        'cursor-pointer rounded-chip bg-superficie-alta px-1.5 py-px font-mono text-[0.6875rem] leading-4 text-texto-suave transition-colors hover:bg-borde hover:text-texto',
        className,
      )}
    >
      {codigo}
    </button>
  );
}

/** Módulo con icono, nombre legible, punto de estado y código copiable. */
export function ChipDeModulo({ codigo, estado, className }: { codigo: string; estado?: Estado; className?: string }) {
  return (
    <span className={unir('inline-flex items-center gap-1.5 rounded-control border border-borde bg-superficie py-0.5 pr-1 pl-1.5 text-xs shadow-sutil', className)}>
      {createElement(iconoDeModulo(codigo), { 'aria-hidden': true, className: 'size-3.5 shrink-0 text-texto-suave', strokeWidth: 1.75 })}
      <span className="font-medium text-texto">{nombreDeModulo(codigo)}</span>
      {estado ? (
        <span className="inline-flex items-center" title={TEXTO_DE_ESTADO[estado]}>
          <span aria-hidden className={unir('size-1.5 rounded-full', PUNTO[estado])} />
          <span className="sr-only">{TEXTO_DE_ESTADO[estado]}</span>
        </span>
      ) : null}
      <CodigoDeModulo codigo={codigo} />
    </span>
  );
}
