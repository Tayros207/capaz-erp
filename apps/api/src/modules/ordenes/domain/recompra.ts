import { diasEntreDias, enlaceDeWhatsapp, formatearSoles, sumarDias, type MensajeDeCobro, type TarjetaDePendiente } from '@capaz/shared';

// Aviso de recompra («Mi día»): puro. Un cliente que compraba con ritmo y se demora el doble de lo habitual aparece como
// «Clientes por llamar». Una compra es un día distinto con al menos un pedido válido. El mensaje de WhatsApp lo abre la
// persona a mano: el sistema nunca lo envía.

export const MINIMO_DE_COMPRAS = 6;
export const MAXIMO_DE_RITMO_EN_DIAS = 30;
export const PISO_DE_DIAS_SIN_COMPRAR = 10;
export const MAXIMO_DE_DIAS_SIN_COMPRAR = 400;
export const MAXIMO_DE_TARJETAS_DE_RECOMPRA = 15;

export type ClienteConHistorial = {
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  /** Días `AAAA-MM-DD` distintos con compra, en cualquier orden. */
  fechasDeCompra: readonly string[];
  /** Venta de los últimos 12 meses, en céntimos. */
  ventaDe12MesesCentimos: number;
};

export type NivelDeRecompra = 'toca_volver' | 'enfriando';
export type EvaluacionDeRecompra = { ritmoEnDias: number; diasSinComprar: number; ultimaCompra: string; nivel: NivelDeRecompra };

/** Mediana de una lista de números (cantidad par: promedio de los dos del medio), redondeada. */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return Math.round(o.length % 2 === 1 ? (o[m] as number) : ((o[m - 1] as number) + (o[m] as number)) / 2);
}

/** `null` si el cliente no califica (pocas compras o ritmo lento) o no toca avisar todavía. */
export function evaluarRecompra(fechasDeCompra: readonly string[], hoy: string): EvaluacionDeRecompra | null {
  const fechas = [...new Set(fechasDeCompra)].sort();
  if (fechas.length < MINIMO_DE_COMPRAS) return null;
  const huecos = fechas.slice(1).map((f, i) => diasEntreDias(fechas[i] as string, f));
  const ritmo = mediana(huecos);
  if (ritmo > MAXIMO_DE_RITMO_EN_DIAS) return null;
  const ultimaCompra = fechas[fechas.length - 1] as string;
  const d = diasEntreDias(ultimaCompra, hoy);
  if (d <= Math.max(2 * ritmo, PISO_DE_DIAS_SIN_COMPRAR) || d > MAXIMO_DE_DIAS_SIN_COMPRAR) return null;
  return { ritmoEnDias: ritmo, diasSinComprar: d, ultimaCompra, nivel: d > 3 * ritmo ? 'enfriando' : 'toca_volver' };
}

const ETIQUETA_DE_NIVEL: Record<NivelDeRecompra, string> = { toca_volver: 'Ya le toca volver', enfriando: 'Se está enfriando' };

/** Saludo sin «buenos días» (sirve a cualquier hora); dice de parte de quién se escribe si se conoce la empresa. */
export function mensajeDeRecompra(cliente: string, empresa: string | null, telefono: string | null): MensajeDeCobro {
  const nombre = cliente.trim();
  const texto = empresa
    ? `Hola ${nombre}, te saluda ${empresa}. Hace un tiempo que no te vemos: ¿te preparamos tu próximo pedido? Con gusto te cotizamos. ¡Gracias por tu preferencia!`
    : `Hola ${nombre}, un saludo cordial.`;
  return { texto, enlaceWhatsapp: enlaceDeWhatsapp(telefono, texto) };
}

function tarjetaDeRecompra(c: ClienteConHistorial, e: EvaluacionDeRecompra, empresa: string | null): TarjetaDePendiente {
  return {
    clave: `recompra:${c.clienteId}`,
    grupo: 'recompra',
    urgencia: 'info',
    titulo: `Llamar a ${c.clienteNombre}`,
    detalle: `Compra cada ~${e.ritmoEnDias} días y no compra hace ${e.diasSinComprar} días · ${ETIQUETA_DE_NIVEL[e.nivel]} · ${formatearSoles(c.ventaDe12MesesCentimos)} en los últimos 12 meses`,
    fecha: sumarDias(e.ultimaCompra, e.ritmoEnDias),
    montoCentimos: null,
    cliente: { id: c.clienteId, nombre: c.clienteNombre, telefono: c.clienteTelefono },
    entidad: { tipo: 'cliente', id: c.clienteId, codigo: c.clienteNombre },
    acciones: [],
    mensaje: mensajeDeRecompra(c.clienteNombre, empresa, c.clienteTelefono),
    cobro: null,
  };
}

type Candidato = { c: ClienteConHistorial; e: EvaluacionDeRecompra };

/** Todos los clientes que tocan avisar, ordenados: venta de 12 meses de mayor a menor, luego días sin comprar de mayor a menor. */
export function candidatosDeRecompra(clientes: readonly ClienteConHistorial[], hoy: string): Candidato[] {
  return clientes
    .flatMap((c) => {
      const e = evaluarRecompra(c.fechasDeCompra, hoy);
      return e ? [{ c, e }] : [];
    })
    .sort((a, b) => b.c.ventaDe12MesesCentimos - a.c.ventaDe12MesesCentimos || b.e.diasSinComprar - a.e.diasSinComprar || a.c.clienteId.localeCompare(b.c.clienteId));
}

/** Las tarjetas de los primeros 15 candidatos. */
export function tarjetasDeRecompra(clientes: readonly ClienteConHistorial[], hoy: string, empresa: string | null): TarjetaDePendiente[] {
  return candidatosDeRecompra(clientes, hoy)
    .slice(0, MAXIMO_DE_TARJETAS_DE_RECOMPRA)
    .map(({ c, e }) => tarjetaDeRecompra(c, e, empresa));
}
