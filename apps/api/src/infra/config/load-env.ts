// Carga el .env de la raíz del repositorio si existe (sin dependencias extra).
// En producción las variables llegan del entorno y este archivo no existe.
// Nota: lee `process.env` solo a través de Node; la validación vive en config.ts.
try {
  process.loadEnvFile(new URL('../../../../../.env', import.meta.url));
} catch {
  // Sin .env: se usan las variables que ya haya en el entorno.
}
