import { milesimasATexto } from '../formato/milesimas.ts';
import { CampoDeMilesimas, type PropsDeMilesimas } from './campo-milesimas.tsx';

/** Precio unitario en soles con hasta tres decimales. El valor que entra y sale es en milésimas de sol. */
export function CampoPrecio(props: PropsDeMilesimas) {
  return <CampoDeMilesimas {...props} prefijo="S/" textoDe={milesimasATexto} mensajeInvalido="Escribe un precio válido, por ejemplo 12.50." />;
}
