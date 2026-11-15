import { describe, expect, it } from 'vitest';
import { interpretarInvitacion, mensajeDeRechazo, veredictoDeAceptar, type DetalleDeInvitacion } from './logica.ts';

const detalle: DetalleDeInvitacion = { id: 'i1', correo: 'Ana@X.pe', rol: 'member', estado: 'pending', empresa: 'Gráfica Sur', empresaId: 'e1', expiraEn: '2026-12-01T00:00:00.000Z' };
const AHORA = new Date('2026-11-15T00:00:00.000Z');

describe('interpretarInvitacion', () => {
  it('lee la respuesta de Better Auth', () => {
    expect(interpretarInvitacion({ id: 'i1', email: 'a@x.pe', role: 'admin', status: 'pending', organizationName: 'Gráfica Sur', organizationId: 'e1', expiresAt: '2026-12-01T00:00:00.000Z' }, 'zz')).toEqual({
      id: 'i1', correo: 'a@x.pe', rol: 'admin', estado: 'pending', empresa: 'Gráfica Sur', empresaId: 'e1', expiraEn: '2026-12-01T00:00:00.000Z',
    });
  });
  it('rechaza cuerpos que no son una invitación y usa el id de la ruta si falta', () => {
    expect(interpretarInvitacion(null, 'x')).toBeNull();
    expect(interpretarInvitacion({ foo: 1 }, 'x')).toBeNull();
    expect(interpretarInvitacion({ email: 'a@x.pe' }, 'x')?.id).toBe('x');
  });
});

describe('veredictoDeAceptar', () => {
  it('acepta una pendiente vigente, con o sin sesión', () => {
    expect(veredictoDeAceptar(detalle, 'ana@x.pe', AHORA)).toEqual({ puede: true });
    expect(veredictoDeAceptar(detalle, null, AHORA)).toEqual({ puede: true });
  });
  it('bloquea vencida, anulada, aceptada y correo distinto', () => {
    expect(veredictoDeAceptar({ ...detalle, expiraEn: '2026-11-01T00:00:00.000Z' }, null, AHORA)).toMatchObject({ puede: false, motivo: expect.stringMatching(/venció/) });
    expect(veredictoDeAceptar({ ...detalle, estado: 'canceled' }, null, AHORA)).toMatchObject({ puede: false });
    expect(veredictoDeAceptar({ ...detalle, estado: 'accepted' }, null, AHORA)).toMatchObject({ motivo: expect.stringMatching(/ya fue aceptada/) });
    expect(veredictoDeAceptar(detalle, 'otra@x.pe', AHORA)).toMatchObject({ puede: false, motivo: expect.stringMatching(/Ana@X\.pe/) });
  });
});

describe('mensajeDeRechazo', () => {
  it('traduce los códigos habituales', () => {
    expect(mensajeDeRechazo('no_autenticado', '')).toMatch(/Inicia sesión/);
    expect(mensajeDeRechazo('conflicto', 'Sin lugares.')).toBe('Sin lugares.');
  });
});
