import { NotFoundException, PayloadTooLargeException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { respuestaSchema } from '@capaz/shared';
import { z } from 'zod';
import type { Logger } from 'pino';
import { ErrorDeNegocio } from './error-de-negocio.js';
import { FiltroDeErrores } from './filtro-de-errores.js';

function ejecutar(excepcion: unknown) {
  const logger = { error: vi.fn() };
  const salida: { estado?: number; cuerpo?: unknown } = {};
  const res = {
    status: (s: number) => ((salida.estado = s), res),
    json: (c: unknown) => void (salida.cuerpo = c),
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new FiltroDeErrores(logger as unknown as Logger).catch(excepcion, host);
  return { ...salida, logger };
}

describe('FiltroDeErrores', () => {
  it('traduce un 404 de la plataforma a no_encontrado', () => {
    const r = ejecutar(new NotFoundException('Cannot GET /api/nada'));
    expect(r.estado).toBe(404);
    expect(r.cuerpo).toMatchObject({ ok: false, error: { codigo: 'no_encontrado' } });
    expect(JSON.stringify(r.cuerpo)).not.toContain('Cannot GET');
  });

  it('traduce un cuerpo demasiado grande', () => {
    expect(ejecutar(new PayloadTooLargeException()).estado).toBe(413);
  });

  it('respeta el código de un error de negocio', () => {
    const r = ejecutar(new ErrorDeNegocio('sin_permiso'));
    expect(r.estado).toBe(403);
    expect(r.cuerpo).toMatchObject({ error: { codigo: 'sin_permiso' } });
  });

  it('oculta los detalles de un error inesperado y lo deja en los registros', () => {
    const r = ejecutar(new Error('fallo con la clave secreta-123 en la consulta'));
    expect(r.estado).toBe(500);
    expect(JSON.stringify(r.cuerpo)).not.toContain('secreta-123');
    expect(JSON.stringify(r.cuerpo)).not.toContain('consulta');
    expect(r.logger.error).toHaveBeenCalledOnce();
  });

  it('siempre responde con el contrato compartido', () => {
    const esquema = respuestaSchema(z.unknown());
    for (const e of [new NotFoundException(), new ErrorDeNegocio('conflicto'), new Error('x'), 'texto', null]) {
      expect(esquema.safeParse(ejecutar(e).cuerpo).success).toBe(true);
    }
  });
});
