import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type RespuestaHttp, type Sesion } from '../herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { Relevo } from '../eventos/relevo.js';
import { diaMas, HOY } from '../../modules/registro/herramientas/pruebas-de-registro.js';

// «Mi día» por HTTP real: el composer `mi_dia_ver` con las seis `_pendientes` verdaderas, permisos, alcance y anotaciones.

let app: AppDePruebas;
let dueno: Sesion;
let soloPedidos: Sesion;
let soloSusCotizaciones: Sesion;
let sol: string;
let pedidoPagado: any;
let pedidoSinAdelanto: any;
let pedidoSinDeuda: any;
let ordenAtrasada: any;
/** Lo que nunca debe salir: cancelado, anulado o de otra empresa. */
const fuera: string[] = [];
let relevo: Relevo;
let futuro = Date.now() + 3_600_000;

const datos = (r: RespuestaHttp): any => {
  if (!r.cuerpo?.ok) throw new Error(`Respuesta ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const llamar = async (s: Sesion, nombre: string, args: unknown) => datos(await s.herramienta(nombre, args));
async function confirmando(s: Sesion, nombre: string, args: unknown) {
  const pide = await s.herramienta(nombre, args);
  const token = pide.cuerpo?.requiereConfirmacion?.token;
  return datos(token ? await s.herramienta(nombre, args, { confirmacion: token }) : pide);
}
const linea = (descripcion: string, soles: number, cantidad: number) => ({ descripcion, cantidadMilesimas: cantidad * 1000, precioUnitarioMilesimas: soles * 1000 });
const tarjetas = (d: any): any[] => d.grupos.flatMap((g: any) => g.tarjetas);
const grupo = (d: any, clave: string): any[] => d.grupos.find((g: any) => g.clave === clave)?.tarjetas ?? [];

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  relevo = app.obtener(Relevo);
  [dueno, soloPedidos, soloSusCotizaciones] = await Promise.all(['Dueña', 'Solo pedidos', 'Solo sus cotizaciones'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Empresa de Mi día');
  await Promise.all(['ordenes', 'produccion', 'registro', 'cotizador', 'insumos', 'crm'].map((m) => activarModulo(A, m)));
  await agregarMiembro(app, A, soloPedidos, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  soloSusCotizaciones = await agregarMiembro(app, A, soloSusCotizaciones, { modulo: 'cotizador', nivel: 'completo', alcance: 'propios' });
  await confirmando(dueno, 'empresa_actualizar_configuracion', { razonSocial: 'Gráfica Andina SAC' });
  sol = (await llamar(dueno, 'clientes_crear', { nombre: 'Imprenta Sol', telefono: '987654321' })).id;

  // Un pedido listo, que se entrega hoy y cuya deuda ya se pagó completa.
  pedidoPagado = await llamar(dueno, 'pedido_crear', { clienteId: sol, entregaEl: HOY.dia, lineas: [linea('Volantes', 100, 10)] });
  await llamar(dueno, 'pedido_confirmar', { id: pedidoPagado.id });
  await llamar(dueno, 'pedido_cambiar_estado', { id: pedidoPagado.id, estado: 'listo' });
  const deuda = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: sol, concepto: 'Pedido', totalCentimos: 100_000, origenTipo: 'pedido', origenId: pedidoPagado.id });
  await llamar(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 100_000 });
  // Otro pedido sin entrega próxima: su deuda existe y no recibió ningún pago (sin adelanto, confirmado por Finanzas).
  pedidoSinAdelanto = await llamar(dueno, 'pedido_crear', { clienteId: sol, entregaEl: diaMas(30), lineas: [linea('Banners', 50, 2)] });
  await llamar(dueno, 'pedido_confirmar', { id: pedidoSinAdelanto.id });
  await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: sol, concepto: 'Banners', totalCentimos: 10_000, origenTipo: 'pedido', origenId: pedidoSinAdelanto.id });
  // Y uno cuya deuda aún no existe (su borrador sigue por aprobar): no se afirma «sin adelanto».
  pedidoSinDeuda = await llamar(dueno, 'pedido_crear', { clienteId: sol, entregaEl: diaMas(20), lineas: [linea('Stickers', 10, 10)] });
  await llamar(dueno, 'pedido_confirmar', { id: pedidoSinDeuda.id });
  // Una deuda vencida hace 40 días y otra de hace 70.
  await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: sol, concepto: 'Trabajo viejo', totalCentimos: 300_000, fecha: diaMas(-120), venceEn: diaMas(-40) });
  await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: sol, concepto: 'Trabajo más viejo', totalCentimos: 120_000, fecha: diaMas(-120), venceEn: diaMas(-70) });
  // Una orden de trabajo atrasada.
  ordenAtrasada = await llamar(dueno, 'produccion_orden_crear', { clienteId: sol, fecha: diaMas(-10), entregaEl: diaMas(-2), lineas: [linea('Tarjetas', 20, 10)] });
  // Una cotización emitida que vence mañana.
  await confirmando(dueno, 'cotizacion_emitir', { id: (await llamar(dueno, 'cotizacion_crear', { titulo: 'Afiches', clienteId: sol, condiciones: { validezDias: 1 }, lineas: [{ tipo: 'manual', descripcion: 'Afiches', cantidadMilesimas: 10_000, precioUnitarioMilesimas: 5_000 }] })).id });
  // Un insumo bajo mínimo.
  const papel = await llamar(dueno, 'productos_crear', { nombre: 'Papel bond A4' });
  await llamar(dueno, 'articulo_activar', { productoId: papel.id, minimoMilesimas: 10_000 });
  // Una actividad de CRM vencida.
  const op = await llamar(dueno, 'oportunidad_crear', { titulo: 'Banner grande', clienteId: sol });
  await llamar(dueno, 'actividad_crear', { oportunidadId: op.id, tipo: 'llamada', asunto: 'Confirmar medidas', venceEl: diaMas(-1) });

  // Lo que no debe aparecer: un pedido de hoy cancelado, una orden de hoy anulada y una deuda vencida anulada.
  const cancelado = await llamar(dueno, 'pedido_crear', { clienteId: sol, entregaEl: HOY.dia, lineas: [linea('Cancelado', 10, 1)] });
  await llamar(dueno, 'pedido_confirmar', { id: cancelado.id });
  await confirmando(dueno, 'pedido_cancelar', { id: cancelado.id, motivo: 'El cliente desistió' });
  const anulada = await llamar(dueno, 'produccion_orden_crear', { clienteId: sol, fecha: diaMas(-3), entregaEl: HOY.dia, lineas: [linea('Anulada', 10, 1)] });
  await confirmando(dueno, 'produccion_orden_anular', { id: anulada.id, motivo: 'Duplicada' });
  const deudaAnulada = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: sol, concepto: 'Anulada', totalCentimos: 50_000, fecha: diaMas(-90), venceEn: diaMas(-50) });
  await confirmando(dueno, 'deuda_anular', { id: deudaAnulada.id, motivo: 'Error de registro' });
  fuera.push(cancelado.id, anulada.id);

  // Otra empresa con lo mismo (entrega de hoy, deuda vencida, insumo bajo): nada de ella cruza a la primera (RLS).
  const otra = await abrirSesion(app, 'Dueño de otra empresa');
  const B = await crearEmpresa(otra, 'Otra empresa');
  await Promise.all(['ordenes', 'registro', 'insumos'].map((m) => activarModulo(B, m)));
  const luna = (await llamar(otra, 'clientes_crear', { nombre: 'Cliente de la otra', telefono: '912345678' })).id;
  const ajeno = await llamar(otra, 'pedido_crear', { clienteId: luna, entregaEl: HOY.dia, lineas: [linea('Ajeno', 10, 1)] });
  await llamar(otra, 'pedido_confirmar', { id: ajeno.id });
  await llamar(otra, 'deuda_crear', { tipo: 'por_cobrar', contactoId: luna, concepto: 'Ajena', totalCentimos: 70_000, fecha: diaMas(-90), venceEn: diaMas(-45) });
  fuera.push(luna, ajeno.id);
});
afterAll(async () => {
  await app.cerrar();
});

describe('mi_dia_ver', () => {
  it('junta todos los módulos: atrasados, hoy, por cobrar con mensaje y lo informativo al final', async () => {
    const d = datos(await dueno.herramienta('mi_dia_ver', {}));
    expect(d.fecha).toBe(HOY.dia);
    expect(d.fuentesConsultadas.filter((f: any) => f.incluida).map((f: any) => f.modulo).sort()).toEqual(['borradores', 'cotizador', 'crm', 'insumos', 'ordenes', 'produccion', 'registro']);
    const claves = d.grupos.map((g: any) => g.clave);
    expect(claves[0]).toBe('atrasado');
    expect(claves.at(-1)).toBe('mas_adelante');
    const atrasados = grupo(d, 'atrasado').map((t: any) => t.entidad.tipo);
    expect(atrasados).toEqual(expect.arrayContaining(['orden_trabajo', 'oportunidad']));
    const cobro = grupo(d, 'por_cobrar')[0];
    expect(cobro).toMatchObject({ grupo: 'cobro', montoCentimos: 420_000, cliente: { id: sol, telefono: '987654321' }, cobro: { diasMasAntiguo: 70, tramo31a60Centimos: 300_000, tramo61masCentimos: 120_000 } });
    expect(cobro.mensaje.texto).toContain('te saluda Gráfica Andina SAC.');
    expect(cobro.mensaje.texto).toContain('S/ 4,200.00');
    expect(cobro.mensaje.enlaceWhatsapp).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(d.resumen).toMatchObject({ porCobrarVencidoCentimos: 420_000, entregasAtrasadas: 1 });
    expect(grupo(d, 'mas_adelante').find((t: any) => t.entidad.tipo === 'articulo')?.detalle).toMatch(/^Sin existencias en .+ \(mínimo 10 /);
    // La orden sin adelanto ni deuda aprobada en Finanzas muestra el saldo que anotó la propia orden.
    expect(grupo(d, 'atrasado').find((t: any) => t.entidad.id === ordenAtrasada.id).notas).toContainEqual({ texto: 'Debe S/ 200.00', tono: 'aviso' });
    expect(tarjetas(d).some((t: any) => t.entidad.tipo === 'cotizacion')).toBe(true);
  });

  it('nada cancelado, anulado ni de otra empresa: ni tarjeta, ni cliente, ni monto', async () => {
    const d = datos(await dueno.herramienta('mi_dia_ver', {}));
    const ids = tarjetas(d).flatMap((t: any) => [t.entidad.id, t.cliente?.id]);
    for (const id of fuera) expect(ids).not.toContain(id);
    // La deuda anulada (S/ 500) y la de la otra empresa (S/ 700) no suman a lo vencido.
    expect(grupo(d, 'por_cobrar')).toHaveLength(1);
    expect(d.resumen.porCobrarVencidoCentimos).toBe(420_000);
  });

  it('el pedido listo cuya deuda ya está pagada dice «Pagado: ¿ya se entregó?» y no pide adelanto', async () => {
    const d = datos(await dueno.herramienta('mi_dia_ver', {}));
    const t = tarjetas(d).find((x: any) => x.entidad.id === pedidoPagado.id && x.grupo === 'entrega');
    expect(t.urgencia).toBe('hoy');
    expect(t.detalle).toContain('Pagado: ¿ya se entregó?');
    expect(t.acciones).toEqual([{ etiqueta: 'Ya se entregó', herramienta: 'pedido_cambiar_estado', args: { id: pedidoPagado.id, estado: 'entregado' } }]);
    expect(t.notas).toContainEqual({ texto: 'Pagado', tono: 'exito' });
    // Solo el pedido cuya deuda existe sin ningún pago aparece como «sin adelanto»; ni el pagado ni el que aún no tiene deuda.
    expect(tarjetas(d).filter((x: any) => x.grupo === 'adelanto').map((x: any) => x.entidad.id)).toEqual([pedidoSinAdelanto.id]);
    expect(t.detalle).toBe('Entrega hoy · Pagado: ¿ya se entregó?');
    expect(tarjetas(d).some((x: any) => x.entidad.id === pedidoSinDeuda.id)).toBe(false);
  });

  it('la acción de un clic cambia el estado de verdad y la tarjeta sale de la lista', async () => {
    const d = datos(await dueno.herramienta('mi_dia_ver', {}));
    const o = tarjetas(d).find((x: any) => x.entidad.id === ordenAtrasada.id);
    expect(o.acciones.map((a: any) => a.herramienta)).toEqual(['produccion_orden_estado', 'produccion_orden_estado']);
    await llamar(dueno, o.acciones[1].herramienta, o.acciones[1].args);
    expect(tarjetas(datos(await dueno.herramienta('mi_dia_ver', {}))).some((x: any) => x.entidad.id === ordenAtrasada.id)).toBe(false);
  });

  it('lo entregado con saldo aparece como «S/ X por aprobar» (borrador del sistema) en «por aprobar», sin aprobarse solo', async () => {
    const ped = await llamar(dueno, 'pedido_crear', { clienteId: sol, entregaEl: diaMas(40), lineas: [linea('Sobres', 80, 10)] });
    await llamar(dueno, 'pedido_confirmar', { id: ped.id });
    const deuda = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: sol, concepto: 'Sobres', totalCentimos: 80_000, origenTipo: 'pedido', origenId: ped.id });
    await llamar(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 20_000 });
    await llamar(dueno, 'pedido_cambiar_estado', { id: ped.id, estado: 'entregado' });
    futuro += 600_000;
    for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) break;
    const d = datos(await dueno.herramienta('mi_dia_ver', {}));
    const t = grupo(d, 'por_aprobar').find((x: any) => x.titulo === 'S/ 600.00 por aprobar');
    // La tarjeta lleva a la bandeja, que es donde se aprueba.
    expect(t).toMatchObject({ grupo: 'aprobacion', modulo: 'registro', entidad: { tipo: 'borrador' } });
    expect(t.acciones).toEqual([]);
    expect(d.resumen.porAprobar).toBeGreaterThanOrEqual(1);
    // Nada se cobró solo: la deuda sigue con su saldo.
    expect((await llamar(dueno, 'deuda_ver', { id: deuda.id })).abonadoCentimos).toBe(20_000);
  });

  it('quien solo ve pedidos en lectura recibe solo ese módulo, sin acciones, y los demás figuran sin acceso', async () => {
    const d = datos(await soloPedidos.herramienta('mi_dia_ver', {}));
    expect(tarjetas(d).every((t: any) => t.modulo === 'ordenes' || t.modulo === 'borradores')).toBe(true);
    expect(tarjetas(d).filter((t: any) => t.modulo === 'ordenes').every((t: any) => t.acciones.length === 0)).toBe(true);
    const incluidas = d.fuentesConsultadas.filter((f: any) => f.incluida).map((f: any) => f.modulo);
    expect(incluidas).toContain('ordenes');
    expect(d.fuentesConsultadas.filter((f: any) => !f.incluida).map((f: any) => f.modulo)).toEqual(expect.arrayContaining(['registro', 'produccion']));
  });

  it('con alcance «propios» en el cotizador no ve las cotizaciones de otra persona', async () => {
    const d = datos(await soloSusCotizaciones.herramienta('mi_dia_ver', {}));
    expect(d.fuentesConsultadas).toContainEqual({ modulo: 'cotizador', incluida: true, aviso: null });
    expect(tarjetas(d).some((t: any) => t.entidad.tipo === 'cotizacion')).toBe(false);
    expect(tarjetas(datos(await dueno.herramienta('mi_dia_ver', {}))).some((t: any) => t.entidad.tipo === 'cotizacion')).toBe(true);
  });

  it('cada `_pendientes` responde con su contrato por sí sola', async () => {
    for (const m of ['ordenes', 'produccion', 'registro', 'cotizador', 'insumos', 'crm']) {
      const r = datos(await dueno.herramienta(`${m}_pendientes`, { fecha: HOY.dia }));
      expect(r.fecha).toBe(HOY.dia);
      expect(r.tarjetas.length).toBeLessThanOrEqual(50);
      expect(r.total).toBeGreaterThanOrEqual(r.tarjetas.length);
    }
    expect(datos(await dueno.herramienta('registro_pendientes', {})).anotaciones.some((a: any) => a.pagado === true)).toBe(true);
  });

  it('un rechazo por argumentos inválidos', async () => {
    const r = await dueno.herramienta('mi_dia_ver', { fecha: '18/11/2026' });
    expect(r.cuerpo?.error?.codigo).toBe('argumentos_invalidos');
  });
});
