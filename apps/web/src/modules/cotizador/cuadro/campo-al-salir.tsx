import { useState } from 'react';
import { Campo } from '../../../shared/ui/campo.tsx';

type Props = {
  etiqueta: string;
  valor: string;
  /** Se llama al salir del campo si el texto cambió. Devuelve un error local para mostrarlo, o `null` si salió bien. */
  alConfirmar: (texto: string) => Promise<string | null> | string | null;
  deshabilitado?: boolean;
  decimal?: boolean;
  ayuda?: string;
  maxLength?: number;
};

/** Campo que guarda al salir (o con Enter): si el servidor rechaza el cambio, vuelve al valor que tenía. */
export function CampoAlSalir({ etiqueta, valor, alConfirmar, deshabilitado, decimal, ayuda, maxLength }: Props) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function salir() {
    if (borrador === null || borrador === valor) return setBorrador(null);
    const mensaje = await alConfirmar(borrador);
    setError(mensaje);
    setBorrador(null);
  }
  return (
    <Campo
      etiqueta={etiqueta}
      value={borrador ?? valor}
      disabled={deshabilitado}
      inputMode={decimal ? 'decimal' : undefined}
      maxLength={maxLength}
      ayuda={ayuda}
      error={error ?? undefined}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={() => void salir()}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
