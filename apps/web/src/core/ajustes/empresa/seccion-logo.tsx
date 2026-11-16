import { useRef, useState } from 'react';
import { Boton } from '../../../shared/ui/boton.tsx';
import { logoSeguro, TIPOS_DE_LOGO } from './logica-logo.ts';
import { prepararLogo } from './leer-logo.ts';

type Props = {
  valor: string;
  onCambio: (dataUrl: string) => void;
};

/** Vista previa del logo, con subida de archivo (se reduce en el navegador) y «Quitar logo». */
export function EdicionDeLogo({ valor, onCambio }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const [procesando, setProcesando] = useState(false);
  const imagen = logoSeguro(valor);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(undefined);
    setProcesando(true);
    try {
      onCambio(await prepararLogo(archivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el logo.');
    } finally {
      setProcesando(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-24 items-center justify-center rounded-control border border-dashed border-borde-fuerte bg-white p-3">
        {imagen ? <img src={imagen} alt="Vista previa del logo" className="max-h-24 max-w-full object-contain" /> : <p className="text-sm text-texto-suave">Sin logo</p>}
      </div>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_DE_LOGO.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivo del logo"
        onChange={(e) => void elegir(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" cargando={procesando} onClick={() => entrada.current?.click()}>
          {imagen ? 'Cambiar logo' : 'Subir logo'}
        </Boton>
        {imagen ? (
          <Boton variante="fantasma" onClick={() => onCambio('')}>
            Quitar logo
          </Boton>
        ) : null}
      </div>
      <p className="text-sm text-texto-suave">PNG, JPEG o WebP. Se reduce a 400 px de ancho para que quepa en tus documentos.</p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-peligro">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Logo en modo lectura. */
export function LecturaDeLogo({ valor }: { valor: string | null }) {
  const imagen = logoSeguro(valor);
  return imagen ? (
    <img src={imagen} alt="Logo de la empresa" className="max-h-24 max-w-full rounded-control border border-borde bg-white object-contain p-2" />
  ) : (
    <p className="text-texto-suave">Sin logo</p>
  );
}
