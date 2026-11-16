import { diasAtras } from './azar.ts';
import { AYER, centimos, contar, escribible, minFecha, seccion, sumarDias, type Ctx } from './contexto.ts';

const MEDIOS = ['efectivo', 'efectivo', 'transferencia', 'yape', 'plin', 'tarjeta'] as const;

function monto(c: Ctx, factor = 1): number {
  const [min, max] = c.sec.ticket;
  return centimos((min + (max - min) * c.az.next() ** 2) * factor);
}

async function prepararCuentas(c: Ctx): Promise<any[]> {
  await c.s.herramienta('registro_iniciar');
  let cuentas = await c.s.todos('cuentas_listar');
  if (cuentas.length < 3) {
    const suc = c.sucursales[0]?.id ?? null;
    await c.s.herramienta('cuenta_crear', { nombre: 'Banco BCP · cuenta corriente', tipo: 'banco', sucursalId: suc, saldoInicialCentimos: centimos(c.sec.ticket[1] * 1.5) });
    await c.s.herramienta('cuenta_crear', { nombre: 'Yape del negocio', tipo: 'billetera', sucursalId: suc, saldoInicialCentimos: centimos(c.sec.ticket[0] * 4) });
    cuentas = await c.s.todos('cuentas_listar');
  }
  return cuentas;
}

async function sembrarMovimientos(c: Ctx, cuentas: any[], categorias: any[]): Promise<void> {
  const porTipo = { ingreso: categorias.filter((x) => x.tipo === 'ingreso'), egreso: categorias.filter((x) => x.tipo === 'egreso') };
  for (let i = 0; i < 100; i++) {
    const tipo = c.az.chance(0.6) ? 'ingreso' : 'egreso';
    const cat = c.az.pick(porTipo[tipo].length ? porTipo[tipo] : categorias);
    const descripcion = c.az.pick(tipo === 'ingreso' ? c.sec.ingresos : c.sec.egresos);
    const contacto = tipo === 'ingreso' ? c.az.pick(c.clientes) : c.az.pick(c.proveedores);
    await c.s.herramienta('movimiento_registrar', {
      tipo,
      montoCentimos: monto(c, tipo === 'ingreso' ? 1 : 0.5),
      fecha: diasAtras(c.az.int(1, 150)),
      cuentaId: c.az.pick(cuentas).id,
      categoriaId: cat?.id ?? null,
      contactoId: c.az.chance(0.55) && contacto ? contacto.id : null,
      medioDePago: c.az.pick(MEDIOS),
      descripcion,
    });
  }
  const [caja, banco] = [cuentas.find((x) => x.esPrincipal) ?? cuentas[0], cuentas.find((x) => x.tipo === 'banco')];
  if (caja && banco && caja.id !== banco.id) {
    for (let i = 0; i < 4; i++) {
      await c.s.herramienta('cuentas_transferir', { origenId: caja.id, destinoId: banco.id, montoCentimos: monto(c, 0.8), fecha: diasAtras(c.az.int(2, 140)), nota: 'Depósito de la caja al banco' });
    }
  }
}

async function sembrarDeudas(c: Ctx): Promise<void> {
  const crear = async (tipo: 'por_cobrar' | 'por_pagar', contacto: any, concepto: string, factor: number): Promise<void> => {
    const fecha = diasAtras(c.az.int(8, 140));
    const total = monto(c, factor);
    const deuda = await c.s.herramienta('deuda_crear', { tipo, contactoId: contacto.id, concepto, totalCentimos: total, fecha, venceEn: sumarDias(fecha, c.az.pick([7, 15, 30, 45])), sucursalId: c.sucursales[0]?.id ?? null });
    const suerte = c.az.next();
    if (suerte < 0.28) return; // sin pagos: queda vencida o por vencer
    const pagos = suerte < 0.55 ? 1 : 2;
    let restante = total;
    for (let k = 0; k < pagos; k++) {
      const parte = suerte > 0.78 && k === pagos - 1 ? restante : Math.max(100, Math.min(restante, centimos((total / 100) * (0.25 + c.az.next() * 0.4))));
      if (parte <= 0) break;
      restante -= parte;
      await c.s.herramienta('deuda_abonar', { id: deuda.id, montoCentimos: parte, fecha: minFecha(sumarDias(fecha, c.az.int(1, 25) + k * 10), AYER()), medioDePago: c.az.pick(MEDIOS) });
    }
  };
  for (let i = 0; i < 18; i++) await crear('por_cobrar', c.az.pick(c.clientes), `${c.az.pick(c.sec.ingresos)} · crédito`, 1);
  for (let i = 0; i < 7; i++) await crear('por_pagar', c.az.pick(c.proveedores), `${c.az.pick(c.sec.egresos)} · factura`, 0.6);
}

/** Finanzas ligeras (módulo `registro`): cuentas, movimientos de cinco meses, transferencias, deudas y abonos. */
export async function sembrarFinanzas(c: Ctx): Promise<void> {
  if (!escribible(c, 'registro')) return;
  await seccion(c, 'finanzas', async () => {
    const cuentas = await prepararCuentas(c);
    const categorias = (await c.s.todos('categorias_listar')).filter((x: any) => x.nombre !== 'Transferencia'); // la usan solo las transferencias
    if ((await contar(c, 'registro.movimientos')) === 0) await sembrarMovimientos(c, cuentas, categorias);
    if ((await contar(c, 'registro.deudas')) === 0) await sembrarDeudas(c);
  });
}
