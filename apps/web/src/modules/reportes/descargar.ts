import { nombreDeArchivoSeguro } from './logica.ts';

/** Entrega un texto como archivo CSV descargable. El servidor ya incluye el BOM para que Excel lea las tildes. */
export function descargarCsv(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreDeArchivoSeguro(nombre);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
