import { ENTIDADES_DE_PANTALLA, type PantallaDelAgente, type TipoDeEntidadDePantalla as TipoDeEntidad } from '@capaz/shared';

// La lista de tipos y la forma de la pantalla viven en `@capaz/shared`: el servidor valida exactamente lo mismo que aquí se arma.
export { ENTIDADES_DE_PANTALLA };
export type { PantallaDelAgente, TipoDeEntidad };

// Qué tiene la persona delante cuando abre el asistente. Es una PISTA para el asistente, nunca una autorización:
// viene del navegador y se puede falsificar. Función pura, sin React.

const LARGO_MAXIMO_DE_RUTA = 200;
const RUTA_VALIDA = /^\/[A-Za-z0-9/_.-]*$/;
const CODIGO_DE_MODULO = /^[a-z][a-z0-9_]{0,39}$/;
// Misma forma que `z.uuid()` de Zod 4: si la web mandara un id que el servidor rechaza, se perdería el turno entero.
const UUID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

const esUuid = (s: string | undefined): s is string => s !== undefined && UUID.test(s);

const SIN_PANTALLA: PantallaDelAgente = { ruta: '/', modulo: null, entidad: null };

const entidad = (tipo: TipoDeEntidad, id: string) => ({ tipo, id });

/** Entidad de una pantalla del núcleo: `/clientes/:id`, `/productos/:id`, `/bandeja/:id`. */
function entidadDelNucleo(segmentos: readonly string[]): PantallaDelAgente['entidad'] {
  const [area, id] = segmentos;
  if (!esUuid(id)) return null;
  if (area === 'clientes') return entidad('cliente', id);
  if (area === 'productos') return entidad('producto', id);
  if (area === 'bandeja') return entidad('borrador', id);
  return null;
}

/** Entidad dentro de `/m/<codigo>/…`; `resto` son los segmentos después del código. */
function entidadDelModulo(codigo: string, resto: readonly string[]): PantallaDelAgente['entidad'] {
  const [a, b] = resto;
  switch (codigo) {
    case 'ordenes':
      if (a === 'guias') return esUuid(b) ? entidad('guia', b) : null;
      return esUuid(a) ? entidad('pedido', a) : null;
    case 'produccion':
      return esUuid(a) ? entidad('orden_de_produccion', a) : null;
    case 'cotizador':
      return (a === 'cotizaciones' || a === 'cuadro') && esUuid(b) ? entidad('cotizacion', b) : null;
    case 'crm':
      return a === 'oportunidades' && esUuid(b) ? entidad('oportunidad', b) : null;
    case 'registro':
      if (a === 'movimientos') return esUuid(b) ? entidad('movimiento', b) : null;
      if (a === 'deudas') return esUuid(b) ? entidad('deuda', b) : null;
      return null;
    default:
      return null;
  }
}

/**
 * Convierte el camino de la barra de direcciones en lo que se le cuenta al asistente. Solo se reconoce una entidad
 * si su id tiene forma de UUID; una ruta con caracteres raros (consulta, espacios) se descarta entera.
 */
export function pantallaDesdeRuta(pathname: string): PantallaDelAgente {
  const ruta = pathname.slice(0, LARGO_MAXIMO_DE_RUTA);
  if (!RUTA_VALIDA.test(ruta)) return SIN_PANTALLA;

  const segmentos = pathname.split('/').filter((s) => s.length > 0);
  if (segmentos[0] === 'm') {
    const codigo = segmentos[1];
    if (codigo === undefined || !CODIGO_DE_MODULO.test(codigo)) return { ruta, modulo: null, entidad: null };
    return { ruta, modulo: codigo, entidad: entidadDelModulo(codigo, segmentos.slice(2)) };
  }
  return { ruta, modulo: null, entidad: entidadDelNucleo(segmentos) };
}
