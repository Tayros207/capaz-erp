import { describe, expect, it } from 'vitest';
import type { Yo } from '@capaz/shared';
import { destinoSegunSesion, rutaSiguiente } from './guarda.ts';

const base: Yo = {
  usuario: { id: 'u1', nombre: 'Ana', correo: 'ana@ejemplo.pe' },
  empresa: null,
  empresas: [],
  puedeCrearEmpresas: true,
  modulos: [],
  permisos: [],
  operador: false,
};
const conEmpresa: Yo = { ...base, empresa: { id: 'e1', nombre: 'Gráfica Sur', rol: 'owner' } };

describe('destinoSegunSesion', () => {
  it('/restablecer-contrasena es pública con o sin sesión y con o sin empresa', () => {
    expect(destinoSegunSesion(null, '/restablecer-contrasena')).toBeNull();
    expect(destinoSegunSesion(base, '/restablecer-contrasena')).toBeNull();
    expect(destinoSegunSesion(conEmpresa, '/restablecer-contrasena')).toBeNull();
  });

  it('sin sesión: solo registro e inicio de sesión son públicos', () => {
    expect(destinoSegunSesion(null, '/inicio')).toBe('/iniciar-sesion');
    expect(destinoSegunSesion(null, '/')).toBe('/iniciar-sesion');
    expect(destinoSegunSesion(null, '/nueva-empresa')).toBe('/iniciar-sesion');
    expect(destinoSegunSesion(null, '/iniciar-sesion')).toBeNull();
    expect(destinoSegunSesion(null, '/registro')).toBeNull();
  });

  it('con sesión y sin empresa: todo va a /nueva-empresa', () => {
    expect(destinoSegunSesion(base, '/inicio')).toBe('/nueva-empresa');
    expect(destinoSegunSesion(base, '/iniciar-sesion')).toBe('/nueva-empresa');
    expect(destinoSegunSesion(base, '/nueva-empresa')).toBeNull();
  });

  it('operador sin empresa: entra a la consola y no se le obliga a crear una empresa', () => {
    const operador: Yo = { ...base, operador: true };
    expect(destinoSegunSesion(operador, '/plataforma')).toBeNull();
    expect(destinoSegunSesion(operador, '/plataforma/planes')).toBeNull();
    expect(destinoSegunSesion(operador, '/inicio')).toBe('/plataforma');
    expect(destinoSegunSesion(operador, '/')).toBe('/plataforma');
    expect(destinoSegunSesion(operador, '/nueva-empresa')).toBeNull();
  });

  it('con empresa: entra, y las pantallas de acceso llevan a /inicio', () => {
    expect(destinoSegunSesion(conEmpresa, '/clientes')).toBeNull();
    expect(destinoSegunSesion(conEmpresa, '/ajustes/usuarios')).toBeNull();
    expect(destinoSegunSesion(conEmpresa, '/')).toBe('/inicio');
    expect(destinoSegunSesion(conEmpresa, '/iniciar-sesion')).toBe('/inicio');
    expect(destinoSegunSesion(conEmpresa, '/registro')).toBe('/inicio');
    expect(destinoSegunSesion(conEmpresa, '/nueva-empresa')).toBe('/inicio');
  });

  it('ignora la barra final y no confunde prefijos parecidos', () => {
    expect(destinoSegunSesion(null, '/iniciar-sesion/')).toBeNull();
    expect(destinoSegunSesion(null, '/registro-otro')).toBe('/iniciar-sesion');
    expect(destinoSegunSesion(conEmpresa, '/registros')).toBeNull();
  });

  it('/kit siempre es accesible', () => {
    expect(destinoSegunSesion(null, '/kit')).toBeNull();
    expect(destinoSegunSesion(base, '/kit')).toBeNull();
    expect(destinoSegunSesion(conEmpresa, '/kit')).toBeNull();
  });
});

describe('invitaciones y ruta siguiente', () => {
  it('sin sesión, una invitación lleva a iniciar sesión recordando la ruta', () => {
    expect(destinoSegunSesion(null, '/invitacion/abc')).toBe('/iniciar-sesion?siguiente=%2Finvitacion%2Fabc');
  });
  it('rutaSiguiente solo acepta rutas internas', () => {
    expect(rutaSiguiente('?siguiente=%2Finvitacion%2Fabc')).toBe('/invitacion/abc');
    expect(rutaSiguiente('?siguiente=https%3A%2F%2Fmalo.com')).toBe('/');
    expect(rutaSiguiente('?siguiente=%2F%2Fmalo.com')).toBe('/');
    expect(rutaSiguiente('')).toBe('/');
  });
});
