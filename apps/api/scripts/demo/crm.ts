import { AYER, contar, escribible, seccion, sumarDias, type Ctx } from './contexto.ts';
import { centimos } from './contexto.ts';

const TIPOS = ['llamada', 'reunion', 'mensaje', 'tarea'] as const;
const ASUNTOS = ['Enviar cotización', 'Llamar para seguimiento', 'Reunión de presentación', 'Resolver dudas del cliente', 'Confirmar presupuesto', 'Visita al local'];
const MOTIVOS = ['Eligió a otro proveedor', 'Presupuesto fuera de alcance', 'Postergó la decisión', 'Sin respuesta del cliente'];

/** CRM: etapas, oportunidades en distintas etapas (algunas ganadas y perdidas) y actividades, algunas vencidas. */
export async function sembrarCrm(c: Ctx): Promise<void> {
  if (!escribible(c, 'crm')) return;
  await seccion(c, 'crm', async () => {
    await c.s.herramienta('crm_iniciar');
    if ((await contar(c, 'crm.oportunidades')) > 0) return;
    const etapas = (await c.s.todos('etapas_listar')).filter((e: any) => e.tipo === 'abierta');
    if (!etapas.length) return;
    for (let i = 0; i < 22; i++) {
      const cliente = c.az.pick(c.clientes);
      const etapa = c.az.pick(etapas);
      const [min, max] = c.sec.ticket;
      const op = await c.s.herramienta('oportunidad_crear', {
        titulo: `${c.az.pick(['Cotización', 'Propuesta', 'Pedido recurrente', 'Proyecto', 'Contrato anual'])} · ${cliente.nombre}`.slice(0, 150),
        clienteId: cliente.id,
        etapaId: etapa.id,
        montoEstimadoCentimos: centimos((min + (max - min) * c.az.next()) * 1.4),
        fechaEsperada: sumarDias(AYER(), c.az.int(-12, 45)),
        notas: c.az.chance(0.3) ? 'Cliente pidió descuento por volumen' : null,
      });
      const suerte = c.az.next();
      if (suerte < 0.22) await c.s.herramienta('oportunidad_ganar', { id: op.id });
      else if (suerte < 0.38) await c.s.herramienta('oportunidad_perder', { id: op.id, motivo: c.az.pick(MOTIVOS) });
      else if (suerte < 0.62 && etapas.length > 1) {
        const otra = c.az.pick(etapas.filter((e: any) => e.id !== etapa.id));
        await c.s.herramienta('oportunidad_mover', { id: op.id, etapaId: otra.id });
      }
      if (suerte >= 0.38 && c.az.chance(0.7)) {
        const act = await c.s.herramienta('actividad_crear', { oportunidadId: op.id, tipo: c.az.pick(TIPOS), asunto: c.az.pick(ASUNTOS), venceEl: sumarDias(AYER(), c.az.int(-20, 14)) });
        if (c.az.chance(0.25)) await c.s.herramienta('actividad_completar', { id: act.id, nota: 'Hecho; el cliente pidió ajustes.' });
      }
    }
  });
}
