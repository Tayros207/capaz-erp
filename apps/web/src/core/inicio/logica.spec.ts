import { describe, expect, it } from 'vitest';
import type { AccesoDeModulo, ModuloDeYo, Yo } from '@capaz/shared';
import { fechaEnZona, modulosConAlcanceTotal, rangoDelMes, tarjetasVisibles, textoDeBorradores, textoDeDeudasVencidas } from './logica.ts';

const modulo = (codigo: string, acceso: Partial<AccesoDeModulo> = {}): ModuloDeYo => ({
  codigo, nombre: codigo, descripcion: '', familia: 'finanzas' as ModuloDeYo['familia'], orden: 0, acento: 'esmeralda', icono: codigo, enConstruccion: false, secciones: [],
  acceso: { codigo, motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null, ...acceso },
});
const yoCon = (modulos: ModuloDeYo[], permisos: string[] = ['borradores:ver']): Yo => ({
  usuario: { id: 'u', nombre: 'Ana', correo: 'a@b.pe' }, empresa: { id: 'e', nombre: 'Imprenta', rol: 'admin' }, empresas: [], puedeCrearEmpresas: false, modulos, permisos,
});

describe('tarjetas de pendientes', () => {
  it('muestra una por módulo con alcance todos, en orden', () => {
    expect(tarjetasVisibles(yoCon([modulo('registro'), modulo('crm'), modulo('ordenes')]))).toEqual(['borradores', 'deudas', 'entregas', 'actividades']);
  });
  it('oculta las de alcance propios, sin entrada o sin permiso', () => {
    const yo = yoCon([modulo('registro', { alcance: 'propios' }), modulo('crm', { puedeEntrar: false, motivo: 'sin_asignar' }), modulo('ordenes')], []);
    expect(tarjetasVisibles(yo)).toEqual(['entregas']);
    expect([...modulosConAlcanceTotal(yo)]).toEqual(['ordenes']);
  });
});

describe('fechas y textos', () => {
  it('rango del mes, también en febrero bisiesto', () => {
    expect(rangoDelMes('2026-11-15')).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
    expect(rangoDelMes('2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });
  it('la fecha depende de la zona', () => {
    expect(fechaEnZona(new Date('2026-11-16T03:00:00Z'), 'America/Lima')).toBe('2026-11-15');
  });
  it('singular y plural', () => {
    expect(textoDeBorradores(1)).toBe('1 borrador por aprobar');
    expect(textoDeBorradores(3)).toBe('3 borradores por aprobar');
    expect(textoDeDeudasVencidas(0)).toBe('Ninguna vencida');
  });
});
