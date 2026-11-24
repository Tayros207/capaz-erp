import { esIdDeModelo } from './modelos.js';

// Lo que OpenRouter dice HOY de un modelo: precio, contexto y si admite herramientas. Se consulta en vivo porque un precio escrito
// a mano se queda viejo, y se guarda una hora (solo los aciertos: un parpadeo de red no deja una hora sin precios).

const URL_DE_MODELOS = 'https://openrouter.ai/api/v1/models';
export const MS_DE_VIDA_DE_LA_LISTA = 60 * 60 * 1000;
const MS_PARA_CONSULTAR = 6_000;

export type ModeloVivo = {
  id: string;
  /** Millonésimas de dólar por millón de tokens (entero). Nulo si no se pudo leer. */
  entradaMicrousdPorMillon: number | null;
  salidaMicrousdPorMillon: number | null;
  contexto: number | null;
  admiteHerramientas: boolean;
};

type Objeto = Record<string, unknown>;
const esObjeto = (x: unknown): x is Objeto => x !== null && typeof x === 'object' && !Array.isArray(x);

/** USD por token (texto) → millonésimas de dólar por millón de tokens, redondeado UNA vez a entero. */
function porMillon(x: unknown): number | null {
  const n = typeof x === 'string' || typeof x === 'number' ? Number(x) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e12) : null;
}

/** La respuesta de `GET /api/v1/models` → lo que usamos. Tolera filas raras: salta lo que no entiende. */
export function leerModelosDeOpenRouter(json: unknown): ModeloVivo[] {
  const filas = esObjeto(json) ? json.data : undefined;
  if (!Array.isArray(filas)) return [];
  const salida: ModeloVivo[] = [];
  for (const f of filas) {
    if (!esObjeto(f) || !esIdDeModelo(f.id)) continue;
    const p = esObjeto(f.pricing) ? f.pricing : {};
    // Los modelos «router» traen precios negativos: no son un modelo con costo conocido.
    if (Number(p.prompt) < 0 || Number(p.completion) < 0) continue;
    salida.push({
      id: f.id,
      entradaMicrousdPorMillon: porMillon(p.prompt),
      salidaMicrousdPorMillon: porMillon(p.completion),
      contexto: typeof f.context_length === 'number' ? f.context_length : null,
      admiteHerramientas: Array.isArray(f.supported_parameters) && f.supported_parameters.includes('tools'),
    });
  }
  return salida;
}

export type OpcionesDePrecios = {
  /** Solo se consulta cuando el proveedor es OpenRouter: con el asistente apagado o simulado no se sale a la red. */
  habilitado: boolean;
  fetch?: typeof fetch;
  ahora?: () => number;
};

export class PreciosDeModelos {
  private guardada: { en: number; datos: ModeloVivo[] } | null = null;
  private readonly llamar: typeof fetch;
  private readonly ahora: () => number;

  constructor(private readonly opciones: OpcionesDePrecios) {
    this.llamar = opciones.fetch ?? fetch;
    this.ahora = opciones.ahora ?? Date.now;
  }

  /** La lista de modelos, o `null` si no se pudo leer (o si la consulta está deshabilitada). Un fallo NO se guarda. */
  async vivos(): Promise<ModeloVivo[] | null> {
    if (!this.opciones.habilitado) return null;
    const ahora = this.ahora();
    if (this.guardada && ahora - this.guardada.en < MS_DE_VIDA_DE_LA_LISTA) return this.guardada.datos;
    try {
      const res = await this.llamar(URL_DE_MODELOS, { signal: AbortSignal.timeout(MS_PARA_CONSULTAR) });
      if (!res.ok) return null;
      const datos = leerModelosDeOpenRouter(await res.json());
      if (datos.length === 0) return null;
      this.guardada = { en: ahora, datos };
      return datos;
    } catch {
      return null;
    }
  }
}
