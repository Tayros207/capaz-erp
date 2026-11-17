import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { agregarUnidad, MAXIMO_DE_CARACTERES_DE_UNIDAD, moverUnidad, quitarUnidad } from './logica-unidades.ts';

type Props = { unidades: string[]; alCambiar: (unidades: string[]) => void; deshabilitado?: boolean };

/** Las unidades que la empresa ofrece al anotar cantidades: agregar, quitar y reordenar. Se guardan con «Guardar ajustes». */
export function TarjetaDeUnidades({ unidades, alCambiar, deshabilitado }: Props) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();

  function agregar() {
    const r = agregarUnidad(unidades, texto);
    if ('error' in r) { setError(r.error); return; }
    setError(undefined);
    setTexto('');
    alCambiar(r.lista);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-titulo text-lg font-semibold text-texto">Unidades</h3>
      <p className="text-sm text-texto-suave">Salen primero, en «De tu empresa», al elegir la unidad de una lista o de una línea. El orden es el que ves aquí.</p>
      <ul aria-label="Unidades de tu empresa" className="flex flex-col gap-1">
        {unidades.map((u, i) => (
          <li key={u} className="flex items-center justify-between gap-2 rounded-tarjeta border border-borde bg-superficie px-3 py-1">
            <span className="min-w-0 truncate font-medium text-texto">{u}</span>
            <span className="inline-flex shrink-0 gap-1">
              <Boton variante="fantasma" disabled={deshabilitado || i === 0} aria-label={`Subir ${u}`} onClick={() => alCambiar(moverUnidad(unidades, i, -1))}>Subir</Boton>
              <Boton variante="fantasma" disabled={deshabilitado || i === unidades.length - 1} aria-label={`Bajar ${u}`} onClick={() => alCambiar(moverUnidad(unidades, i, 1))}>Bajar</Boton>
              <Boton variante="fantasma" disabled={deshabilitado || unidades.length <= 1} aria-label={`Quitar ${u}`} onClick={() => alCambiar(quitarUnidad(unidades, i))}>Quitar</Boton>
            </span>
          </li>
        ))}
      </ul>
      {deshabilitado ? null : (
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Campo
            etiqueta="Nueva unidad"
            maxLength={MAXIMO_DE_CARACTERES_DE_UNIDAD}
            autoComplete="off"
            value={texto}
            error={error}
            onChange={(e) => { setTexto(e.target.value); setError(undefined); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          />
          <Boton variante="secundario" icono="mas" onClick={agregar}>Agregar</Boton>
        </div>
      )}
    </div>
  );
}
