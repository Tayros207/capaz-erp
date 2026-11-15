import { describe, expect, it } from 'vitest';
import type { Invitacion, ListaDeMiembros, Miembro } from '@capaz/shared';
import {
  argumentosDeAsignacion,
  enlaceAbsoluto,
  estadoDeInvitacion,
  mensajeDeRechazo,
  nivelActual,
  puedeQuitar,
  resumenDeModulos,
  rolesAsignables,
  textoDeCupo,
  validarCorreo,
} from './logica.ts';

const miembro = (rol: string, id = 'p1', modulos: Miembro['modulos'] = []): Miembro => ({ personaId: id, nombre: 'Ana', correo: 'a@x.pe', rol, miembroDesde: '2026-11-10T10:00:00.000Z', modulos });

describe('roles y permisos de pantalla', () => {
  it('un propietario asigna cualquier rol; un admin no toca a un owner', () => {
    expect(rolesAsignables('owner', miembro('member'))).toEqual(['owner', 'admin', 'member']);
    expect(rolesAsignables('admin', miembro('member'))).toEqual(['admin', 'member']);
    expect(rolesAsignables('admin', miembro('owner'))).toEqual([]);
    expect(rolesAsignables('member', miembro('member'))).toEqual([]);
  });
  it('nadie se quita a sí mismo y un admin no quita a un owner', () => {
    expect(puedeQuitar('owner', miembro('member', 'p2'), 'p1')).toBe(true);
    expect(puedeQuitar('owner', miembro('member', 'p1'), 'p1')).toBe(false);
    expect(puedeQuitar('admin', miembro('owner', 'p2'), 'p1')).toBe(false);
    expect(puedeQuitar('member', miembro('member', 'p2'), 'p1')).toBe(false);
  });
});

describe('niveles por módulo', () => {
  const m = miembro('member', 'p1', [{ modulo: 'registro', nivel: 'lectura', alcance: 'propios' }]);
  it('lee el nivel asignado o sin_acceso', () => {
    expect(nivelActual(m, 'registro')).toBe('lectura');
    expect(nivelActual(m, 'crm')).toBe('sin_acceso');
  });
  it('el alcance solo viaja si hay acceso', () => {
    expect(argumentosDeAsignacion('p1', 'registro', 'completo', 'propios')).toEqual({ personaId: 'p1', modulo: 'registro', nivel: 'completo', alcance: 'propios' });
    expect(argumentosDeAsignacion('p1', 'registro', 'sin_acceso', 'propios')).toEqual({ personaId: 'p1', modulo: 'registro', nivel: 'sin_acceso' });
  });
  it('resume lo asignado', () => {
    const nombres = new Map([['registro', 'Registro']]);
    expect(resumenDeModulos(m, nombres)).toBe('Registro (lectura)');
    expect(resumenDeModulos(miembro('member'), nombres)).toBe('Sin módulos');
    expect(resumenDeModulos(miembro('admin'), nombres)).toBe('Todo lo contratado');
  });
});

describe('cupo', () => {
  const base: ListaDeMiembros = { miembros: [miembro('owner')], limiteDeUsuarios: null, invitacionesPendientes: 0 };
  it('sin tope y con tope', () => {
    expect(textoDeCupo(base)).toMatch(/sin tope/);
    expect(textoDeCupo({ ...base, limiteDeUsuarios: 3, invitacionesPendientes: 1 })).toMatch(/1 de 3 personas.*1 lugares libres/);
  });
});

describe('invitaciones', () => {
  it('valida el correo', () => {
    expect(validarCorreo('')).toMatch(/Escribe/);
    expect(validarCorreo('ana@')).toMatch(/válido/);
    expect(validarCorreo(' ana@x.pe ')).toBeUndefined();
  });
  it('arma el enlace absoluto sin barras dobles', () => {
    expect(enlaceAbsoluto('/invitacion/abc', 'https://capaz.pe')).toBe('https://capaz.pe/invitacion/abc');
    expect(enlaceAbsoluto('invitacion/abc', 'https://capaz.pe/')).toBe('https://capaz.pe/invitacion/abc');
  });
  it('distingue pendiente, vencida y anulada', () => {
    const i = { id: '1', correo: 'a@x.pe', rol: 'member', estado: 'pending', expiraEn: '', creadaEn: '', vencida: false, ruta: '/invitacion/1' } satisfies Invitacion;
    expect(estadoDeInvitacion(i).texto).toBe('Pendiente');
    expect(estadoDeInvitacion({ ...i, vencida: true }).texto).toBe('Vencida');
    expect(estadoDeInvitacion({ ...i, estado: 'canceled' }).texto).toBe('Anulada');
  });
});

describe('mensajeDeRechazo', () => {
  it('conserva el mensaje claro del servidor', () => {
    expect(mensajeDeRechazo('conflicto', 'No se puede quitar al último propietario.')).toBe('No se puede quitar al último propietario.');
    expect(mensajeDeRechazo('sin_conexion', '')).toMatch(/conexión/);
    expect(mensajeDeRechazo('error_interno', '')).toMatch(/No se pudo/);
  });
});
