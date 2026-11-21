import { exito, formatearSoles, rechazo, type DeudaDto, type ErrorDeRespuesta } from '@capaz/shared';
import { hoyDeLaEmpresa, type HoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { rangoDelMes } from '../domain/cobertura.js';
import { decidirCopias, listaDeCopias, mesAnterior, type CopiaDePagoFijo } from '../domain/pagos-fijos.js';
import { existentesDelMes, fuentesDePagoFijo, ORIGEN_DE_PAGO_FIJO } from '../repositories/pagos-fijos.repository.js';
import { exigirAlcanceTotal, MODULO } from './comun.js';
import { crearDeudaYEmitir } from './deudas-comun.js';

// Copiar los pagos fijos del mes anterior (alquiler, sueldos, servicios) al mes que empieza. Es idempotente: cada copia
// lleva el origen «pago_fijo» con el id de la fuente y el mes, y el índice único de origen impide duplicarla.

type Plan = { mes: string; mesOrigen: string; copias: CopiaDePagoFijo[]; yaExistian: number };

async function planear(tx: Transaccion, ctx: ContextoDeHerramienta, mesPedido: string | undefined, hoy: HoyDeLaEmpresa): Promise<{ ok: false; error: ErrorDeRespuesta } | { ok: true; plan: Plan }> {
  const mes = mesPedido ?? hoy.dia.slice(0, 7);
  const mesOrigen = mesAnterior(mes);
  const origen = rangoDelMes(mesOrigen);
  const destino = rangoDelMes(mes);
  const fuentes = await fuentesDePagoFijo(tx, ctx, origen.desde, origen.hasta);
  if (fuentes.length === 0) return rechazo('no_encontrado', `No hay pagos fijos con vencimiento en ${mesOrigen}: márcalos como «pago fijo» al anotarlos.`);
  const existentes = await existentesDelMes(tx, ctx, destino.desde, destino.hasta, fuentes.map((f) => `${f.id}:${mes}`));
  return { ok: true, plan: { mes, mesOrigen, ...decidirCopias(fuentes, mes, existentes) } };
}

export const deudasCopiarFijos = definirHerramienta('deudas_copiar_fijos', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Copiar los pagos fijos del mes',
    paraQueSirve: 'Anota, para el mes indicado, una copia de cada pago fijo (deuda por pagar marcada «fijo») que vencía el mes anterior: mismo proveedor, concepto, total y día de vencimiento.',
    cuandoUsarla: 'Al empezar el mes, para no volver a teclear alquiler, sueldos y servicios.',
    campos: [{ nombre: 'mes', queSeAnota: 'Mes destino (AAAA-MM); por defecto, el mes actual.', ejemplo: '2026-12' }],
    ejemploTecleado: 'copiar los pagos fijos de diciembre',
    ejemploHablado: 'pasa los pagos fijos al mes que empieza',
    erroresComunes: ['No hay pagos fijos con vencimiento en el mes anterior.', 'Los pagos fijos de ese mes ya están anotados.', 'Tu acceso es solo a tus propios registros.'],
    relacionadas: ['deuda_crear', 'deudas_listar', 'registro_cobertura_del_mes'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'deuda', ...(d && { resumen: { mes: d.mes, creadas: d.creadas, totalCentimos: d.totalCentimos } }) }),
  async resumir(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const r = await planear(tx, ctx, args.mes, await hoyDeLaEmpresa(tx));
    if (!r.ok) return r;
    const { mes, mesOrigen, copias } = r.plan;
    if (copias.length === 0) return rechazo('conflicto', `Los pagos fijos de ${mes} ya están anotados.`);
    const total = copias.reduce((s, c) => s + c.totalCentimos, 0);
    return {
      ok: true,
      resumen: {
        resumen: `Anotarás ${copias.length} pago(s) fijo(s) por ${formatearSoles(total)} con vencimiento en ${mes}, copiados de ${mesOrigen}: ${listaDeCopias(copias)}.`,
        huella: hashCanonico({ mes, origenes: copias.map((c) => c.origenId).sort(), total }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const sinAlcance = exigirAlcanceTotal(ctx);
    if (sinAlcance) return sinAlcance;
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await planear(tx, ctx, args.mes, hoy);
    if (!r.ok) return r;
    const { mes, mesOrigen, copias } = r.plan;
    let yaExistian = r.plan.yaExistian;
    const creadas: DeudaDto[] = [];
    let total = 0;
    for (const c of copias) {
      const nueva = await crearDeudaYEmitir(tx, ctx, hoy, {
        tipo: 'por_pagar',
        contactoId: c.contactoId,
        concepto: c.concepto,
        totalCentimos: c.totalCentimos,
        fecha: c.fecha,
        venceEn: c.venceEnNuevo,
        sucursalId: c.sucursalId,
        notas: null,
        origenTipo: ORIGEN_DE_PAGO_FIJO,
        origenId: c.origenId,
        datosExtra: { fijo: true, dia: c.dia ?? Number(c.venceEn.slice(8, 10)) },
      });
      if (!nueva) {
        yaExistian += 1;
        continue;
      }
      creadas.push(nueva.dto);
      total += c.totalCentimos;
    }
    return exito({ mes, mesOrigen, creadas: creadas.length, yaExistian, totalCentimos: total, deudas: creadas.slice(0, 100) });
  },
});
