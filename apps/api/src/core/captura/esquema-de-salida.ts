import { z } from 'zod';

// El JSON Schema que se le pide al modelo como salida estructurada estricta, derivado del esquema Zod del intérprete.
// El modo estricto exige objetos cerrados y todos los campos presentes (lo que no se sabe va como `null`), y no admite límites
// numéricos ni de texto, patrones ni formatos: se quitan aquí y Zod los sigue validando cuando vuelve la respuesta.

type Nodo = Record<string, unknown>;

const esObjeto = (x: unknown): x is Nodo => x !== null && typeof x === 'object' && !Array.isArray(x);

const SIN_SOPORTE = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minItems',
  'maxItems',
  'default',
] as const;

function ajustar(nodo: unknown): void {
  if (Array.isArray(nodo)) {
    for (const n of nodo) ajustar(n);
    return;
  }
  if (!esObjeto(nodo)) return;
  for (const clave of SIN_SOPORTE) delete nodo[clave];
  // `properties` es un mapa de NOMBRES de campo: no se le quitan claves, solo se ajusta cada esquema.
  if (esObjeto(nodo.properties)) {
    nodo.additionalProperties = false;
    nodo.required = Object.keys(nodo.properties);
    for (const hijo of Object.values(nodo.properties)) ajustar(hijo);
  }
  for (const [clave, hijo] of Object.entries(nodo)) if (clave !== 'properties') ajustar(hijo);
}

/**
 * El esquema de salida para el modelo. Los campos del esquema Zod deben ser `nullable()`, no `optional()`: el modo estricto los
 * exige todos y un `optional` que llegue como `null` no pasaría la validación de vuelta.
 */
export function esquemaDeSalida(esquema: z.ZodType): Nodo {
  const crudo = z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' });
  // Pasar por JSON quita la propiedad no enumerable `~standard`; `$schema` se borra a mano.
  const limpio = JSON.parse(JSON.stringify(crudo)) as Nodo;
  delete limpio.$schema;
  ajustar(limpio);
  return limpio;
}
