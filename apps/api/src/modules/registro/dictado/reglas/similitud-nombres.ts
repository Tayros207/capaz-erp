/**
 * ¿Dos nombres dictados son la misma persona?
 *
 * POR QUE EXISTE (caso real, no hipotetico):
 *   El dueño dicta por voz y la app resuelve el contacto por coincidencia
 *   EXACTA del nombre normalizado. Un dia dice "Wilfredo" y otro "Wilfredo
 *   Ica": se crean dos clientes y la deuda de esa persona queda partida en
 *   dos. En la base real hay 86 contactos para 108 movimientos.
 *
 * LA REGLA QUE MANDA: es preferible un falso negativo a un falso positivo.
 *   Sugerir de mas solo molesta (el dueño responde "es nuevo" y sigue).
 *   Fusionar dos personas distintas mezcla las deudas de ambas, y eso ya no se
 *   deshace con un clic. Por eso cada regla de aqui es CONSERVADORA: ante la
 *   duda, se devuelve "no son la misma".
 *
 * COMO DECIDE (una sola idea, aplicada bien):
 *   El nombre corto tiene que caber ENTERO dentro del largo, comparando token
 *   por token con su sonido y no con su ortografia.
 *     · "Wilfredo"        ⊆ "Wilfredo Ica"        → mismo
 *     · "Manuel Guerra"   ⊆ "Manuel Guerra Dala"  → mismo
 *     · "CRISTHIAN NEYRA" ≡ "Cristian Neira"      → mismo (mismo sonido)
 *     · "Juan Perez"      vs "Juan Tenorio"       → distintos (falta "Perez")
 *   Compartir SOLO el nombre de pila nunca alcanza: en Peru "Juan", "Jose" y
 *   "Luz" los lleva medio barrio.
 */

/** Ningun nombre real necesita mas: corta entradas absurdas antes de comparar. */
const MAX_CARACTERES = 120
const MAX_TOKENS = 8

/**
 * Desde donde se considera "la misma persona".
 *
 * No es un numero suelto: es exactamente el suelo que produce un nombre
 * contenido entero en el otro (ver `similitud`). Un par que no cumple esa
 * condicion estructural NUNCA llega aqui, por muy parecidas que suenen las
 * letras. Subirlo perderia el caso "Wilfredo" ⊆ "Wilfredo Ica Mendoza";
 * bajarlo empezaria a admitir pares que solo comparten el nombre de pila.
 */
export const UMBRAL_MISMA_PERSONA = 0.75

/**
 * Desde donde vale la pena MOSTRAR un candidato sin afirmar que es el mismo.
 * Sirve para la pregunta "¿es Wilfredo Ica o es uno nuevo?": ahi listar de mas
 * no cuesta nada porque decide el dueño.
 */
export const UMBRAL_SUGERENCIA = 0.55

/** Techo de lo que puede puntuar un par que NO cumple la contencion. */
const TECHO_SIN_ESTRUCTURA = 0.74

/** Un token de dos letras ("de", "jr") no identifica a nadie. */
const MINIMO_TOKEN_IDENTIFICABLE = 3

/**
 * Palabras que aparecen dentro de un nombre y no son el nombre.
 *
 * "Juan Un Pedido" esta en la base de verdad: el analizador se comio "un
 * pedido" al dictar. Quitando el relleno, "Juan" vuelve a caber dentro y el
 * duplicado sale a la luz. Tambien caen las formas societarias, porque
 * "Imprenta Lima SAC" y "Imprenta Lima" son el mismo cliente.
 */
const RUIDO = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'un', 'una', 'unos', 'unas',
  'sr', 'sra', 'srta', 'don', 'dona', 'senor', 'senora',
  'sac', 'sa', 'srl', 'eirl', 'scrl', 'ltda', 'cia',
])

// ============================================================================
// Normalizacion
// ============================================================================

/**
 * Quita tildes ANTES de cualquier comparacion.
 *
 * En JS `\b` y las clases `\w` son ASCII: despues de una vocal acentuada no
 * hay frontera de palabra y "Ríos" no se parte igual que "Rios". Normalizando
 * a NFD y borrando los diacriticos, "ñ" ademas cae en "n", que es justo lo que
 * hace la BD (`unaccent_simple`) y `normalizeContactName`.
 */
