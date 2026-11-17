import { escribible, seccion, type Ctx } from './contexto.ts';

const IGV = 18;
const CON_LISTA = 10;
const MARCADAS_PARA_REVISAR = 5;
/** Precio de catálogo (con IGV, milésimas de sol) → sin IGV, mitad hacia arriba. Es la misma regla que usa el servidor. */
const sinIgv = (milesimas: number, afecto: boolean): number => (afecto ? Math.floor((milesimas * 100 * 2 + (100 + IGV)) / (2 * (100 + IGV))) : milesimas);
/** Milésimas de sol por unidad × cantidad → céntimos. */
const totalEnCentimos = (unitarioMilesimas: number, cantidad: number, factor: number): number => Math.round((unitarioMilesimas * cantidad * factor) / 10);

/** Los tres precios de referencia derivados del catálogo: 100 → ×1,15 · 1.000 → ×1 · 5.000 → ×0,85 (por unidad, sin IGV). */
export function preciosDeLista(precioCatalogoMilesimas: number, afecto: boolean): { p100Centimos: number; p1000Centimos: number; p5000Centimos: number } | null {
  const u = sinIgv(precioCatalogoMilesimas, afecto);
  const p = { p100Centimos: totalEnCentimos(u, 100, 1.15), p1000Centimos: totalEnCentimos(u, 1000, 1), p5000Centimos: totalEnCentimos(u, 5000, 0.85) };
  return p.p100Centimos > 0 && p.p100Centimos < p.p1000Centimos && p.p1000Centimos < p.p5000Centimos ? p : null;
}

/** Listas heredadas de Cotizín (sin producto): solo la gráfica las trae. */
const HEREDADAS = [
  { nombre: 'Volantes A5 4/4 couché 150 g', p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 },
  { nombre: 'Tarjetas de presentación 1000 unidades', p100Centimos: 8_500, p1000Centimos: 32_000, p5000Centimos: 98_000 },
];

const normal = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function crearSiFalta(c: Ctx, args: Record<string, unknown> & { nombre: string }, existentes: any[], productoId?: string): Promise<string | null> {
  if (existentes.some((l) => (productoId && l.productoId === productoId) || normal(l.nombre) === normal(args.nombre))) return null;
  try {
    return (await c.s.herramienta('lista_precio_crear', args)).id;
  } catch (e) {
    c.log(`  ⚠ lista de «${args.nombre}»: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function sembrarListas(c: Ctx): Promise<void> {
  const existentes = await c.s.todos('listas_precio_listar', { estado: 'todas' });
  const candidatos = c.productos.filter((p: any) => p.precioUnitarioMilesimas > 0 && p.archivadoEn === null).slice(0, CON_LISTA);
  const creadas: string[] = [];
  for (const p of candidatos) {
    const precios = preciosDeLista(p.precioUnitarioMilesimas, p.afectoIgv);
    const id = precios ? await crearSiFalta(c, { nombre: p.nombre, productoId: p.id, ...precios }, existentes, p.id) : null;
    if (id) creadas.push(id);
  }
  // La mitad, con los precios fijados hace 100 días: salen como «Revisar».
  for (const id of creadas.slice(0, MARCADAS_PARA_REVISAR)) {
    await c.db.query(`update cotizador.listas_de_precio set precios_fijados_en = now() - interval '100 days' where tenant_id = $1 and id = $2`, [c.empresaId, id]);
  }
  const heredadas = c.sec.clave === 'grafica' ? HEREDADAS : [];
  for (const h of heredadas) await crearSiFalta(c, h, existentes);
  c.log(`  cotizador: ${creadas.length} listas con producto nuevas (${Math.min(MARCADAS_PARA_REVISAR, creadas.length)} por revisar), ${existentes.length} ya existían`);
}

/** Deja a propósito un producto sin precio (caso «sin precio»); el resto sin lista se cotiza con su precio de catálogo. */
async function sembrarProductoSinPrecio(c: Ctx): Promise<void> {
  if (c.productos.some((p: any) => p.precioUnitarioMilesimas === 0 && p.archivadoEn === null)) return;
  await c.s.herramienta('productos_crear', { nombre: 'Trabajo especial a cotizar', tipo: 'servicio', unidad: 'unidad', descripcion: 'Sin precio fijo: se cotiza caso por caso.' });
}

async function sembrarAjustes(c: Ctx): Promise<void> {
  if ((await c.s.herramienta('ajustes_cliente_listar')).items.length > 0) return;
  const [mayorista, descuento] = c.clientes;
  if (mayorista) await c.s.herramienta('ajuste_cliente_fijar', { clienteId: mayorista.id, porcentaje: '5', nota: 'Entrega urgente' });
  if (descuento) await c.s.herramienta('ajuste_cliente_fijar', { clienteId: descuento.id, porcentaje: '-10', nota: 'Cliente frecuente' });
}

/** Listas enlazadas al catálogo (y dos heredadas en la gráfica), un producto sin precio y dos ajustes de cliente. Idempotente: no repite lo que ya existe. */
export async function sembrarCotizador(c: Ctx): Promise<void> {
  if (!escribible(c, 'cotizador')) return;
  await seccion(c, 'listas de precios', () => sembrarListas(c));
  await seccion(c, 'producto sin precio', () => sembrarProductoSinPrecio(c));
  await seccion(c, 'ajustes de cliente', () => sembrarAjustes(c));
}
