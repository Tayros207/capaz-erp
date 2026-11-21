import { createHash } from 'node:crypto';
import { MAX_DETALLES_DE_FILA, ORIGEN_DE_HISTORIAL, SERIE_DE_HISTORIAL, exito, formatearSoles, rechazo, type Ayuda, type FilaConMotivo } from '@capaz/shared';
import { reservarNumeros } from '../../../core/correlativos/reservar-numeros.js';
import { instanteDeDia } from '../../../core/empresas/hoy.js';
import type { Invocador } from '../../../core/intercambio/invocador.js';
import { definirHerramienta, type ContextoDeHerramienta, type ResultadoDeResumen } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { esAdministrador } from '../domain/correccion.js';
import { CLAVE_DE_CORRELATIVO } from '../domain/pedido.js';
import { clientesPorNombre, insertarHistorial, type PedidoDeHistorial } from '../repositories/historial.repository.js';
import { MODULO } from './comunes.js';
import { planificarHistorial, type Entrada, type FilaPlanificada, type Plan } from './historial-plan.js';

// Importar el historial de pedidos (trabajos de años anteriores): dos herramientas, la vista previa y la importación crítica.
// Inserta en bloque con su propio repositorio: no pasa por `pedido_crear` ni `pedido_confirmar` (sin eventos, sin deudas).

const SIN_PERMISO = 'Solo el dueño o un administrador importa el historial.';
const permitido = (ctx: ContextoDeHerramienta) => ctx.permisos.includes('ordenes:editar') && esAdministrador(ctx.rol);
const recortar = <T>(l: T[]): T[] => l.slice(0, MAX_DETALLES_DE_FILA);
const porFila = (l: FilaConMotivo[]) => [...l].sort((a, b) => a.fila - b.fila);

const AYUDA_COMUN: Pick<Ayuda, 'campos' | 'erroresComunes'> = {
  campos: [
    { nombre: 'contenido', queSeAnota: 'El texto del CSV: columnas fecha, cliente, descripcion y total (y, si quieres, cliente_original, cobrado, rubro, fuente).', ejemplo: 'fecha,cliente,descripcion,total\n2023-05-04,Ana Ruiz,Tarjetas x1000,80.50' },
    { nombre: 'separador', queSeAnota: 'Coma o punto y coma; si no lo indicas se detecta.', ejemplo: ';' },
    { nombre: 'desde', queSeAnota: 'Fecha de corte AAAA-MM-DD: lo anterior se omite (por defecto 2022-01-01).', ejemplo: '2022-01-01' },
    { nombre: 'crearClientesFaltantes', queSeAnota: 'Si es verdadero, crea los clientes que no existan (hasta 200 por archivo).', ejemplo: 'true' },
  ],
  erroresComunes: ['Solo el dueño o un administrador puede importar el historial.', 'Repetir el mismo archivo no duplica nada: lo ya importado se omite.', 'La fecha va como AAAA-MM-DD y el total en soles, con punto o coma decimal.'],
};

const AYUDA_PREVIA: Ayuda = {
  titulo: 'Revisar el historial de pedidos antes de importarlo',
  paraQueSirve: 'Lee el archivo fila por fila y te dice cuántos trabajos se crearían, cuáles ya se importaron, cuáles tienen errores y qué clientes faltan. No guarda nada.',
  cuandoUsarla: 'Antes de importar el historial, para corregir el archivo sin riesgo.',
  ejemploTecleado: 'revisar este archivo de historial antes de importarlo',
  ejemploHablado: 'revisa el historial de trabajos sin guardar nada',
  relacionadas: ['pedidos_importar_historial'],
  ...AYUDA_COMUN,
};

const AYUDA_APLICAR: Ayuda = {
  titulo: 'Importar el historial de pedidos',
  paraQueSirve: 'Crea un pedido ya entregado por cada trabajo del archivo, con serie HIST, sin deudas ni avisos. Sirve para que el historial de cada cliente y los precios anteriores existan desde el primer día.',
  cuandoUsarla: 'Una sola vez al empezar, cuando ya revisaste el archivo. Se confirma desde la pantalla.',
  ejemploTecleado: 'importar el historial de trabajos',
  ejemploHablado: 'carga el historial que revisamos',
  relacionadas: ['pedidos_importar_historial_previsualizar'],
  ...AYUDA_COMUN,
};

