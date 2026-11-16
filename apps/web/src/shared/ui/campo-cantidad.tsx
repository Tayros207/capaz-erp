import { formatearCantidad } from '../formato/milesimas.ts';
import { CampoDeMilesimas, type PropsDeMilesimas } from './campo-milesimas.tsx';

/** Cantidad con hasta tres decimales. El valor que entra y sale es en milésimas (12.5 = 12500). */
export function CampoCantidad({ unidad, ...props }: PropsDeMilesimas & { unidad?: string }) {
  return (
    <CampoDeMilesimas
      {...props}
      sufijo={unidad}
      textoDe={(m) => formatearCantidad(m).replace(/,/g, '')}
      mensajeInvalido="Escribe una cantidad válida, por ejemplo 12.5."
    />
  );
}
