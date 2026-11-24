// Las tres herramientas internas del asistente. No están en el registro de negocio: las atiende el bucle. Le dan al modelo
// acceso a TODO el software sin pagar las 303 definiciones en cada mensaje: primero se mira el mapa, después se describe una
// herramienta y por último se llama. «herramienta_llamar» sigue el mismo camino que una llamada directa (política y ejecutor).

export const META_SOFTWARE_MAPA = 'software_mapa';
export const META_HERRAMIENTA_DESCRIBIR = 'herramienta_describir';
export const META_HERRAMIENTA_LLAMAR = 'herramienta_llamar';

export const NOMBRES_DE_META: ReadonlySet<string> = new Set([META_SOFTWARE_MAPA, META_HERRAMIENTA_DESCRIBIR, META_HERRAMIENTA_LLAMAR]);

/** Definiciones en el formato de herramientas del modelo. */
export const DEFINICIONES_DE_META: readonly unknown[] = [
  {
    type: 'function',
    function: {
      name: META_SOFTWARE_MAPA,
      description:
        'Lista lo que puedes hacer en el sistema. Sin argumentos: cada área con los nombres de sus herramientas. Con «modulo»: cada herramienta de esa área con una línea de lo que hace.',
      parameters: { type: 'object', properties: { modulo: { type: 'string', description: 'Código del área, por ejemplo «ordenes» o «registro».' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: META_HERRAMIENTA_DESCRIBIR,
      description: 'Te dice para qué sirve una herramienta, cuándo usarla y qué argumentos lleva. Úsala antes de llamar a una que no conoces.',
      parameters: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'], additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: META_HERRAMIENTA_LLAMAR,
      description: 'Ejecuta una herramienta por su nombre, con sus argumentos. Funciona igual que llamarla directamente.',
      parameters: {
        type: 'object',
        properties: { nombre: { type: 'string' }, args: { type: 'object', description: 'Los argumentos que indicó herramienta_describir.' } },
        required: ['nombre'],
        additionalProperties: false,
      },
    },
  },
];
