import type { ReactNode } from 'react';
import { Boton } from '../boton.tsx';
import { confirmar } from '../confirmar.ts';
import { descartarPideConfirmar, type EstadoDeFicha } from './logica-ficha.ts';

export type SeccionDeFicha = {
  id: string;
  titulo: string;
  /** Contenido en modo lectura. */
  lectura: ReactNode;
  /** Contenido en modo edición; si falta, la sección sigue en lectura. */
  edicion?: ReactNode;
};

type Props = {
  secciones: SeccionDeFicha[];
  /** Estado de `useFicha()`. */
  estado: EstadoDeFicha;
  onEditar: () => void;
  onGuardar: () => void;
  onDescartar: () => void;
  /** Oculta el botón Editar (documento cerrado, sin permiso…). */
  soloLectura?: boolean;
};

export function Ficha({ secciones, estado, onEditar, onGuardar, onDescartar, soloLectura }: Props) {
  const editando = estado.modo === 'edicion';

  async function descartar() {
    if (descartarPideConfirmar(estado)) {
      const si = await confirmar('Descartar cambios', 'Hay cambios sin guardar. Si sigues, se pierden.', { textoConfirmar: 'Descartar', peligroso: true });
      if (!si) return;
    }
    onDescartar();
  }

  return (
    <form
      aria-busy={estado.guardando || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar();
      }}
      className="flex flex-col gap-4"
    >
      {secciones.map((s) => (
        <section key={s.id} aria-labelledby={`ficha-${s.id}`} className="rounded-tarjeta border border-borde bg-superficie">
          <h2 id={`ficha-${s.id}`} className="border-b border-borde px-4 py-2 font-titulo text-base font-semibold text-texto">
            {s.titulo}
          </h2>
          <div className="p-4">{editando && s.edicion ? <fieldset disabled={estado.guardando} className="contents">{s.edicion}</fieldset> : s.lectura}</div>
        </section>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-borde bg-fondo py-3">
        {editando ? (
          <>
            {estado.sucio ? <span className="mr-auto text-sm text-aviso" role="status">Cambios sin guardar</span> : null}
            <Boton variante="fantasma" disabled={estado.guardando} onClick={descartar}>Descartar</Boton>
            <Boton type="submit" variante="primario" cargando={estado.guardando}>Guardar</Boton>
          </>
        ) : soloLectura ? null : (
          <Boton variante="primario" onClick={onEditar}>Editar</Boton>
        )}
      </div>
    </form>
  );
}
