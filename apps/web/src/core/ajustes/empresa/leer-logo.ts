import { dimensionesReducidas, elegirLogo, MENSAJE_LOGO_NO_CABE, validarArchivoDeLogo } from './logica-logo.ts';

// Lectura del archivo en el navegador: se decodifica, se reduce con canvas y se exporta hasta que quepa.

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la imagen. Prueba con otro archivo.'));
    };
    img.src = url;
  });
}

/** Devuelve el data URL reducido y comprimido, o lanza un Error con un mensaje claro en español. */
export async function prepararLogo(archivo: File): Promise<string> {
  const problema = validarArchivoDeLogo(archivo);
  if (problema) throw new Error(problema);
  const img = await cargarImagen(archivo);
  const base = dimensionesReducidas(img.naturalWidth, img.naturalHeight);
  const lienzo = document.createElement('canvas');
  const url = elegirLogo(({ tipo, calidad, escala }) => {
    lienzo.width = Math.max(1, Math.round(base.ancho * escala));
    lienzo.height = Math.max(1, Math.round(base.alto * escala));
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    if (tipo === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'; // JPEG no tiene transparencia
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    } else {
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    }
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL(tipo, calidad);
  });
  if (!url) throw new Error(MENSAJE_LOGO_NO_CABE);
  return url;
}
