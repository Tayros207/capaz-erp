import { Boton } from '../boton.tsx';

type Props = {
  /** Cursor de la página siguiente (`siguiente` del listado); nulo si no hay más. */
  cursor: string | null;
  cargando?: boolean;
  onCargar: (cursor: string) => void;
  /** Texto del resumen, p. ej. «Mostrando 50 de 200». */
  resumen?: string;
};

export function CargarMas({ cursor, cargando, onCargar, resumen }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      {resumen ? (
        <p className="text-sm text-texto-suave" role="status">
          {resumen}
        </p>
      ) : null}
      {cursor === null ? (
        <p className="text-sm text-texto-suave">No hay más resultados.</p>
      ) : (
        <Boton cargando={cargando} onClick={() => onCargar(cursor)}>
          Cargar más
        </Boton>
      )}
    </div>
  );
}
