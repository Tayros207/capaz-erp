import { useState } from 'react';
import { CAMPOS_DE_FICHA, EJEMPLO_DE_CAMPO_DE_FICHA, ETIQUETA_DE_CAMPO_DE_FICHA, MAXIMO_DE_CAMPO_DE_FICHA, textoDeFicha, type CampoDeFicha } from '@capaz/shared';
import { Campo } from './campo.tsx';
import { unir } from './unir.ts';

// «Ficha de máquina (opcional)» de una línea. Nace plegada si está vacía (390 px), abierta si ya tiene algo. La escribe la persona: nunca se adivina.

export type ValoresDeFicha = Readonly<Record<CampoDeFicha, string>>;

type Props = { n: number; valores: ValoresDeFicha; deshabilitado?: boolean; className?: string; alCambiar: (campo: CampoDeFicha, valor: string) => void };

export function FichaDeMaquina({ n, valores, deshabilitado = false, className, alCambiar }: Props) {
  const resumen = textoDeFicha(valores);
  const [abierta, setAbierta] = useState(() => resumen !== '');
  return (
    <details open={abierta} onToggle={(e) => setAbierta(e.currentTarget.open)} className={unir('rounded-control border border-borde px-3 py-2', className)}>
      <summary className="cursor-pointer py-1 text-sm font-medium text-texto">
        Ficha de máquina (opcional)
        {!abierta && resumen ? <span className="ml-2 break-words font-normal text-texto-suave">{resumen}</span> : null}
      </summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {CAMPOS_DE_FICHA.map((c) => (
          <Campo key={c} etiqueta={ETIQUETA_DE_CAMPO_DE_FICHA[c]} aria-label={`${ETIQUETA_DE_CAMPO_DE_FICHA[c]} del ítem ${n}`} maxLength={MAXIMO_DE_CAMPO_DE_FICHA} placeholder={EJEMPLO_DE_CAMPO_DE_FICHA[c]} disabled={deshabilitado} value={valores[c]} onChange={(e) => alCambiar(c, e.target.value)} />
        ))}
      </div>
    </details>
  );
}
