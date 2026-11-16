import { exito, rechazo, type CajaDelDiaDto } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { saldoDeCuenta } from '../domain/movimiento.js';
import { flujosPorCuenta, listarCuentas, SIN_FLUJO, verCuenta } from '../repositories/cuentas.repository.js';
import { deudasAbiertasPorTipo, totalesPorCategoria } from '../repositories/reportes.repository.js';
import { exigirAlcanceTotal, ID_DE_EJEMPLO, MODULO } from './comun.js';

// Reportes del módulo: suman lo de toda la empresa, por eso exigen alcance «todos» (R4). Solo leen.

const suma = (valores: number[]): number => valores.reduce((a, b) => a + b, 0);

export const cajaDelDia = definirHerramienta('caja_del_dia', {
  modulo: MODULO,
  permiso: 'registro:reportes',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Caja del día',
    paraQueSirve: 'Muestra, por cuenta, con cuánto empezó el día, lo que entró, lo que salió y con cuánto termina.',
    cuandoUsarla: 'Para cuadrar la caja al cierre o revisar un día anterior.',
    campos: [
      { nombre: 'fecha', queSeAnota: 'Día a revisar (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-03-10' },
      { nombre: 'cuentaId', queSeAnota: 'Solo una cuenta (opcional).', ejemplo: ID_DE_EJEMPLO },
    ],
    ejemploTecleado: 'caja de hoy',
    ejemploHablado: 'cómo va la caja de hoy',
    erroresComunes: ['Tu acceso es solo a tus propios registros: pide a un administrador ver la caja completa.'],
    relacionadas: ['movimientos_listar', 'registro_resumen'],
  },
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const fecha = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    const una = args.cuentaId ? await verCuenta(tx, ctx, args.cuentaId) : null;
    if (args.cuentaId && !una) return rechazo('no_encontrado', 'No existe esa cuenta.');
    const todas = una ? [una] : await listarCuentas(tx, ctx, { incluirArchivadas: true });
    const previos = await flujosPorCuenta(tx, ctx, { antesDe: fecha, cuentaId: args.cuentaId });
    const delDia = await flujosPorCuenta(tx, ctx, { enElDia: fecha, cuentaId: args.cuentaId });
    const cuentas: CajaDelDiaDto['cuentas'] = [];
    for (const c of todas) {
      const hoy = delDia.get(c.id) ?? SIN_FLUJO;
      // Una cuenta archivada solo aparece si se pidió expresamente o si ese día tuvo movimientos.
      if (c.archivadoEn && !una && hoy.movimientos === 0) continue;
      const antes = previos.get(c.id) ?? SIN_FLUJO;
      // Las transferencias entre cuentas no son ingresos ni egresos: se muestran aparte y sí mueven el saldo.
      const ingresosCentimos = hoy.ingresos - hoy.entradasPorTransferencia;
      const egresosCentimos = hoy.egresos - hoy.salidasPorTransferencia;
      const saldoInicialCentimos = saldoDeCuenta(c.saldoInicialCentimos, antes.ingresos, antes.egresos);
      cuentas.push({
        cuentaId: c.id,
        nombre: c.nombre,
        saldoInicialCentimos,
        ingresosCentimos,
        egresosCentimos,
        transferenciasNetasCentimos: hoy.entradasPorTransferencia - hoy.salidasPorTransferencia,
        saldoFinalCentimos: saldoDeCuenta(saldoInicialCentimos, hoy.ingresos, hoy.egresos),
        movimientos: hoy.movimientos,
      });
    }
    return exito({
      fecha,
      cuentas,
      totalIngresosCentimos: suma(cuentas.map((c) => c.ingresosCentimos)),
      totalEgresosCentimos: suma(cuentas.map((c) => c.egresosCentimos)),
    });
  },
});

export const registroResumen = definirHerramienta('registro_resumen', {
  modulo: MODULO,
  permiso: 'registro:reportes',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen de ingresos, egresos y deudas',
    paraQueSirve: 'Suma lo que entró y salió en un periodo, lo separa por categoría y dice cuánto queda por cobrar y por pagar hoy.',
    cuandoUsarla: 'Para ver cómo fue la semana o el mes y qué deudas están vencidas.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del periodo (AAAA-MM-DD).', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del periodo (AAAA-MM-DD); como máximo 366 días.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'resumen de marzo',
    ejemploHablado: 'cuánto entró y cuánto salió este mes',
    erroresComunes: ['La fecha final no puede ser anterior a la inicial.', 'El periodo abarca como máximo 366 días.', 'Tu acceso es solo a tus propios registros.'],
    relacionadas: ['caja_del_dia', 'deudas_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const hoy = await hoyDeLaEmpresa(tx);
    const totales = await totalesPorCategoria(tx, ctx, args.desde, args.hasta);
    const deudas = await deudasAbiertasPorTipo(tx, ctx, hoy.dia);
    const ingresosCentimos = suma(totales.filter((t) => t.tipo === 'ingreso').map((t) => t.totalCentimos));
    const egresosCentimos = suma(totales.filter((t) => t.tipo === 'egreso').map((t) => t.totalCentimos));
    return exito({
      desde: args.desde,
      hasta: args.hasta,
      ingresosCentimos,
      egresosCentimos,
      netoCentimos: ingresosCentimos - egresosCentimos,
      porCobrarCentimos: deudas.por_cobrar.saldoCentimos,
      porPagarCentimos: deudas.por_pagar.saldoCentimos,
      vencidasPorCobrar: deudas.por_cobrar.vencidas,
      vencidasPorCobrarCentimos: deudas.por_cobrar.vencidasCentimos,
      vencidasPorPagar: deudas.por_pagar.vencidas,
      porCategoria: totales.map((t) => ({ categoriaId: t.categoriaId, nombre: t.nombre ?? 'Sin categoría', tipo: t.tipo, totalCentimos: t.totalCentimos })),
    });
  },
});
