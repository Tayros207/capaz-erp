import { describe, expect, it, vi } from 'vitest';
import { configuracionDeEmpresaSchema } from '@capaz/shared';
import { enviarHerramienta } from './transporte.ts';

const salida = configuracionDeEmpresaSchema;
const datos = { zonaHoraria: 'America/Lima', moneda: 'PEN', locale: 'es-PE', razonSocial: null, ruc: null, direccionFiscal: null, telefono: null, correo: null, pieDeDocumento: null, logoDataUrl: null, actualizadoEn: '2026-11-15T10:00:00.000Z' };
const json = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));

describe('enviarHerramienta', () => {
  it('manda args, confirmación y la clave de idempotencia a la ruta de la herramienta', async () => {
    const enviar = vi.fn(() => json({ ok: true, datos, avisos: [] }));
    const r = await enviarHerramienta('empresa_ver_configuracion', { a: 1 }, 'tok', 'k-1', salida, enviar as never);
    expect(r).toEqual({ ok: true, datos, avisos: [] });
    const llamada = (enviar.mock.calls[0] as unknown) as [string, RequestInit];
    expect(llamada[0]).toBe('/api/v1/herramientas/empresa_ver_configuracion');
    expect(llamada[1].method).toBe('POST');
    expect((llamada[1].headers as Record<string, string>)['idempotency-key']).toBe('k-1');
    expect(JSON.parse(llamada[1].body as string)).toEqual({ args: { a: 1 }, confirmacion: 'tok' });
  });

  it('respeta el rechazo del servidor aunque el estado HTTP no sea 200', async () => {
    const enviar = vi.fn(() => json({ ok: false, error: { codigo: 'sin_permiso', mensaje: 'No puedes.' } }, 403));
    const r = await enviarHerramienta('x', undefined, undefined, 'k', salida, enviar as never);
    expect(r).toEqual({ ok: false, error: { codigo: 'sin_permiso', mensaje: 'No puedes.' } });
  });

  it('una caída de red es el rechazo sin_conexion, no una excepción', async () => {
    const enviar = vi.fn(() => Promise.reject(new TypeError('red')));
    const r = await enviarHerramienta('x', undefined, undefined, 'k', salida, enviar as never);
    expect(r).toMatchObject({ ok: false, error: { codigo: 'sin_conexion' } });
  });
});
