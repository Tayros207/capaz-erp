import { exito } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { calcularCobertura, rangoDelMes } from '../domain/cobertura.js';
import { datosDeCobertura } from '../repositories/cobertura.repository.js';
import { exigirAlcanceTotal, MODULO } from './comun.js';

// Cobertura del mes: suma lo de toda la empresa, por eso exige alcance «todos». Solo lee.

export const registroCoberturaDelMes = definirHerramienta('registro_cobertura_del_mes', {
  modulo: MODULO,
  permiso: 'registro:reportes',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Cobertura de los pagos del mes',
    paraQueSirve: 'Compara lo que entró en el mes (sin transferencias ni diferencias de caja) con los pagos del mes: las deudas por pagar no anuladas que vencen ese mes, sean pagos fijos o compras a crédito, y dice cuánto falta cubrir.',
    cuandoUsarla: 'Para saber, a mitad de mes, si lo vendido ya alcanza para los pagos del mes (alquiler, sueldos, servicios, compras a crédito).',
    campos: [{ nombre: 'mes', queSeAnota: 'Mes a revisar (AAAA-MM); por defecto, el mes actual.', ejemplo: '2026-11' }],
    ejemploTecleado: 'cuánto me falta para cubrir los pagos del mes',
    ejemploHablado: 'ya cubrí los pagos de este mes',
    erroresComunes: ['Sin deudas por pagar con fecha de vencimiento en el mes, no hay nada que cubrir.', 'Tu acceso es solo a tus propios registros.'],
    relacionadas: ['registro_resumen', 'deudas_listar'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { mes: d.mes, compromisos: d.compromisos } }) }),
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const rango = rangoDelMes(args.mes ?? (await hoyDeLaEmpresa(tx)).dia.slice(0, 7));
    const c = calcularCobertura(await datosDeCobertura(tx, ctx, rango.desde, rango.hasta));
    return exito({ ...rango, ...c });
  },
});
