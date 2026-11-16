import { describe, expect, it } from 'vitest';
import { accionesRapidas, normalizar } from './paleta-logica.ts';

describe('paleta de comandos', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalizar('  Cotización Ñandú ')).toBe('cotizacion nandu');
  });
  it('solo ofrece accesos de módulos que el menú trae', () => {
    expect(accionesRapidas(['/inicio', '/clientes'])).toEqual([]);
    const r = accionesRapidas(['/m/ordenes']).map((a) => a.ruta);
    expect(r).toContain('/m/ordenes/nuevo');
    expect(r.some((x) => x.startsWith('/m/registro'))).toBe(false);
  });
});
