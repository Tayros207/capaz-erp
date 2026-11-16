import { describe, expect, it } from 'vitest';
import type { AccesoDeModulo, ModuloDeYo, MotivoDeAcceso, Yo } from '@capaz/shared';
import { avisoDeAccesoDenegado, itemDeModulo, menuDesdeYo, textoDeInsignia } from './menu.ts';

const acceso = (codigo: string, motivo: MotivoDeAcceso, extra: Partial<AccesoDeModulo> = {}): AccesoDeModulo => {
  const entra = ['activo', 'prueba', 'baja_solo_lectura', 'suspendido'].includes(motivo);
  return { codigo, motivo, visible: true, puedeEntrar: entra, puedeEscribir: motivo === 'activo' || motivo === 'prueba', nivel: entra ? 'completo' : null, alcance: 'todos', diasDePrueba: null, ...extra };
};

const modulo = (codigo: string, familia: ModuloDeYo['familia'], motivo: MotivoDeAcceso, extra: Partial<ModuloDeYo> = {}, ac: Partial<AccesoDeModulo> = {}): ModuloDeYo => ({
  codigo, nombre: codigo.toUpperCase(), descripcion: 'd', familia, orden: 0, acento: 'esmeralda', icono: codigo, enConstruccion: false, secciones: [], acceso: acceso(codigo, motivo, ac), ...extra,
});

const yoCon = (modulos: ModuloDeYo[]): Yo => ({
  usuario: { id: 'u', nombre: 'Ana', correo: 'a@b.pe' },
  empresa: { id: 'e', nombre: 'Imprenta', rol: 'admin' },
  empresas: [],
  puedeCrearEmpresas: false,
  modulos,
  permisos: [],
});

describe('menuDesdeYo', () => {
  it('trae núcleo y ajustes fijos', () => {
    const m = menuDesdeYo(yoCon([]));
    expect(m.nucleo.map((i) => i.nombre)).toEqual(['Inicio', 'Bandeja', 'Clientes', 'Productos']);
    expect(m.ajustes.map((i) => i.nombre)).toEqual(['Empresa', 'Usuarios', 'Sucursales', 'Conecta', 'Automatizaciones', 'Historial']);
  });

  it('muestra siempre las cinco familias clásicas, aunque estén vacías, y las demás solo con módulos', () => {
    expect(menuDesdeYo(yoCon([])).familias.map((f) => f.familia)).toEqual(['ventas', 'compras', 'inventario', 'finanzas', 'personal']);
    const con = menuDesdeYo(yoCon([modulo('webhooks', 'conexiones', 'activo')]));
    expect(con.familias.map((f) => f.familia)).toEqual(['ventas', 'compras', 'inventario', 'finanzas', 'personal', 'conexiones']);
    expect(con.familias.find((f) => f.familia === 'ventas')?.items).toEqual([]);
  });

  it('ordena dentro de la familia por orden y omite lo no visible', () => {
    const oculto = modulo('x', 'ventas', 'sin_asignar', {}, { visible: false });
    const m = menuDesdeYo(yoCon([modulo('b', 'ventas', 'activo', { orden: 2 }), modulo('a', 'ventas', 'activo', { orden: 1 }), oculto]));
    expect(m.familias[0]?.items.map((i) => i.clave)).toEqual(['modulo-a', 'modulo-b']);
  });
});

describe('itemDeModulo: los seis motivos y «en construcción»', () => {
  it('activo entra', () => {
    const i = itemDeModulo(modulo('registro', 'finanzas', 'activo'));
    expect(i).toMatchObject({ estado: 'entra', ruta: '/m/registro', accion: null, etiqueta: '' });
  });
  it('prueba entra y muestra los días', () => {
    const i = itemDeModulo(modulo('crm', 'ventas', 'prueba', {}, { diasDePrueba: 5 }));
    expect(i).toMatchObject({ estado: 'prueba', ruta: '/m/crm', etiqueta: 'Prueba · 5 días' });
    expect(itemDeModulo(modulo('crm', 'ventas', 'prueba', {}, { diasDePrueba: 1 })).etiqueta).toBe('Prueba · 1 día');
  });
  it('baja_solo_lectura y suspendido entran en solo lectura', () => {
    expect(itemDeModulo(modulo('a', 'ventas', 'baja_solo_lectura'))).toMatchObject({ estado: 'solo_lectura', ruta: '/m/a', etiqueta: 'Solo lectura' });
    expect(itemDeModulo(modulo('a', 'ventas', 'suspendido'))).toMatchObject({ estado: 'solo_lectura', ruta: '/m/a', etiqueta: 'Suspendido' });
  });
  it('no_contratado se bloquea con la acción «solicitar»', () => {
    expect(itemDeModulo(modulo('a', 'ventas', 'no_contratado'))).toMatchObject({ estado: 'bloqueado', ruta: null, accion: { tipo: 'solicitar', codigo: 'a' } });
  });
  it('sin_asignar se bloquea sin acción y pide acceso al administrador', () => {
    const i = itemDeModulo(modulo('a', 'ventas', 'sin_asignar'));
    expect(i).toMatchObject({ estado: 'bloqueado', ruta: null, accion: null });
    expect(i.nota).toMatch(/administrador/);
  });
  it('enConstruccion manda sobre el acceso: «Próximamente», sin acción ni ruta', () => {
    for (const motivo of ['activo', 'no_contratado', 'sin_asignar'] as const) {
      expect(itemDeModulo(modulo('a', 'ventas', motivo, { enConstruccion: true }))).toMatchObject({ estado: 'proximamente', etiqueta: 'Próximamente', ruta: null, accion: null });
    }
  });
});

describe('avisoDeAccesoDenegado', () => {
  const yo = yoCon([modulo('ok', 'ventas', 'activo'), modulo('no', 'ventas', 'no_contratado'), modulo('pronto', 'ventas', 'activo', { enConstruccion: true })]);
  it('deja pasar rutas que no son de módulo y módulos con acceso', () => {
    expect(avisoDeAccesoDenegado(yo, '/inicio')).toBeNull();
    expect(avisoDeAccesoDenegado(yo, '/m/ok/lista')).toBeNull();
  });
  it('avisa si no hay acceso, si no existe o si está en construcción', () => {
    expect(avisoDeAccesoDenegado(yo, '/m/no')).toMatch(/aún no tiene/);
    expect(avisoDeAccesoDenegado(yo, '/m/fantasma')).toMatch(/no existe/);
    expect(avisoDeAccesoDenegado(yo, '/m/pronto/x')).toMatch(/próximamente/);
  });
});

describe('textoDeInsignia', () => {
  it('vacío sin pendientes, el número, y 99+ para muchos', () => {
    expect(textoDeInsignia(0)).toBe('');
    expect(textoDeInsignia(1)).toBe('1');
    expect(textoDeInsignia(99)).toBe('99');
    expect(textoDeInsignia(100)).toBe('99+');
  });
});
