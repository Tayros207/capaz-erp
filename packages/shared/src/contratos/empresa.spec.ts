import { describe, expect, it } from 'vitest';
import { actualizarConfiguracionSchema as esquema } from './empresa.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('actualizarConfiguracionSchema: datos de la empresa', () => {
  it('acepta cambios parciales, la cadena vacía y recorta espacios', () => {
    expect(esquema.safeParse({ ruc: '20123456789' }).success).toBe(true);
    expect(esquema.safeParse({ ruc: '', logoDataUrl: '', telefono: '' }).success).toBe(true);
    expect(esquema.parse({ razonSocial: '  Mi Empresa  ' })).toEqual({ razonSocial: 'Mi Empresa' });
    expect(esquema.safeParse({ logoDataUrl: PNG }).success).toBe(true);
  });
  it('rechaza RUC malo, logo SVG o externo, logo enorme, textos largos y llaves desconocidas', () => {
    expect(esquema.safeParse({ ruc: '1234567890' }).success).toBe(false);
    expect(esquema.safeParse({ logoDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }).success).toBe(false);
    expect(esquema.safeParse({ logoDataUrl: 'https://x.pe/a.png' }).success).toBe(false);
    expect(esquema.safeParse({ logoDataUrl: `data:image/png;base64,${'A'.repeat(150_000)}` }).success).toBe(false);
    expect(esquema.safeParse({ pieDeDocumento: 'x'.repeat(1001) }).success).toBe(false);
    expect(esquema.safeParse({ otro: 1 }).success).toBe(false);
    expect(esquema.safeParse({}).success).toBe(false);
  });
});

describe('actualizarConfiguracionSchema: monto mínimo', () => {
  it('acepta 0, un valor, el tope y null (vuelve al valor por defecto)', () => {
    expect(esquema.safeParse({ montoMinimoCentimos: 0 }).success).toBe(true);
    expect(esquema.safeParse({ montoMinimoCentimos: 3000 }).success).toBe(true);
    expect(esquema.safeParse({ montoMinimoCentimos: 10_000_000 }).success).toBe(true);
    expect(esquema.safeParse({ montoMinimoCentimos: null }).success).toBe(true);
  });
  it('rechaza negativos, pasarse del tope y decimales', () => {
    expect(esquema.safeParse({ montoMinimoCentimos: -1 }).success).toBe(false);
    expect(esquema.safeParse({ montoMinimoCentimos: 10_000_001 }).success).toBe(false);
    expect(esquema.safeParse({ montoMinimoCentimos: 12.5 }).success).toBe(false);
  });
});
