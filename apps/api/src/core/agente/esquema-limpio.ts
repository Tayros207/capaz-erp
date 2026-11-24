import { z } from 'zod';

// El esquema de argumentos que ve el modelo: el JSON Schema del contrato, sin el ruido que solo cuesta tokens.
// Medido sobre las 303 herramientas de negocio: los 303 convierten y limpiar baja el catálogo de ~61.500 a ~41.500 tokens.
// La regla de un `refine` NO aparece en el JSON Schema; el ejecutor la sigue validando y devuelve el error en español.

type EsquemaJson = Record<string, unknown>;

/** Las herramientas cuyo argumento `origen` lo pone el servidor (`'agente'`), no el modelo. */
export const HERRAMIENTAS_CON_ORIGEN_FIJO: ReadonlySet<string> = new Set(['movimiento_registrar', 'deuda_abonar', 'deuda_crear_con_adelanto']);

/** Campos que el modelo no ve porque los fija el servidor: el origen real y el tiempo medido de un dictado. */
export const CAMPOS_QUE_PONE_EL_SERVIDOR: Readonly<Record<string, readonly string[]>> = {
  movimiento_registrar: ['origen'],
  deuda_abonar: ['origen'],
  deuda_crear_con_adelanto: ['origen'],
  captura_proponer: ['origen', 'transcurridoMs'],
  memoria_anotar: ['citaVerificada'],
};

/** `uuid` y `date` traen un `pattern` larguísimo además del `format`; los límites de entero seguro sobran. */
function limpiarNodo(ctx: { jsonSchema: EsquemaJson }): void {
  const j = ctx.jsonSchema;
  if (j.format && j.pattern) delete j.pattern;
  if (j.maximum === Number.MAX_SAFE_INTEGER) delete j.maximum;
  if (j.minimum === Number.MIN_SAFE_INTEGER) delete j.minimum;
}

export function esquemaLimpio(entrada: z.ZodType): EsquemaJson {
  const crudo = z.toJSONSchema(entrada, { io: 'input', target: 'draft-07', unrepresentable: 'any', override: limpiarNodo });
  // El resultado trae `$schema` y una propiedad no enumerable `~standard`: pasar por JSON las quita.
  const esquema = JSON.parse(JSON.stringify(crudo)) as EsquemaJson;
  delete esquema.$schema;
  return esquema;
}

/** El mismo esquema sin los campos que fija el servidor. */
export function quitarCampos(esquema: EsquemaJson, campos: readonly string[]): EsquemaJson {
  const propiedades = { ...(esquema.properties as Record<string, unknown> | undefined) };
  for (const c of campos) delete propiedades[c];
  const requeridos = Array.isArray(esquema.required) ? (esquema.required as string[]).filter((k) => !campos.includes(k)) : undefined;
  const { required: _quitado, ...resto } = esquema;
  return { ...resto, properties: propiedades, ...(requeridos && requeridos.length > 0 && { required: requeridos }) };
}

/** Lo que el modelo ve de una herramienta. */
export function esquemaParaElModelo(nombre: string, entrada: z.ZodType): EsquemaJson {
  const limpio = esquemaLimpio(entrada);
  const fijos = CAMPOS_QUE_PONE_EL_SERVIDOR[nombre];
  return fijos ? quitarCampos(limpio, fijos) : limpio;
}

/** Estimación de tokens: caracteres ÷ 4. No es un tokenizador real; el español con JSON suele dar algo más. */
export const tokensEstimados = (x: unknown): number => Math.ceil((JSON.stringify(x)?.length ?? 0) / 4);
