import { describe, expect, it } from 'vitest';
import { AJUSTES, NUCLEO, itemDeModulo } from './menu.ts';
import { migasDeRuta } from './migas.ts';

const menu = {
  nucleo: [...NUCLEO],
  ajustes: [...AJUSTES],
  familias: [{
    familia: 'finanzas' as const, nombre: 'Finanzas',
    items: [itemDeModulo({ codigo: 'registro', nombre: 'Registro', descripcion: 'd', familia: 'finanzas', orden: 0, acento: 'esmeralda', icono: 'registro', enConstruccion: false, secciones: [], acceso: { codigo: 'registro', motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null } })],
  }],
};

describe('migasDeRuta', () => {
  it('núcleo, ajustes y módulos', () => {
    expect(migasDeRuta(menu, '/clientes/nuevo')).toEqual(['Clientes']);
    expect(migasDeRuta(menu, '/ajustes/empresa')).toEqual(['Ajustes', 'Empresa']);
    expect(migasDeRuta(menu, '/m/registro/movimientos')).toEqual(['Finanzas', 'Registro']);
    expect(migasDeRuta(menu, '/otra')).toEqual([]);
  });
});
