import { describe, expect, it } from 'vitest';
import type { MiDiaDto, TarjetaDeMiDia } from '@capaz/shared';
import { avisosDeFuentes, avisoDeAccion, textoSinWhatsapp, enlaceDeWhatsapp, enLista, estaAlDia, fechaLarga, fuentesConFalla, fuentesRecortadas, hayMensajesDeCobro, sinTarjeta, textoDeResumen, TONO_DE_URGENCIA, TITULO_DE_GRUPO } from './mi-dia-logica.ts';

const t = (o: Partial<TarjetaDeMiDia> & { clave: string }): TarjetaDeMiDia => ({
  grupo: 'entrega', urgencia: 'hoy', titulo: 'T', detalle: 'D', fecha: null, montoCentimos: null, cliente: null, entidad: { tipo: 'pedido', id: o.clave, codigo: 'PED-1' },
  acciones: [], mensaje: null, cobro: null, modulo: 'ordenes', notas: [], ...o,
});
const panel = (tarjetas: TarjetaDeMiDia[]): MiDiaDto => ({
  fecha: '2026-11-18',
  resumen: { entregasDeHoy: 1, entregasAtrasadas: 1, porCobrarVencidoCentimos: 420_000, porAprobar: 1 },
  grupos: [{ clave: 'atrasado', tarjetas: tarjetas.filter((x) => x.urgencia === 'atrasado') }, { clave: 'hoy', tarjetas: tarjetas.filter((x) => x.urgencia === 'hoy') }, { clave: 'por_cobrar', tarjetas: tarjetas.filter((x) => x.grupo === 'cobro') }, { clave: 'por_llamar', tarjetas: tarjetas.filter((x) => x.grupo === 'recompra') }].filter((g) => g.tarjetas.length > 0) as MiDiaDto['grupos'],
  total: tarjetas.length,
  fuentesConsultadas: [{ modulo: 'ordenes', incluida: true, aviso: null }, { modulo: 'registro', incluida: false, aviso: 'sin acceso' }],
});

describe('textoDeResumen', () => {
  it('une lo que hay y omite lo que no', () => {
    expect(textoDeResumen({ entregasDeHoy: 3, entregasAtrasadas: 0, porCobrarVencidoCentimos: 420_000, porAprobar: 0 })).toBe('3 entregas hoy · S/ 4,200.00 por cobrar vencido');
    expect(textoDeResumen({ entregasDeHoy: 1, entregasAtrasadas: 2, porCobrarVencidoCentimos: 0, porAprobar: 1 })).toBe('2 entregas atrasadas · 1 entrega hoy · 1 por aprobar');
    expect(textoDeResumen({ entregasDeHoy: 0, entregasAtrasadas: 0, porCobrarVencidoCentimos: 0, porAprobar: 0 })).toBe('');
  });
});

describe('fechaLarga', () => {
  it('día de la semana, día y mes en español', () => {
    expect(fechaLarga('2026-11-18')).toBe('miércoles 18 de noviembre');
    expect(fechaLarga('2026-01-01')).toBe('jueves 1 de enero');
    expect(fechaLarga('mal')).toBe('mal');
  });
});

describe('sinTarjeta (actualización optimista)', () => {
  it('quita la tarjeta, el grupo que queda vacío y ajusta el resumen y el total', () => {
    const m = panel([t({ clave: 'a', urgencia: 'atrasado' }), t({ clave: 'b' }), t({ clave: 'c', grupo: 'cobro', urgencia: 'atrasado', montoCentimos: 420_000 })]);
    const r = sinTarjeta(m, 'b');
    expect(r.grupos.map((g) => g.clave)).toEqual(['atrasado', 'por_cobrar']);
    expect(r.resumen.entregasDeHoy).toBe(0);
    expect(r.total).toBe(2);
    expect(sinTarjeta(r, 'c').resumen.porCobrarVencidoCentimos).toBe(0);
    expect(sinTarjeta(m, 'no existe')).toBe(m);
    expect(m.total).toBe(3);
  });
});

