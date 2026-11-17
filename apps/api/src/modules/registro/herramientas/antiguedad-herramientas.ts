import { exito } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { agruparAntiguedad } from '../domain/antiguedad.js';
import { deudasAbiertasConContacto } from '../repositories/reportes.repository.js';
import { exigirAlcanceTotal, MODULO } from './comun.js';

// Antigüedad de saldos: suma lo de toda la empresa, por eso exige alcance «todos» (R4). Solo lee.

export const deudasAntiguedad = definirHerramienta('deudas_antiguedad', {
  modulo: MODULO,
  permiso: 'registro:reportes',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Antigüedad de saldos',
    paraQueSirve: 'Muestra cuánto te deben (o debes) por cliente o proveedor y hace cuánto venció: vigente, de 1 a 30 días, de 31 a 60, de 61 a 90 y más de 90.',
    cuandoUsarla: 'Para decidir a quién cobrar primero o qué pagos están por atrasarse.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'por_cobrar (lo que te deben) o por_pagar (lo que debes); por defecto, por_cobrar.', ejemplo: 'por_cobrar' },
      { nombre: 'fecha', queSeAnota: 'Día de corte (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'antigüedad de lo que me deben',
    ejemploHablado: 'quién me debe hace más de tres meses',
    erroresComunes: ['Tu acceso es solo a tus propios registros: pide a un administrador ver el reporte completo.'],
    relacionadas: ['deudas_listar', 'registro_resumen'],
  },
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const fecha = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    const { filas, totales } = agruparAntiguedad(await deudasAbiertasConContacto(tx, ctx, args.tipo), fecha);
    return exito({ tipo: args.tipo, fecha, filas, totales });
  },
});
