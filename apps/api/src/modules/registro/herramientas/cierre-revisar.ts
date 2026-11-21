import { exito, semanaDe, sumarDias, type SemanaRevisadaDto } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { ajustesPosterioresACierre, estadoDeSemana } from '../domain/cierre.js';
import { cierreDeSemana, cifrasDeCuentas, movimientosDeSemana } from '../repositories/cierres.repository.js';
import { listarCuentas } from '../repositories/cuentas.repository.js';
import { exigirAlcanceTotal, MODULO } from './comun.js';
import { aCierreDto } from './mapeo.js';

// Revisar una semana antes de cerrarla: saldos por cuenta al sábado, movimientos y lo que conviene mirar. Solo lee.

export const semanaRevisar = definirHerramienta('semana_revisar', {
  modulo: MODULO,
  permiso: 'registro:reportes',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Revisar la semana de caja',
    paraQueSirve: 'Muestra, para la semana de lunes a sábado, el saldo que dice el sistema en cada cuenta, los movimientos y los ingresos que conviene revisar antes de contar el dinero.',
    cuandoUsarla: 'El sábado (o después), antes de cerrar la semana, o para ver un cierre ya hecho.',
    campos: [{ nombre: 'fecha', queSeAnota: 'Cualquier día de la semana a revisar (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'revisar la semana de caja',
    ejemploHablado: 'cómo va la caja de esta semana',
    erroresComunes: ['Tu acceso es solo a tus propios registros.', 'Un domingo muestra la semana que terminó el día anterior.'],
    relacionadas: ['semana_cerrar', 'caja_del_dia'],
  },
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const hoy = await hoyDeLaEmpresa(tx);
    const semana = semanaDe(args.fecha ?? hoy.dia);
    const movimientosDesde = sumarDias(semana.desde, -1);
    const cifras = await cifrasDeCuentas(tx, ctx, await listarCuentas(tx, ctx, { incluirArchivadas: false }), semana.desde, semana.hasta, hoy.dia);
    const cierre = await cierreDeSemana(tx, ctx, semana.desde);
    const cierreAnterior = await cierreDeSemana(tx, ctx, sumarDias(semana.desde, -7));
    const todos = await movimientosDeSemana(tx, ctx, movimientosDesde, semana.hasta, 'todos', 200);
    const sinCliente = await movimientosDeSemana(tx, ctx, movimientosDesde, semana.hasta, 'ingresos_sin_cliente', 50);
    const dudosos = await movimientosDeSemana(tx, ctx, movimientosDesde, semana.hasta, 'cobros_en_cuenta_dudosa', 50);
    const dto = cierre ? aCierreDto(cierre) : null;
    const salida: SemanaRevisadaDto = {
      ...semana,
      movimientosDesde,
      estado: estadoDeSemana(semana, hoy.dia, dto !== null),
      cuentas: cifras.map((c) => ({
        cuentaId: c.cuenta.id,
        nombre: c.cuenta.nombre,
        tipo: c.cuenta.tipo as 'caja' | 'banco' | 'billetera',
        saldoInicialCentimos: c.saldoInicialCentimos,
        ingresosCentimos: c.ingresosCentimos,
        egresosCentimos: c.egresosCentimos,
        transferenciasNetasCentimos: c.transferenciasNetasCentimos,
        sistemaCentimos: c.sistemaCentimos,
        movimientosPosterioresCentimos: c.movimientosPosterioresCentimos,
        movimientos: c.movimientos,
      })),
      movimientos: todos.items,
      movimientosTotal: todos.total,
      ingresosSinCliente: sinCliente.items,
      ingresosSinClienteTotal: sinCliente.total,
      cobrosEnCuentaDudosa: dudosos.items,
      cobrosEnCuentaDudosaTotal: dudosos.total,
      cierre: dto,
      cambiosDesdeElCierre: (dto?.saldos ?? []).flatMap((s) => {
        const actual = cifras.find((c) => c.cuenta.id === s.cuentaId);
        return actual && actual.sistemaCentimos !== s.contadoCentimos ? [{ cuentaId: s.cuentaId, nombre: actual.cuenta.nombre, contadoCentimos: s.contadoCentimos, sistemaCentimos: actual.sistemaCentimos }] : [];
      }),
      ajustesPosterioresACierre: ajustesPosterioresACierre(
        cifras.map((c) => ({ cuentaId: c.cuenta.id, nombre: c.cuenta.nombre, saldoInicialCentimos: c.saldoInicialCentimos })),
        cierreAnterior ? aCierreDto(cierreAnterior).saldos : [],
      ),
    };
    return exito(salida);
  },
});