const lectura = (p: Plan) => {
  const sumables = p.nuevas;
  const fechas = sumables.map((f) => f.fecha).sort();
  return {
    separador: p.separador,
    total: p.total,
    omitidasPorFecha: p.omitidasPorFecha,
    columnasIgnoradas: p.columnasIgnoradas,
    errores: recortar(porFila(p.errores)),
    erroresTotal: p.errores.length,
    duplicadas: recortar(porFila(p.duplicadas)),
    duplicadasTotal: p.duplicadas.length,
    clientesPorCrear: recortar(p.clientesPorCrear.map((c) => c.nombre)),
    clientesPorCrearTotal: p.clientesPorCrear.length,
    totalCentimos: sumables.reduce((s, f) => s + f.totalCentimos, 0),
    primeraFecha: fechas[0] ?? null,
    ultimaFecha: fechas.at(-1) ?? null,
  };
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function resumenDe(p: Plan): string {
  const l = lectura(p);
  const cuanto = p.nuevas.length === 0 ? 'No se creará ningún trabajo' : `Se crearán ${plural(p.nuevas.length, 'trabajo entregado', 'trabajos entregados')} por ${formatearSoles(l.totalCentimos)} (del ${l.primeraFecha} al ${l.ultimaFecha})`;
  return `${cuanto}; ${p.clientesPorCrear.length} ${p.clientesPorCrear.length === 1 ? 'cliente nuevo' : 'clientes nuevos'}; ${p.duplicadas.length} ya se importaron y se omitirán; ${plural(p.errores.length, 'fila tiene errores y no se importará', 'filas tienen errores y no se importarán')}; ${p.omitidasPorFecha} anteriores a la fecha de corte se omiten.`;
}

/** Cambia si cambia lo que se crearía: la confirmación deja de valer si otra importación cruzó estos mismos trabajos. */
const huellaDe = (p: Plan) =>
  createHash('sha256').update(JSON.stringify([p.nuevas.map((f) => f.huella), p.errores.length, p.duplicadas.length, p.clientesPorCrear.map((c) => c.clave)])).digest('hex');

/** Crea los clientes que faltan con `clientes_crear`; devuelve el id por nombre normalizado y deja como error las filas sin cliente. */
async function crearClientes(invocador: Invocador, tx: Transaccion, ctx: ContextoDeHerramienta, plan: Plan, errores: FilaConMotivo[]): Promise<{ ids: Map<string, string>; creados: number }> {
  const ids = new Map(plan.existentes);
  let creados = 0;
  for (const c of plan.clientesPorCrear) {
    const r = await invocador.invocar(tx, ctx, 'clientes_crear', { nombre: c.nombre, clase: 'persona' });
    if (r.ok) {
      ids.set(c.clave, (r.datos as { id: string }).id);
      creados++;
      continue;
    }
    const otro = 'error' in r && r.error.codigo === 'conflicto' ? (await clientesPorNombre(tx, ctx, [c.clave])).get(c.clave) : undefined;
    if (otro) ids.set(c.clave, otro);
    else for (const fila of c.filas) errores.push({ fila, motivo: `No se pudo crear el cliente «${c.nombre}»${'error' in r ? `: ${r.error.mensaje}` : '.'}` });
  }
  return { ids, creados };
}

/** Reserva los números por año (una vez cada año) y arma el pedido y la línea de cada trabajo, del más antiguo al más reciente. */
async function armarPedidos(tx: Transaccion, ctx: ContextoDeHerramienta, filas: readonly FilaPlanificada[], ids: Map<string, string>): Promise<PedidoDeHistorial[]> {
  const ordenadas = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.fila - b.fila);
  const siguiente = new Map<number, number>();
  for (const anio of new Set(ordenadas.map((f) => Number(f.fecha.slice(0, 4))))) {
    const cantidad = ordenadas.filter((f) => Number(f.fecha.slice(0, 4)) === anio).length;
    siguiente.set(anio, await reservarNumeros(tx, CLAVE_DE_CORRELATIVO, { serie: SERIE_DE_HISTORIAL, anio }, cantidad));
  }
  return ordenadas.map((f) => {
    const anio = Number(f.fecha.slice(0, 4));
    const numero = siguiente.get(anio)!;
    siguiente.set(anio, numero + 1);
    const instante = instanteDeDia(f.fecha);
    const extra = {
      importado: true,
      huella: f.huella,
      ...(f.cobradoCentimos !== null && { cobradoAlRegistrarCentimos: f.cobradoCentimos }),
      ...(f.rubro && { rubro: f.rubro }),
      ...(f.fuente && { fuente: f.fuente }),
      ...(f.clienteOriginal && f.clienteOriginal !== f.cliente && { clienteOriginal: f.clienteOriginal }),
    };
    return {
      tenantId: ctx.empresaId,
      numero,
      serie: SERIE_DE_HISTORIAL,
      anio,
      clienteId: ids.get(f.claveCliente)!,
      estado: 'entregado',
      fecha: f.fecha,
      entregaEl: f.fecha,
      igvPorcentaje: 0,
      subtotalCentimos: f.totalCentimos,
      igvCentimos: 0,
      totalCentimos: f.totalCentimos,
      notas: f.notas,
      origenTipo: ORIGEN_DE_HISTORIAL,
      origenId: f.huella,
      confirmadoEn: instante,
      entregadoEn: instante,
      creadoEn: instante,
      datosExtra: extra,
      creadoPor: ctx.usuarioId,
    };
  });
}

