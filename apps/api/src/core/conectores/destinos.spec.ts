import { describe, expect, it } from 'vitest';
import { DestinoNoPermitido, direccionPublica, resolverDestino, validarUrl } from './destinos.js';

const resolverA = (...ips: string[]) => async () => ips;

describe('direcciones públicas', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '255.255.255.255', '198.18.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1', '2001:db8::1', '2002:0a00:0001::1', 'no-es-ip',
  ])('rechaza %s', (ip) => expect(direccionPublica(ip)).toBe(false));

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '203.0.114.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('acepta %s', (ip) =>
    expect(direccionPublica(ip)).toBe(true),
  );
});

describe('validación del destino', () => {
  it('solo https; http solo con el permiso de pruebas', () => {
    expect(() => validarUrl('http://ejemplo.com/x', false)).toThrow(DestinoNoPermitido);
    expect(() => validarUrl('ftp://ejemplo.com', false)).toThrow(DestinoNoPermitido);
    expect(() => validarUrl('file:///etc/passwd', true)).toThrow(DestinoNoPermitido);
    expect(validarUrl('http://127.0.0.1:9/x', true).hostname).toBe('127.0.0.1');
    expect(validarUrl('https://ejemplo.com/x', false).protocol).toBe('https:');
  });

  it('sin usuario ni contraseña y con una URL válida', () => {
    expect(() => validarUrl('https://u:p@ejemplo.com', false)).toThrow(/usuario/);
    expect(() => validarUrl('no es url', false)).toThrow(DestinoNoPermitido);
  });

  it('rechaza IP literales privadas, de metadatos y de bucle local', async () => {
    for (const u of ['https://127.0.0.1/', 'https://10.0.0.5/', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/', 'https://192.168.0.1:8443/']) {
      await expect(resolverDestino(u, { permitirLocales: false, resolver: resolverA() })).rejects.toThrow(DestinoNoPermitido);
    }
  });

  it('resuelve el nombre y rechaza si CUALQUIER dirección es privada (rebinding)', async () => {
    await expect(resolverDestino('https://malo.example/', { permitirLocales: false, resolver: resolverA('8.8.8.8', '10.0.0.1') })).rejects.toThrow(/privada/);
    await expect(resolverDestino('https://localhost/', { permitirLocales: false, resolver: resolverA('127.0.0.1') })).rejects.toThrow(DestinoNoPermitido);
    await expect(resolverDestino('https://nada.example/', { permitirLocales: false, resolver: async () => { throw new Error('x'); } })).rejects.toThrow(/resolver/);
  });

  it('un nombre público pasa y deja la dirección validada para conectarse', async () => {
    const d = await resolverDestino('https://api.ejemplo.com/hook', { permitirLocales: false, resolver: resolverA('93.184.216.34') });
    expect(d).toMatchObject({ direccion: '93.184.216.34', familia: 4 });
  });

  it('con el permiso de pruebas acepta destinos locales', async () => {
    const d = await resolverDestino('http://127.0.0.1:4000/', { permitirLocales: true });
    expect(d.direccion).toBe('127.0.0.1');
  });
});
