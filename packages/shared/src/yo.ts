import { z } from 'zod';
import { accesoDeModuloSchema } from './modulos.js';

// Contrato de `GET /api/v1/yo` y de la creación de empresas. Los módulos con su estado se
// agregan al terminar la fase 4.

export const empresaDeUsuarioSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  rol: z.string(),
});
export type EmpresaDeUsuario = z.infer<typeof empresaDeUsuarioSchema>;

export const moduloDeYoSchema = z.strictObject({
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  acento: z.string(),
  icono: z.string(),
  enConstruccion: z.boolean(),
  secciones: z.array(z.strictObject({ id: z.string(), nombre: z.string(), ruta: z.string(), construida: z.boolean() })),
  acceso: accesoDeModuloSchema,
});
export type ModuloDeYo = z.infer<typeof moduloDeYoSchema>;

export const yoSchema = z.strictObject({
  usuario: z.strictObject({ id: z.string(), nombre: z.string(), correo: z.string() }),
  /** La empresa activa, o nulo si el usuario aún no tiene o la perdió. */
  empresa: empresaDeUsuarioSchema.nullable(),
  empresas: z.array(empresaDeUsuarioSchema),
  /** Si el usuario puede crear su propia empresa (alta abierta) o la crea la plataforma. */
  puedeCrearEmpresas: z.boolean(),
  /** Los módulos contratables con el estado de acceso de ESTA persona (vacío si no hay empresa activa). */
  modulos: z.array(moduloDeYoSchema),
  /** Permisos efectivos de esta persona en la empresa activa. */
  permisos: z.array(z.string()),
});
export type Yo = z.infer<typeof yoSchema>;

export const crearEmpresaSchema = z.strictObject({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la empresa.').max(80),
});
export type CrearEmpresa = z.infer<typeof crearEmpresaSchema>;

export const empresaCreadaSchema = z.strictObject({ id: z.string(), nombre: z.string() });
export type EmpresaCreada = z.infer<typeof empresaCreadaSchema>;