function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Corta el apodo comercial que el dueño pega al nombre.
 *
 * "WILFREDO - HOT STAMPING" es Wilfredo; lo de atras del guion es el taller al
 * que le hace acabados. Solo se corta con el guion SEPARADO por espacios: en
 * "jean-pierre" el guion es parte del nombre y ahi no se toca nada.
 */
function cortarApodo(texto: string): string {
  const sinParentesis = texto.replace(/\([^)]*\)/g, ' ')
  const partes = sinParentesis.split(/\s+[-–—/|]+\s*|\s*[-–—/|]+\s+/)
  const primera = (partes[0] ?? '').trim()
  return primera.length > 0 ? primera : sinParentesis
}

/** Las piezas del nombre que sirven para identificar, ya limpias. */
function tokensDe(nombre: string): string[] {
  if (typeof nombre !== 'string') return []
  return cortarApodo(sinTildes(nombre).slice(0, MAX_CARACTERES))
    .split(/[^a-z0-9]+/)
    // Se descartan las iniciales sueltas ("Juan D Perez"): una sola letra no
    // distingue a nadie y estorba en la contencion.
    .filter((t) => t.length > 1 && !RUIDO.has(t))
    .slice(0, MAX_TOKENS)
}

/**
 * El nombre reducido a lo comparable: minusculas, sin tildes, sin apodo
 * comercial, sin relleno. `''` si no queda nada aprovechable.
 */
export function normalizarParaComparar(nombre: string): string {
  return tokensDe(nombre).join(' ')
}

// ============================================================================
// Sonido
// ============================================================================

/**
 * Reduce un token a como SUENA en castellano peruano.
 *
 * Los duplicados de la base no son erratas: son la misma persona escrita como
 * se oye. "CRISTHIAN NEYRA" y "Cristian Neira" suenan identico, y hasta que no
 * se comparo el sonido en vez de las letras, eran dos clientes con dos deudas.
 *
 * El orden de las reglas importa: primero las que miran dos letras (ch, qu,
 * gu, ge/gi, ce/ci) y al final las de una sola, o "gue" terminaria en "jue".
 */
function claveFonetica(token: string): string {
  return token
    // "ch" ante consonante es /k/ ("Christian"); sola es el sonido propio del
    // castellano ("Chavez") y se guarda tras un marcador para que las reglas
    // de abajo no le quiten la h.
    .replace(/ch(?=[bcdfgjklmnpqrstvwxyz])/g, 'k')
    .replace(/ch/g, '1')
    .replace(/qu/g, 'k')
    .replace(/gu([ei])/g, 'g$1')
    .replace(/g([ei])/g, 'j$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/[cq]/g, 'k')
    .replace(/z/g, 's')
    .replace(/ll/g, 'y')
    .replace(/y/g, 'i')
    .replace(/[vw]/g, 'b')
    // La h del castellano es muda: "Cristhian" y "Cristian" son lo mismo.
    .replace(/h/g, '')
    .replace(/1/g, 'ch')
    // "Guerra"/"Gera", "Wilfredoo"/"Wilfredo": las dobles no cambian el sonido.
    .replace(/(.)\1+/g, '$1')
}

/** Las claves foneticas de un nombre, en el orden en que se dictaron. */
function clavesDe(nombre: string): string[] {
  return tokensDe(nombre).map(claveFonetica)
}

/**
 * Claves que aparecen en los dos nombres, contando repeticiones.
 *
 * Es un cruce de multiconjuntos, no de conjuntos: si un nombre trae "Perez
 * Perez", que el otro tenga un solo "Perez" cubre uno, no los dos.
 */
function clavesComunes(a: string[], b: string[]): string[] {
  const disponibles = [...b]
  const comunes: string[] = []
  for (const clave of a) {
    const i = disponibles.indexOf(clave)
    if (i !== -1) {
      comunes.push(clave)
      disponibles.splice(i, 1)
    }
  }
  return comunes
}

// ============================================================================
// Distancia de texto (solo para ordenar, nunca para decidir)
// ============================================================================

/** Distancia de edicion clasica, con una sola fila en memoria. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i]
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      siguiente[j] = Math.min(
        (fila[j] ?? 0) + 1,
        (siguiente[j - 1] ?? 0) + 1,
        (fila[j - 1] ?? 0) + costo
      )
    }
    fila = siguiente
  }
  return fila[b.length] ?? 0
}

/** 1 = identicos, 0 = nada que ver. */
function parecidoDeTexto(a: string, b: string): number {
  const largo = Math.max(a.length, b.length)
  if (largo === 0) return 0
  return 1 - levenshtein(a, b) / largo
}

/** Tres decimales bastan para mostrar y ordenar, y evitan ruido en el JSON. */
function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000
}

