import { describe, expect, it } from 'vitest';
import {
  diasHasta, estadoDeEmpresa, busquedaDesdeFiltro, filtrarEmpresas, filtroDesdeBusqueda, FILTRO_VACIO, ordenarEmpresas, inicialesDeEmpresa, kpisDeEmpresas, modulosPresentes, nombreDeModulo,
  proximoVencimiento, textoDeVencimiento, type EmpresaResumen,
} from './logica.ts';

const AHORA = new Date('2026-11-16T12:00:00.000Z');
const en = (dias: number) => new Date(AHORA.getTime() + dias * 86_400_000).toISOString();
const m = (modulo: string, estado: 'prueba' | 'activo' | 'suspendido' | 'baja', pruebaHasta: string | null = null, vigenteHasta: string | null = null) => ({ modulo, estado, pruebaHasta, vigenteHasta });
const emp = (id: string, nombre: string, modulos: EmpresaResumen['modulos'], miembros = 2): EmpresaResumen => ({ id, nombre, altaEn: '2026-10-01T00:00:00.000Z', miembros, modulos });

describe('nombres de módulo', () => {
  it('traduce los códigos conocidos y capitaliza los desconocidos', () => {
    expect(nombreDeModulo('ordenes')).toBe('Pedidos');
    expect(nombreDeModulo('insumos')).toBe('Inventario');
    expect(nombreDeModulo('rutas')).toBe('Rutas');
  });
});

describe('estadoDeEmpresa', () => {
  it('deduce el estado de los módulos', () => {
    expect(estadoDeEmpresa(emp('a', 'A', []))).toBe('sin_modulos');
    expect(estadoDeEmpresa(emp('a', 'A', [m('crm', 'baja'), m('registro', 'baja')]))).toBe('baja');
    expect(estadoDeEmpresa(emp('a', 'A', [m('crm', 'activo'), m('registro', 'suspendido')]))).toBe('suspendida');
    expect(estadoDeEmpresa(emp('a', 'A', [m('crm', 'activo'), m('registro', 'baja')]))).toBe('activa');
    expect(estadoDeEmpresa(emp('a', 'A', [m('crm', 'prueba', en(5))]))).toBe('prueba');
  });
});

describe('vencimientos', () => {
  it('cuenta días hacia arriba y acepta pasados', () => {
    expect(diasHasta(en(3), AHORA)).toBe(3);
    expect(diasHasta(en(-2), AHORA)).toBe(-2);
    expect(diasHasta(null, AHORA)).toBeNull();
    expect(diasHasta('no es fecha', AHORA)).toBeNull();
  });
  it('elige el más cercano e ignora los módulos de baja', () => {
    const e = emp('a', 'A', [m('crm', 'prueba', en(10)), m('registro', 'activo', null, en(4)), m('compras', 'baja', null, en(1))]);
    expect(proximoVencimiento(e, AHORA)).toEqual({ modulo: 'registro', dias: 4, tipo: 'vigencia' });
    expect(proximoVencimiento(emp('b', 'B', [m('crm', 'activo')]), AHORA)).toBeNull();
  });
  it('redacta el texto', () => {
    expect(textoDeVencimiento(0)).toBe('Vence hoy');
    expect(textoDeVencimiento(1)).toBe('Vence en 1 día');
    expect(textoDeVencimiento(5)).toBe('Vence en 5 días');
    expect(textoDeVencimiento(-1)).toBe('Venció hace 1 día');
    expect(textoDeVencimiento(-3)).toBe('Venció hace 3 días');
  });
});

describe('kpisDeEmpresas', () => {
  it('resume la cartera', () => {
    const lista = [
      emp('1', 'Uno', [m('crm', 'activo')], 3),
      emp('2', 'Dos', [m('crm', 'prueba', en(3))], 1),
      emp('3', 'Tres', [m('crm', 'suspendido')], 2),
      emp('4', 'Cuatro', [m('crm', 'baja')], 0),
      emp('5', 'Cinco', [], 1),
    ];
    expect(kpisDeEmpresas(lista, AHORA, 4)).toEqual({ total: 5, activas: 1, enPrueba: 1, conProblema: 2, vencenPronto: 1, solicitudes: 4, miembros: 7 });
  });
});

