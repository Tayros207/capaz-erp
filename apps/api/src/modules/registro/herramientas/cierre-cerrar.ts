import { MAXIMO_CONTADO_CENTIMOS, exito, formatearSoles, rechazo, sumarDias, type ErrorDeRespuesta } from '@capaz/shared';
import { NOMBRE_DE_CATEGORIA_DE_DIFERENCIA } from '@capaz/shared';
import { hoyDeLaEmpresa, type HoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { normalizarNombre } from '../domain/catalogos.js';
import { PREFIJO_DE_CIERRE, descripcionDeDiferencia, diaCompleto, diaYMes, diferenciaDe, explicacionSuficiente, movimientoDeDiferencia, textoDeDiferencia } from '../domain/cierre.js';
import { crearCategoria } from '../repositories/categorias.repository.js';
import { cierreDeSemana, cifrasDeCuentas, insertarCierre, type CifrasDeCuenta } from '../repositories/cierres.repository.js';
import { bloquearCuentas, listarCuentas } from '../repositories/cuentas.repository.js';
import { exigirAlcanceTotal, ID_DE_EJEMPLO, MODULO } from './comun.js';
import { guardarMovimiento } from './guardar-movimiento.js';
import { aCierreDto, aMovimientoDeSemana } from './mapeo.js';

// Cerrar la semana: se cuenta el dinero de CADA cuenta y lo que no cuadra queda como un movimiento «Diferencia de caja».

type Conteo = { cuentaId: string; contadoCentimos: number; explicacion?: string | undefined };
type Entrada = { desde: string; conteos: Conteo[]; notas?: string | undefined };
type Fila = { cifras: CifrasDeCuenta; contadoCentimos: number; diferenciaCentimos: number; explicacion: string | null };
type Plan = { desde: string; hasta: string; filas: Fila[] };
type Rechazo = { ok: false; error: ErrorDeRespuesta };

const OTRA_PERSONA = 'Otra persona cerró esta semana mientras confirmabas: revisa el cierre.';

async function validarSemana(tx: Transaccion, ctx: ContextoDeHerramienta, desde: string, hasta: string, hoy: HoyDeLaEmpresa): Promise<Rechazo | null> {
  if (desde > hoy.dia) return rechazo('conflicto', 'Esa semana todavía no empieza: no se puede cerrar.');
  if (hasta > hoy.dia) return rechazo('conflicto', `Esta semana termina el sábado ${diaCompleto(hasta)}: ciérrala ese día o después.`);
  if (await cierreDeSemana(tx, ctx, desde)) return rechazo('conflicto', `La semana del ${diaYMes(desde)} al ${diaYMes(hasta)} ya está cerrada.`);
  return null;
}

/** Cada cuenta indicada existe y está activa, ninguna se repite y ninguna activa queda sin contar. */
function validarConteos(conteos: Conteo[], cuentas: { id: string; nombre: string; tipo: string }[]): Rechazo | null {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  if (conteos.some((c) => !porId.has(c.cuentaId))) return rechazo('no_encontrado', 'Una de las cuentas no existe o está archivada.');
  const vistas = new Set<string>();
  for (const c of conteos) {
    if (vistas.has(c.cuentaId)) return rechazo('argumentos_invalidos', `La cuenta «${porId.get(c.cuentaId)?.nombre}» aparece dos veces.`);
    vistas.add(c.cuentaId);
    const cuenta = porId.get(c.cuentaId);
    if (!Number.isSafeInteger(c.contadoCentimos) || Math.abs(c.contadoCentimos) > MAXIMO_CONTADO_CENTIMOS) {
      return rechazo('argumentos_invalidos', `El monto contado en «${cuenta?.nombre}» no es válido: máximo ${formatearSoles(MAXIMO_CONTADO_CENTIMOS)}.`);
    }
    if (cuenta?.tipo === 'caja' && c.contadoCentimos < 0) return rechazo('argumentos_invalidos', `Lo contado en la caja «${cuenta.nombre}» no puede ser negativo.`);
  }
  const falta = cuentas.find((c) => !vistas.has(c.id));
  return falta ? rechazo('argumentos_invalidos', `Falta lo contado en «${falta.nombre}».`) : null;
}

function armarFilas(cifras: CifrasDeCuenta[], conteos: Conteo[]): Fila[] {
  return cifras.map((c) => {
    const conteo = conteos.find((x) => x.cuentaId === c.cuenta.id) as Conteo;
    return {
      cifras: c,
      contadoCentimos: conteo.contadoCentimos,
      diferenciaCentimos: diferenciaDe(c.sistemaCentimos, conteo.contadoCentimos),
      explicacion: conteo.explicacion?.trim() || null,
    };
  });
}

function validarExplicaciones(filas: Fila[]): Rechazo | null {
  const sin = filas.find((f) => f.diferenciaCentimos !== 0 && !explicacionSuficiente(f.explicacion ?? undefined));
  if (!sin) return null;
  return rechazo('argumentos_invalidos', `Explica por qué «${sin.cifras.cuenta.nombre}» no cuadra (${textoDeDiferencia(sin.diferenciaCentimos)}): al menos 15 caracteres.`);
}

/** Valida en el orden del plan y arma lo que se va a cerrar. `bloquear`: toma las cuentas con `for update` (solo al ejecutar). */
async function prepararCierre(tx: Transaccion, ctx: ContextoDeHerramienta, args: Entrada, bloquear: boolean): Promise<Rechazo | { ok: true; plan: Plan; hoy: HoyDeLaEmpresa }> {
  const hoy = await hoyDeLaEmpresa(tx);
  const hasta = sumarDias(args.desde, 5);
  const semana = await validarSemana(tx, ctx, args.desde, hasta, hoy);
  if (semana) return semana;
  const activas = await listarCuentas(tx, ctx, { incluirArchivadas: false });
  const cuentas = bloquear ? await bloquearCuentas(tx, ctx, activas.map((c) => c.id)) : activas;
  const conteos = validarConteos(args.conteos, cuentas);
  if (conteos) return conteos;
  const filas = armarFilas(await cifrasDeCuentas(tx, ctx, cuentas, args.desde, hasta), args.conteos);
  const explicaciones = validarExplicaciones(filas);
  return explicaciones ?? { ok: true, plan: { desde: args.desde, hasta, filas }, hoy };
}

async function categoriaDeDiferencia(tx: Transaccion, ctx: ContextoDeHerramienta, tipo: 'ingreso' | 'egreso'): Promise<string> {
  const r = await crearCategoria(tx, ctx, { nombre: NOMBRE_DE_CATEGORIA_DE_DIFERENCIA, nombreNormalizado: normalizarNombre(NOMBRE_DE_CATEGORIA_DE_DIFERENCIA), tipo });
  return r.creada ? r.categoria.id : r.existente.id;
}

export const semanaCerrar = definirHerramienta('semana_cerrar', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'critica',
  mueveDinero: true,
  ayuda: {
    titulo: 'Cerrar la semana de caja',
    paraQueSirve: 'Cuentas el dinero de cada cuenta al sábado y lo compara con lo que dice el sistema. Si no cuadra, anota la diferencia (con su explicación) y deja la semana cerrada.',
    cuandoUsarla: 'El sábado por la tarde o el lunes, después de contar la caja, el banco y las billeteras.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Lunes de la semana (AAAA-MM-DD).', ejemplo: '2026-11-16' },
      { nombre: 'conteos', queSeAnota: 'Lo contado en CADA cuenta activa: cuentaId, contadoCentimos y, si no cuadra, la explicación (mínimo 15 caracteres).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'notas', queSeAnota: 'Nota del cierre (opcional).', ejemplo: 'Se contó con la dueña presente' },
    ],
    ejemploTecleado: 'cerrar la semana del 16 de noviembre: caja 1,250.00 y banco 8,400.00',
    ejemploHablado: 'cierra la caja de la semana, conté mil doscientos cincuenta en caja',
    erroresComunes: ['La semana todavía no termina.', 'La semana ya está cerrada.', 'Falta contar una cuenta.', 'Una diferencia necesita explicación.', 'La confirmación venció o cambió un movimiento: vuelve a pedirla.'],
    relacionadas: ['semana_revisar', 'movimientos_listar'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'cierre', entidadId: d?.cierre.id, ...(d && { resumen: { desde: d.cierre.desde, diferenciaTotalCentimos: d.cierre.diferenciaTotalCentimos } }) }),
  async resumir(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const r = await prepararCierre(tx, ctx, args, false);
    if (!r.ok) return r;
    const { desde, hasta, filas } = r.plan;
    const total = filas.reduce((s, f) => s + f.diferenciaCentimos, 0);
    const conDiferencia = filas.filter((f) => f.diferenciaCentimos !== 0).length;
    const cuadre = conDiferencia === 0 ? 'Todo cuadra.' : `${conDiferencia} cuenta(s) no cuadran: se anotarán como «Diferencia de caja» (neto ${total < 0 ? '-' : ''}${formatearSoles(Math.abs(total))}).`;
    return {
      ok: true,
      resumen: {
        resumen: `Cerrarás la semana del ${diaYMes(desde)} al ${diaYMes(hasta)} con ${filas.length} cuenta(s) contadas. ${cuadre}`,
        huella: hashCanonico({
          desde,
          sistema: Object.fromEntries(filas.map((f) => [f.cifras.cuenta.id, f.cifras.sistemaCentimos])),
          conteos: Object.fromEntries(filas.map((f) => [f.cifras.cuenta.id, f.contadoCentimos])),
        }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const r = await prepararCierre(tx, ctx, args, true);
    if (!r.ok) return r;
    const { desde, hasta, filas } = r.plan;
    const creados = [];
    const saldos = [];
    for (const f of filas) {
      const diferencia = movimientoDeDiferencia(f.diferenciaCentimos);
      let movimientoId: string | null = null;
      if (diferencia) {
        const { movimiento } = await guardarMovimiento(tx, ctx, r.hoy.anio, f.cifras.cuenta, {
          ...diferencia,
          fecha: hasta,
          categoriaId: await categoriaDeDiferencia(tx, ctx, diferencia.tipo),
          contactoId: null,
          medioDePago: f.cifras.cuenta.tipo === 'caja' ? 'efectivo' : 'otro',
          descripcion: descripcionDeDiferencia(desde, hasta, f.explicacion ?? ''),
          deudaId: null,
          sucursalId: null,
          origen: 'modulo',
          origenRef: `${PREFIJO_DE_CIERRE}${desde}:${f.cifras.cuenta.id}`,
        });
        movimientoId = movimiento.id;
        creados.push(aMovimientoDeSemana(movimiento));
      }
      saldos.push({ cuentaId: f.cifras.cuenta.id, nombre: f.cifras.cuenta.nombre, sistemaCentimos: f.cifras.sistemaCentimos, contadoCentimos: f.contadoCentimos, diferenciaCentimos: f.diferenciaCentimos, movimientoId, explicacion: f.explicacion });
    }
    const cierre = await insertarCierre(tx, ctx, { desde, hasta, saldos, notas: args.notas || null });
    if (!cierre) return rechazo('conflicto', OTRA_PERSONA);
    return exito({ cierre: aCierreDto(cierre), movimientosCreados: creados });
  },
});
