import { describe, expect, it } from 'vitest';
import { avisoDeErrores, avisoDeRecorte, diaLegible, mensajeDeImportacion, textoDeBotonImportar, textoDeMonto, textoDeRango, validarCorte, type LecturaDeHistorial } from './logica-historial.ts';

const lectura = (extra: Partial<LecturaDeHistorial> = {}): LecturaDeHistorial => ({
  total: 10, omitidasPorFecha: 1, erroresTotal: 0, duplicadasTotal: 0, clientesPorCrearTotal: 0, totalCentimos: 0, primeraFecha: null, ultimaFecha: null, ...extra,
});

describe('fecha de corte', () => {
  it('acepta un día real y rechaza el resto', () => {
    expect(validarCorte('2022-01-01')).toBeUndefined();
    expect(validarCorte('2024-02-29')).toBeUndefined();
    expect(validarCorte('')).toMatch(/completa/);
    expect(validarCorte('01/01/2022')).toMatch(/completa/);
    expect(validarCorte('2023-02-29')).toBe('Esa fecha no existe.');
    expect(validarCorte('2022-13-01')).toBe('Esa fecha no existe.');
  });
});

describe('textos', () => {
  it('días, rango y monto', () => {
    expect(diaLegible('2026-03-10')).toBe('10/03/2026');
    expect(diaLegible(null)).toBe('—');
    expect(textoDeRango(lectura({ primeraFecha: '2022-01-05', ultimaFecha: '2026-09-30' }))).toBe('05/01/2022 al 30/09/2026');
    expect(textoDeRango(lectura())).toBe('Sin fechas');
    expect(textoDeMonto(123450)).toBe('S/ 1,234.50');
  });
  it('el botón y los avisos concuerdan en número', () => {
    expect(textoDeBotonImportar(1)).toBe('Importar 1 trabajo');
    expect(textoDeBotonImportar(250)).toBe('Importar 250 trabajos');
    expect(avisoDeErrores(0)).toBeNull();
    expect(avisoDeErrores(1)).toMatch(/^1 fila tiene errores/);
    expect(avisoDeErrores(3)).toMatch(/^3 filas tienen errores/);
    expect(avisoDeRecorte(100, 100)).toBeNull();
    expect(avisoDeRecorte(100, 340)).toBe('Se muestran las primeras 100 de 340.');
  });
  it('el cierre cuenta trabajos y clientes', () => {
    expect(mensajeDeImportacion(lectura({ creadas: 1, clientesCreados: 0 }))).toBe('Se importó 1 trabajo.');
    expect(mensajeDeImportacion(lectura({ creadas: 5, clientesCreados: 2 }))).toBe('Se importaron 5 trabajos y se crearon 2 clientes.');
  });
});
