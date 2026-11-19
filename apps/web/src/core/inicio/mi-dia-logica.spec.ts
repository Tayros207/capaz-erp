import { describe, expect, it } from 'vitest';
import type { MiDiaDto, TarjetaDeMiDia } from '@capaz/shared';
import { avisosDeFuentes, avisoDeAccion, fechaLarga, sinTarjeta, textoDeResumen, TONO_DE_URGENCIA, TITULO_DE_GRUPO } from './mi-dia-logica.ts';

const t = (o: Partial<TarjetaDeMiDia> & { clave: string }): TarjetaDeMiDia => ({
  grupo: 'entrega', urgencia: 'hoy', titulo: 'T', detalle: 'D', fecha: null, montoCentimos: null, cliente: null, entidad: { tipo: 'pedido', id: o.clave, codigo: 'PED-1' },
  acciones: [], mensaje: null, cobro: null, modulo: 'ordenes', notas: [], ...o,
});
const panel = (tarjetas: TarjetaDeMiDia[]): MiDiaDto => ({
  fecha: '2026-11-18',
  resumen: { entregasDeHoy: 1, entregasAtrasadas: 1, porCobrarVencidoCentimos: 420_000, porAprobar: 1 },
  grupos: [{ clave: 'atrasado', tarjetas: tarjetas.filter((x) => x.urgencia === 'atrasado') }, { clave: 'hoy', tarjetas: tarjetas.filter((x) => x.urgencia === 'hoy') }, { clave: 'por_cobrar', tarjetas: tarjetas.filter((x) => x.grupo === 'cobro') }].filter((g) => g.tarjetas.length > 0) as MiDiaDto['grupos'],
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
    expect(Object.values(TITULO_DE_GRUPO)).toEqual(['Atrasado', 'Hoy', 'Mañana', 'Por cobrar', 'Por aprobar', 'Más adelante']);
  });
  it('avisos de módulos que no aportaron y confirmación de acción', () => {
    expect(avisosDeFuentes(panel([]))).toEqual(['Registro: sin acceso']);
    expect(avisoDeAccion('Ya se entregó', { entidad: { tipo: 'pedido', id: 'p', codigo: 'PED-1' } })).toBe('Listo: Ya se entregó · PED-1');
  });
});