// ============================================================================
// API publica
// ============================================================================

/**
 * Que tan parecidos son dos nombres, de 0 a 1. Simetrica: el orden no importa.
 *
 * El puntaje tiene dos tramos y eso es a proposito:
 *   · >= UMBRAL_MISMA_PERSONA solo se alcanza cuando el nombre corto cabe
 *     ENTERO dentro del largo. Cuanto menos sobra, mas alto.
 *   · por debajo queda el parecido de letras, util para ordenar candidatos en
 *     pantalla, con techo TECHO_SIN_ESTRUCTURA para que nunca pueda hacerse
 *     pasar por una coincidencia buena.
 */
export function similitud(a: string, b: string): number {
  const clavesA = clavesDe(a)
  const clavesB = clavesDe(b)
  if (clavesA.length === 0 || clavesB.length === 0) return 0

  const comunes = clavesComunes(clavesA, clavesB).length
  const cobertura = comunes / Math.min(clavesA.length, clavesB.length)
  const proporcion = comunes / Math.max(clavesA.length, clavesB.length)

  // cobertura = 1 (contenido entero) → entre UMBRAL y 1, segun cuanto sobre.
  const estructural =
    cobertura * (UMBRAL_MISMA_PERSONA + (1 - UMBRAL_MISMA_PERSONA) * proporcion)

  // Se ordenan las claves para que el parecido no dependa de si dijo "Guerra
  // Manuel" o "Manuel Guerra".
  const textual = Math.min(
    parecidoDeTexto([...clavesA].sort().join(' '), [...clavesB].sort().join(' ')),
    TECHO_SIN_ESTRUCTURA
  )

  return redondear(Math.max(estructural, textual))
}

/**
 * ¿Hay que tratarlos como el mismo contacto?
 *
 * Dos condiciones, las dos obligatorias:
 *   1. el nombre corto cabe entero dentro del largo (por sonido), y
 *   2. algo de lo compartido identifica de verdad (>= 3 letras).
 *
 * La segunda evita que dos nombres reducidos a particulas ("Sr Jr") se den por
 * iguales. Un `true` de aqui NUNCA fusiona solo: es una sugerencia que el
 * dueño confirma.
 */
export function esProbableMismaPersona(a: string, b: string): boolean {
  const clavesA = clavesDe(a)
  const clavesB = clavesDe(b)
  if (clavesA.length === 0 || clavesB.length === 0) return false

  const comunes = clavesComunes(clavesA, clavesB)
  if (comunes.length < Math.min(clavesA.length, clavesB.length)) return false

  return comunes.some((clave) => clave.length >= MINIMO_TOKEN_IDENTIFICABLE)
}

/**
 * Trozos con los que prefiltrar en la base antes de puntuar en memoria.
 *
 * Se devuelve el arranque del token TAL COMO SE ESCRIBE y tambien el de su
 * clave fonetica: "Valverde" se guardo como "balverde" el dia que el dueño lo
 * dicto con b, y buscando solo "val" no aparecia nunca.
 */
export function raicesDeBusqueda(nombre: string, largo = 3): string[] {
  const raices = new Set<string>()
  for (const token of tokensDe(nombre)) {
    if (token.length >= largo) raices.add(token.slice(0, largo))
    const clave = claveFonetica(token)
    if (clave.length >= largo) raices.add(clave.slice(0, largo))
  }
  return [...raices]
}