export function crearHerramientasDeHistorial(invocador: Invocador) {
  const previsualizar = definirHerramienta('pedidos_importar_historial_previsualizar', {
    modulo: MODULO,
    permiso: 'ordenes:editar',
    criticidad: 'lectura',
    ayuda: AYUDA_PREVIA,
    auditar: () => ({ entidadTipo: 'pedido' }),
    async ejecutar(args, ctx, tx) {
      if (!permitido(ctx)) return rechazo('sin_permiso', SIN_PERMISO);
      const r = await planificarHistorial(tx, ctx, args as Entrada);
      if (!r.ok) return r;
      return exito({ ...lectura(r.plan), nuevas: r.plan.nuevas.length });
    },
  });

  const importar = definirHerramienta('pedidos_importar_historial', {
    modulo: MODULO,
    permiso: 'ordenes:editar',
    criticidad: 'critica',
    ayuda: AYUDA_APLICAR,
    auditar: (_a, d) => ({ entidadTipo: 'pedido', ...(d && { resumen: { creadas: d.creadas, duplicadas: d.duplicadasTotal, errores: d.erroresTotal, clientesCreados: d.clientesCreados, totalCentimos: d.totalCentimos } }) }),
    async resumir(args, ctx, tx): Promise<ResultadoDeResumen> {
      if (!permitido(ctx)) return { ok: false, error: rechazo('sin_permiso', SIN_PERMISO).error };
      const r = await planificarHistorial(tx, ctx, args as Entrada);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, resumen: { resumen: resumenDe(r.plan), huella: huellaDe(r.plan) } };
    },
    async ejecutar(args, ctx, tx) {
      if (!permitido(ctx)) return rechazo('sin_permiso', SIN_PERMISO);
      const r = await planificarHistorial(tx, ctx, args as Entrada);
      if (!r.ok) return r;
      const errores = [...r.plan.errores];
      const { ids, creados } = await crearClientes(invocador, tx, ctx, r.plan, errores);
      const nuevas = r.plan.nuevas.filter((f) => ids.has(f.claveCliente));
      if (nuevas.length > 0) {
        const pedidos = await armarPedidos(tx, ctx, nuevas, ids);
        const lineas = nuevas.map((f) => ({ huella: f.huella, descripcion: f.descripcion, totalCentimos: f.totalCentimos }));
        const entraron = await insertarHistorial(tx, ctx, pedidos, lineas);
        if (entraron !== pedidos.length) return rechazo('conflicto', 'Otra importación del historial se cruzó con esta: vuelve a intentarlo.');
      }
      const final: Plan = { ...r.plan, errores, nuevas };
      return exito({ ...lectura(final), creadas: nuevas.length, clientesCreados: creados });
    },
  });

  return [previsualizar, importar];
}

