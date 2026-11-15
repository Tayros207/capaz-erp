// `proponerBorrador(tx, b)` es una función suelta (firma congelada, §6.2) y no puede inyectar el
// registro de herramientas: el proveedor de Nest lo conecta aquí al arrancar. Las pruebas conectan el suyo.

export type DatosDeHerramienta = { modulo: string; permiso: string | null };
export type BuscarHerramienta = (nombre: string) => DatosDeHerramienta | undefined;

let buscar: BuscarHerramienta | null = null;

export function conectarCatalogo(b: BuscarHerramienta | null): void {
  buscar = b;
}

export function datosDeHerramienta(nombre: string): DatosDeHerramienta | undefined {
  if (!buscar) throw new Error('Los borradores no están conectados al registro de herramientas.');
  return buscar(nombre);
}
