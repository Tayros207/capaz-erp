// Arregla lo que un modelo manda mal de FORMA, nunca de fondo: una lista o un objeto escritos como texto, «true» en vez de sí,
// un entero entre comillas, o datos puestos al lado de `args` en vez de dentro. Se hace antes de la política, las guardas y la
// huella, así todo ve los argumentos ya arreglados. No inventa ni completa valores: lo que falte lo sigue rechazando el esquema.
// Función pura.

type Esquema = Record<string, unknown>;

const esObjeto = (x: unknown): x is Esquema => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Las ramas de un esquema: las de `anyOf`/`oneOf`, o él mismo. */
const ramas = (e: Esquema): Esquema[] => {
  const alternativas = e.anyOf ?? e.oneOf;
  return Array.isArray(alternativas) ? alternativas.filter(esObjeto).flatMap(ramas) : [e];
};

/** `type` puede venir como un texto o como una lista («integer» o «null»). */
const esDeTipo = (r: Esquema, tipo: string): boolean => (Array.isArray(r.type) ? r.type.includes(tipo) : r.type === tipo);
const admite = (e: Esquema, tipo: string): boolean => ramas(e).some((r) => esDeTipo(r, tipo));
const ramaDe = (e: Esquema, tipo: string): Esquema | undefined => ramas(e).find((r) => esDeTipo(r, tipo));

function comoJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

/** Un texto donde el esquema NO admite texto: se lee como lo que se pedía. Si no se puede sin adivinar, se deja como está. */
function desdeTexto(texto: string, e: Esquema): unknown {
  const t = texto.trim();
  if (admite(e, 'array') && t.startsWith('[')) return Array.isArray(comoJson(t)) ? comoJson(t) : texto;
  if (admite(e, 'object') && t.startsWith('{')) return esObjeto(comoJson(t)) ? comoJson(t) : texto;
  if (admite(e, 'boolean') && (t === 'true' || t === 'false')) return t === 'true';
  // Solo cifras limpias: «S/ 80», «1,000» o «45.50» donde va un entero no se tocan (podrían ser soles y no céntimos).
  if (admite(e, 'integer') && /^-?\d+$/.test(t) && Number.isSafeInteger(Number(t))) return Number(t);
  if (admite(e, 'number') && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (admite(e, 'null') && t === 'null') return null;
  return texto;
}

/** El valor con la forma que pide el esquema (JSON Schema), recorriendo objetos y listas. */
export function repararSegunEsquema(valor: unknown, esquema: unknown): unknown {
  if (!esObjeto(esquema)) return valor;
  const v = typeof valor === 'string' && !admite(esquema, 'string') ? desdeTexto(valor, esquema) : valor;
  if (Array.isArray(v)) {
    const lista = ramaDe(esquema, 'array');
    return lista ? v.map((x) => repararSegunEsquema(x, lista.items)) : v;
  }
  const objeto = esObjeto(v) ? ramaDe(esquema, 'object') : undefined;
  if (!esObjeto(v) || !objeto || !esObjeto(objeto.properties)) return v;
  const propiedades = objeto.properties;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Object.hasOwn(propiedades, k) ? repararSegunEsquema(x, propiedades[k]) : x]));
}

/**
 * Los argumentos de `herramienta_llamar`. Algunos modelos mandan `args` como texto, o dejan datos al lado de `args`
 * (`{ nombre, args: { id }, lineas }`): sin juntarlos, esos datos se perdían en silencio y el modelo repetía la llamada sin fin.
 */
export function argumentosDeLaPuertaGeneral(entrada: Esquema): unknown {
  const { nombre: _nombre, args, ...sueltos } = entrada;
  const leidos = typeof args === 'string' ? (comoJson(args) ?? args) : (args ?? {});
  if (Object.keys(sueltos).length === 0 || !esObjeto(leidos)) return leidos;
  // Lo de dentro de `args` manda sobre lo suelto.
  return { ...sueltos, ...leidos };
}
