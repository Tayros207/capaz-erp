import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { copiarTexto } from './navegador.ts';

export type SecretoMostrado = { titulo: string; explicacion: string; etiqueta: string; valor: string };

/**
 * Muestra un secreto UNA vez. El valor vive solo en el estado de quien la abre y se borra al cerrar
 * (el contenido ni siquiera se monta con la hoja cerrada). No se guarda en ningún almacenamiento.
 */
export function HojaSecreto({ secreto, alCerrar }: { secreto: SecretoMostrado | null; alCerrar: () => void }) {
  return (
    <HojaInferior abierto={secreto !== null} alCerrar={alCerrar} titulo={secreto?.titulo ?? 'Secreto'}>
      {secreto ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="rounded-control border border-aviso/40 bg-aviso/15 px-3 py-2 text-sm font-medium text-texto">
            Cópialo ahora y guárdalo en un lugar seguro. Por seguridad no se vuelve a mostrar: si lo pierdes, tendrás que generar uno nuevo.
          </p>
          <p>{secreto.explicacion}</p>
          <Campo etiqueta={secreto.etiqueta} readOnly autoComplete="off" spellCheck={false} value={secreto.valor} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="primario" icono="check" onClick={() => void copiarTexto(secreto.valor, 'Copiado.')}>Copiar</Boton>
            <Boton variante="fantasma" onClick={alCerrar}>Ya lo guardé</Boton>
          </div>
        </div>
      ) : null}
    </HojaInferior>
  );
}
