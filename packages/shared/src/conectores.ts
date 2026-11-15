import type { z } from 'zod';

// Manifiesto de un conector (ADR-014): lo que una conexión declara para registrarse.
export type ManifiestoDeConector = {
  codigo: string;
  nombre: string;
  descripcion: string;
  version: string;
  /** `importar_clientes`, `enviar_mensaje`, … */
  capacidades: readonly string[];
  autenticacion: 'clave_api' | 'oauth2' | 'ninguna';
  /** Lo NO secreto. */
  configuracion: z.ZodType;
  /** Lo secreto: se cifra y nunca sale. */
  credenciales: z.ZodType;
  herramientas: readonly string[];
  escucha: readonly string[];
  emite: readonly string[];
};