describe('filtrarEmpresas', () => {
  const lista = [
    emp('e-1', 'Gráfica Andina', [m('ordenes', 'activo'), m('registro', 'activo')]),
    emp('e-2', 'Café Qori', [m('personal', 'baja'), m('registro', 'prueba', en(5))]),
    emp('e-3', 'Ferretería Pacífico', [m('ordenes', 'suspendido')]),
  ];
  it('busca por nombre sin tildes ni mayúsculas', () => {
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, texto: 'grafica' }).map((e) => e.id)).toEqual(['e-1']);
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, texto: 'CAFE' }).map((e) => e.id)).toEqual(['e-2']);
  });
  it('busca por código y por nombre legible de módulo', () => {
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, texto: 'ordenes' }).map((e) => e.id)).toEqual(['e-1', 'e-3']);
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, texto: 'pedidos' }).map((e) => e.id)).toEqual(['e-1', 'e-3']);
  });
  it('filtra por estado y por módulo contratado (la baja no cuenta)', () => {
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, estado: 'suspendida' }).map((e) => e.id)).toEqual(['e-3']);
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, modulo: 'personal' })).toEqual([]);
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, modulo: 'registro' }).map((e) => e.id)).toEqual(['e-1', 'e-2']);
  });
  it('lista los módulos presentes', () => {
    expect(modulosPresentes(lista)).toEqual(['ordenes', 'personal', 'registro']);
  });
});

describe('filtrar por vencimiento', () => {
  it('deja solo las que vencen dentro de la ventana (o ya vencidas)', () => {
    const lista = [emp('a', 'A', [m('crm', 'prueba', en(3))]), emp('b', 'B', [m('crm', 'prueba', en(30))]), emp('c', 'C', [m('crm', 'activo')])];
    expect(filtrarEmpresas(lista, { ...FILTRO_VACIO, vencenEn: 7 }, AHORA).map((e) => e.id)).toEqual(['a']);
  });
});

describe('ordenarEmpresas', () => {
  const lista = [
    emp('1', 'Zeta', [m('crm', 'activo')], 5),
    emp('2', 'Álamo', [m('crm', 'prueba', en(2))], 1),
    emp('3', 'Beta', [m('crm', 'baja')], 3),
    emp('4', 'Gama', [m('crm', 'activo', null, en(9))], 2),
  ];
  const ids = (o: Parameters<typeof ordenarEmpresas>[1]) => ordenarEmpresas(lista, o, AHORA).map((e) => e.id);
  it('por nombre sin tildes', () => expect(ids({ clave: 'nombre', direccion: 'asc' })).toEqual(['2', '3', '4', '1']));
  it('por miembros', () => expect(ids({ clave: 'miembros', direccion: 'desc' })).toEqual(['1', '3', '4', '2']));
  it('por estado: lo más grave primero', () => expect(ids({ clave: 'estado', direccion: 'asc' })).toEqual(['3', '2', '4', '1']));
  it('por vencimiento: lo más próximo primero y sin vencimiento al final, también al invertir', () => {
    expect(ids({ clave: 'vence', direccion: 'asc' })).toEqual(['2', '4', '3', '1']);
    expect(ids({ clave: 'vence', direccion: 'desc' }).slice(0, 2)).toEqual(['4', '2']);
  });
});

describe('filtro en la dirección', () => {
  it('ida y vuelta', () => {
    const f = { texto: 'ana', estado: 'prueba' as const, modulo: 'crm', vencenEn: 7 };
    expect(filtroDesdeBusqueda(busquedaDesdeFiltro(f))).toEqual(f);
    expect(busquedaDesdeFiltro(FILTRO_VACIO).toString()).toBe('');
  });
  it('ignora valores inválidos', () => {
    expect(filtroDesdeBusqueda(new URLSearchParams('estado=otro&vence=abc&modulo='))).toEqual(FILTRO_VACIO);
  });
});

describe('inicialesDeEmpresa', () => {
  it('toma dos iniciales', () => {
    expect(inicialesDeEmpresa('Gráfica Andina')).toBe('GA');
    expect(inicialesDeEmpresa('Café')).toBe('C');
    expect(inicialesDeEmpresa('  ')).toBe('?');
  });
});
