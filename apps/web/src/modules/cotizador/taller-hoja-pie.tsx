import { Boton } from '../../shared/ui/boton.tsx';

/** Los botones de cierre de toda hoja del taller. */
export function PieDeHoja({ alCerrar, guardando, etiqueta }: { alCerrar: () => void; guardando: boolean; etiqueta: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
      <Boton type="submit" variante="primario" cargando={guardando}>{etiqueta}</Boton>
    </div>
  );
}
