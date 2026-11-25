// El formato mínimo que el asistente usa al escribir: párrafos, listas con viñetas o numeradas, **negrita**, *cursiva* y `código`.
// Se convierte en una estructura de datos y la pantalla la pinta con elementos de React: JAMÁS se pinta HTML que venga del modelo,
// ni enlaces ni imágenes (el prompt ya lo prohíbe y aquí tampoco existen). Lógica pura, sin React.

export type Tramo = { tipo: 'texto' | 'negrita' | 'cursiva' | 'codigo'; texto: string };
export type Bloque =
  | { tipo: 'parrafo'; lineas: Tramo[][] }
  | { tipo: 'lista'; ordenada: boolean; items: Tramo[][] };

const TRAMO = /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![*\w])\*[^*\s][^*\n]*?\*(?![*\w]))/g;

/** Parte una línea en tramos con formato. Lo que no cierra (un `**` a medias mientras llega el texto) queda como texto normal. */
export function tramosDe(linea: string): Tramo[] {
  const salida: Tramo[] = [];
  let desde = 0;
  for (const m of linea.matchAll(TRAMO)) {
    const i = m.index ?? 0;
    if (i > desde) salida.push({ tipo: 'texto', texto: linea.slice(desde, i) });
    const t = m[0];
    if (t.startsWith('**')) salida.push({ tipo: 'negrita', texto: t.slice(2, -2) });
    else if (t.startsWith('`')) salida.push({ tipo: 'codigo', texto: t.slice(1, -1) });
    else salida.push({ tipo: 'cursiva', texto: t.slice(1, -1) });
    desde = i + t.length;
  }
  if (desde < linea.length) salida.push({ tipo: 'texto', texto: linea.slice(desde) });
  return salida.length > 0 ? salida : [{ tipo: 'texto', texto: '' }];
}

const VINETA = /^\s*(?:[-*•])\s+(.*)$/;
const NUMERO = /^\s*\d{1,3}[.)]\s+(.*)$/;
const ENCABEZADO = /^\s*#{1,6}\s+(.*)$/;

/** El texto del asistente como bloques. Líneas seguidas forman un párrafo; una línea en blanco separa; `- ` o `1. ` abren una lista. */
export function bloquesDe(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: Tramo[][] = [];
  let lista: { ordenada: boolean; items: Tramo[][] } | null = null;
  const cerrar = (): void => {
    if (parrafo.length > 0) bloques.push({ tipo: 'parrafo', lineas: parrafo });
    if (lista) bloques.push({ tipo: 'lista', ...lista });
    parrafo = [];
    lista = null;
  };
  for (const cruda of texto.replace(/\r\n?/g, '\n').split('\n')) {
    if (cruda.trim() === '') {
      cerrar();
      continue;
    }
    const vineta = VINETA.exec(cruda);
    const numero = vineta ? null : NUMERO.exec(cruda);
    const item = vineta?.[1] ?? numero?.[1];
    if (item !== undefined) {
      const ordenada = numero !== null;
      if (lista && lista.ordenada !== ordenada) cerrar();
      if (parrafo.length > 0) cerrar();
      lista ??= { ordenada, items: [] };
      lista.items.push(tramosDe(item));
      continue;
    }
    if (lista) cerrar();
    const encabezado = ENCABEZADO.exec(cruda);
    // Un «# Título» no se pinta como título gigante: se vuelve una línea en negrita.
    parrafo.push(encabezado?.[1] !== undefined ? [{ tipo: 'negrita', texto: encabezado[1] }] : tramosDe(cruda));
  }
  cerrar();
  return bloques;
}