describe('textos y colores', () => {
  it('cada urgencia tiene un tono semántico y cada grupo su título', () => {
    expect(TONO_DE_URGENCIA).toEqual({ atrasado: 'peligro', hoy: 'aviso', manana: 'info', pronto: 'neutro', info: 'neutro' });
    expect(Object.values(TITULO_DE_GRUPO)).toEqual(['Atrasado', 'Hoy', 'Mañana', 'Por cobrar', 'Clientes por llamar', 'Por aprobar', 'Más adelante']);
  });
  it('avisos de módulos sin acceso y confirmación de acción', () => {
    expect(avisosDeFuentes(panel([]))).toEqual(['Registro']);
    expect(avisoDeAccion('Ya se entregó', { entidad: { tipo: 'pedido', id: 'p', codigo: 'PED-1' } })).toBe('Anotado: ya se entregó · PED-1');
    expect(avisoDeAccion('Ya está listo', { entidad: { tipo: 'orden_trabajo', id: 'o', codigo: 'OT-2026-0005' } })).toBe('Anotado: ya está listo · OT-2026-0005');
    expect(enLista(['Registro'])).toBe('Registro');
    expect(enLista(['Pedidos', 'Registro', 'CRM'])).toBe('Pedidos, Registro y CRM');
  });
});

describe('módulos que fallan', () => {
  const vacio = (fuentes: MiDiaDto['fuentesConsultadas']): MiDiaDto => ({ ...panel([]), grupos: [], total: 0, fuentesConsultadas: fuentes });
  it('«todo al día» solo si no hay pendientes y ningún módulo falló; «sin acceso» no es una falla', () => {
    expect(estaAlDia(vacio([{ modulo: 'ordenes', incluida: true, aviso: null }, { modulo: 'crm', incluida: false, aviso: 'sin acceso' }]))).toBe(true);
    const conFalla = vacio([{ modulo: 'ordenes', incluida: true, aviso: null }, { modulo: 'registro', incluida: false, aviso: 'no se pudo consultar' }, { modulo: 'insumos', incluida: false, aviso: 'respuesta no válida' }]);
    expect(estaAlDia(conFalla)).toBe(false);
    expect(fuentesConFalla(conFalla)).toEqual(['Registro', 'Inventario']);
    expect(avisosDeFuentes(conFalla)).toEqual([]);
  });
  it('un módulo con más tarjetas que el tope se avisa (no es una falla)', () => {
    const recortado = vacio([{ modulo: 'ordenes', incluida: true, aviso: 'se muestran 50 de 1,234' }, { modulo: 'crm', incluida: true, aviso: null }]);
    expect(fuentesRecortadas(recortado)).toEqual(['Pedidos (se muestran 50 de 1,234)']);
    expect(fuentesConFalla(recortado)).toEqual([]);
  });
});

describe('WhatsApp y cobros', () => {
  it('solo se usa un enlace de wa.me; cualquier otra dirección se descarta', () => {
    const conEnlace = (enlaceWhatsapp: string | null) => ({ mensaje: { texto: 'Hola', enlaceWhatsapp } });
    expect(enlaceDeWhatsapp(conEnlace('https://wa.me/51987654321?text=Hola'))).toBe('https://wa.me/51987654321?text=Hola');
    expect(enlaceDeWhatsapp(conEnlace('javascript:alert(1)'))).toBeNull();
    expect(enlaceDeWhatsapp(conEnlace('https://wa.me.evil.com/51987654321?text=x'))).toBeNull();
    expect(enlaceDeWhatsapp(conEnlace(null))).toBeNull();
    expect(enlaceDeWhatsapp({ mensaje: null })).toBeNull();
  });
  it('hayMensajesDeCobro mira si alguna tarjeta trae mensaje', () => {
    expect(hayMensajesDeCobro(panel([t({ clave: 'a' })]))).toBe(false);
    expect(hayMensajesDeCobro(panel([t({ clave: 'c', grupo: 'cobro', urgencia: 'atrasado', mensaje: { texto: 'Hola', enlaceWhatsapp: null } })]))).toBe(true);
  });
  it('una tarjeta de recompra (cliente inventado) también cuenta como mensaje y su grupo tiene título', () => {
    const recompra = t({ clave: 'recompra:c1', grupo: 'recompra', urgencia: 'info', mensaje: { texto: 'Hola Cliente Demo', enlaceWhatsapp: 'https://wa.me/51987654321?text=Hola' } });
    expect(hayMensajesDeCobro(panel([recompra]))).toBe(true);
    expect(enlaceDeWhatsapp(recompra)).toBe('https://wa.me/51987654321?text=Hola');
    expect(TITULO_DE_GRUPO.por_llamar).toBe('Clientes por llamar');
  });
  it('sin enlace de WhatsApp, la recompra manda a agregar el teléfono en la ficha', () => {
    expect(textoSinWhatsapp('recompra')).toBe('Este cliente no tiene teléfono guardado: agrégalo en su ficha para abrir WhatsApp.');
    expect(textoSinWhatsapp('cobro')).toMatch(/celular válido/);
  });
});
