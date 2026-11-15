import { describe, expect, it } from 'vitest';
import { hayCupo, invitacionVigente, limiteDeUsuarios, puedeCambiarRol, puedeInvitarCon, puedeQuitar } from './reglas.js';

const owner = { usuarioId: 'o1', rol: 'owner' };
const owner2 = { usuarioId: 'o2', rol: 'owner' };
const admin = { usuarioId: 'a1', rol: 'admin' };
const miembro = { usuarioId: 'm1', rol: 'member' };

describe('limiteDeUsuarios y hayCupo (max_usuarios)', () => {
  it('toma el menor tope de los módulos vigentes e ignora las bajas', () => {
    expect(limiteDeUsuarios([{ estado: 'activo', maxUsuarios: 5 }, { estado: 'prueba', maxUsuarios: 3 }, { estado: 'baja', maxUsuarios: 1 }])).toBe(3);
    expect(limiteDeUsuarios([{ estado: 'activo', maxUsuarios: null }])).toBeNull();
    expect(limiteDeUsuarios([])).toBeNull();
  });
  it('cuenta miembros e invitaciones pendientes contra el tope', () => {
    expect(hayCupo({ limite: null, miembros: 99, invitacionesPendientes: 9 }).ok).toBe(true);
    expect(hayCupo({ limite: 3, miembros: 2, invitacionesPendientes: 0 }).ok).toBe(true);
    expect(hayCupo({ limite: 3, miembros: 2, invitacionesPendientes: 1 })).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(hayCupo({ limite: 3, miembros: 3, invitacionesPendientes: 0 }).ok).toBe(false);
  });
});

describe('puedeQuitar', () => {
  it('un propietario quita a un miembro o a otro propietario si queda alguno', () => {
    expect(puedeQuitar({ actor: owner, objetivo: miembro, propietarios: 1 }).ok).toBe(true);
    expect(puedeQuitar({ actor: owner, objetivo: owner2, propietarios: 2 }).ok).toBe(true);
  });
  it('nunca al último propietario (ni a sí mismo)', () => {
    expect(puedeQuitar({ actor: owner, objetivo: owner, propietarios: 1 })).toMatchObject({ ok: false, codigo: 'conflicto' });
  });
  it('un administrador no quita a un propietario, pero sí a un miembro', () => {
    expect(puedeQuitar({ actor: admin, objetivo: owner, propietarios: 2 })).toMatchObject({ ok: false, codigo: 'sin_permiso' });
    expect(puedeQuitar({ actor: admin, objetivo: miembro, propietarios: 1 }).ok).toBe(true);
  });
  it('un miembro no quita a nadie', () => {
    expect(puedeQuitar({ actor: miembro, objetivo: admin, propietarios: 1 })).toMatchObject({ ok: false, codigo: 'sin_permiso' });
  });
});

describe('puedeCambiarRol', () => {
  it('no degrada al último propietario, sí si hay otro', () => {
    expect(puedeCambiarRol({ actor: owner, objetivo: owner, nuevoRol: 'admin', propietarios: 1 })).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(puedeCambiarRol({ actor: owner, objetivo: owner, nuevoRol: 'admin', propietarios: 2 }).ok).toBe(true);
  });
  it('un administrador no cambia a un propietario ni nombra propietarios', () => {
    expect(puedeCambiarRol({ actor: admin, objetivo: owner, nuevoRol: 'member', propietarios: 2 })).toMatchObject({ ok: false, codigo: 'sin_permiso' });
    expect(puedeCambiarRol({ actor: admin, objetivo: miembro, nuevoRol: 'owner', propietarios: 1 })).toMatchObject({ ok: false, codigo: 'sin_permiso' });
    expect(puedeCambiarRol({ actor: admin, objetivo: miembro, nuevoRol: 'admin', propietarios: 1 }).ok).toBe(true);
  });
  it('rechaza el cambio al mismo rol y a quien no administra', () => {
    expect(puedeCambiarRol({ actor: owner, objetivo: miembro, nuevoRol: 'member', propietarios: 1 })).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(puedeCambiarRol({ actor: miembro, objetivo: miembro, nuevoRol: 'admin', propietarios: 1 })).toMatchObject({ ok: false, codigo: 'sin_permiso' });
  });
});

describe('puedeInvitarCon', () => {
  it('owner y admin invitan como admin o member; nunca como owner', () => {
    expect(puedeInvitarCon({ actor: owner, rol: 'member' }).ok).toBe(true);
    expect(puedeInvitarCon({ actor: admin, rol: 'admin' }).ok).toBe(true);
    expect(puedeInvitarCon({ actor: owner, rol: 'owner' }).ok).toBe(false);
    expect(puedeInvitarCon({ actor: miembro, rol: 'member' })).toMatchObject({ ok: false, codigo: 'sin_permiso' });
  });
});

describe('invitacionVigente', () => {
  const ahora = new Date('2026-11-15T12:00:00Z');
  const base = { organizationId: 'A', status: 'pending', expiresAt: new Date('2026-11-17T12:00:00Z') };
  it('vale pendiente, de la misma empresa y sin vencer', () => {
    expect(invitacionVigente({ invitacion: base, empresaId: 'A', ahora }).ok).toBe(true);
  });
  it('no vale en otra empresa, anulada ni vencida', () => {
    expect(invitacionVigente({ invitacion: base, empresaId: 'B', ahora })).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    expect(invitacionVigente({ invitacion: { ...base, status: 'canceled' }, empresaId: 'A', ahora })).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(invitacionVigente({ invitacion: { ...base, expiresAt: '2026-11-14T00:00:00Z' }, empresaId: 'A', ahora })).toMatchObject({ ok: false, codigo: 'conflicto' });
  });
});
