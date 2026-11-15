import { z } from 'zod';

// Contrato común de las herramientas (ADR-009): una sola capa por la que pasan la pantalla,
// el agente y las conexiones. Aquí no hay nada de ningún módulo: cada área declara las suyas
// en `contratos/<area>.ts`.

/** `lectura` no cambia nada; `normal` cambia y se puede corregir; `critica` pide confirmación en dos pasos. */
export const CRITICIDADES = ['lectura', 'normal', 'critica'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export const CANALES = ['ui', 'agente', 'mcp', 'sistema'] as const;
export type Canal = (typeof CANALES)[number];

/** Nombres que una herramienta nunca puede pedir como argumento: salen de la sesión del servidor. */
export const ARGUMENTOS_DE_CONTEXTO = [
  'empresaId',
  'empresa_id',
  'tenantId',
  'tenant_id',
  'usuarioId',
  'usuario_id',
  'permisos',
  'canal',
  'contexto',
  'ctx',
] as const;

const textoNoVacio = z.string().trim().min(1, { error: 'No puede estar vacío.' });

/**
 * La ayuda es un campo obligatorio de cada herramienta: alimenta la pantalla de «qué puedo
 * decir» y al asistente. Los ejemplos son entradas, nunca resultados calculados a mano.
 */
export const ayudaSchema = z.strictObject({
  titulo: textoNoVacio,
  paraQueSirve: textoNoVacio,
  cuandoUsarla: textoNoVacio,
  campos: z.array(z.strictObject({ nombre: textoNoVacio, queSeAnota: textoNoVacio, ejemplo: textoNoVacio })),
  ejemploTecleado: textoNoVacio,
  ejemploHablado: textoNoVacio,
  erroresComunes: z.array(textoNoVacio).min(1, { error: 'Falta al menos un error común.' }),
  /** Nombres de otras herramientas del registro. */
  relacionadas: z.array(textoNoVacio),
});
export type Ayuda = z.infer<typeof ayudaSchema>;

export type ContratoDeHerramienta<E extends z.ZodType = z.ZodType, S extends z.ZodType = z.ZodType> = { entrada: E; salida: S };

export const contrato = <E extends z.ZodType, S extends z.ZodType>(entrada: E, salida: S): ContratoDeHerramienta<E, S> => ({
  entrada,
  salida,
});

/** Cuerpo de `POST /api/v1/herramientas/:nombre` (ADR-009). */
export const cuerpoDeHerramientaSchema = z.strictObject({
  args: z.unknown().optional(),
  confirmacion: z.string().min(1).optional(),
});
export type CuerpoDeHerramienta = z.infer<typeof cuerpoDeHerramientaSchema>;
