import { describe, expect, it } from 'vitest';
import type { Centimos, SemanaRevisadaDto } from '@capaz/shared';
import {
  argumentosDeCierre, avisoDeMovimientosPosteriores, diferenciaDeConteo, etiquetaDeConteo, semanaQueTocaCerrar, textoDeAjusteAnterior, esLaSemanaDeHoy, faltanParaExplicar, motivoParaNoContar, moverSemana, resumenDeDiferencias, semanaDeHoy,
  textoDeCambioDesdeElCierre, textoDeDiferencia, textoDeSemana, validarConteos,
} from './logica-cierre.ts';

const c = (n: number) => n as Centimos;
const cuenta = (id: string, nombre: string, sistemaCentimos: number): SemanaRevisadaDto['cuentas'][number] => ({
  cuentaId: id, nombre, tipo: 'caja', saldoInicialCentimos: 0, ingresosCentimos: 0, egresosCentimos: 0, transferenciasNetasCentimos: 0, sistemaCentimos, movimientosPosterioresCentimos: 0, movimientos: 0,
});
const cuentas = [cuenta('a', 'Caja chica', 10_000), cuenta('b', 'Cuenta de prueba', 50_000)];

describe('semanas', () => {
  it('lunes a sábado; el domingo cuenta la semana que terminó', () => {
    expect(semanaDeHoy('2026-11-18')).toBe('2026-11-16'); // miércoles
    expect(semanaDeHoy('2026-11-22')).toBe('2026-11-16'); // domingo
    expect(semanaDeHoy('2026-11-23')).toBe('2026-11-23'); // lunes
    expect(esLaSemanaDeHoy('2026-11-16', '2026-11-20')).toBe(true);
  });
  it('la semana que toca cerrar: desde el sábado la en curso, de lunes a viernes la anterior', () => {
    expect(semanaQueTocaCerrar('2026-11-23')).toBe('2026-11-16'); // lunes
    expect(semanaQueTocaCerrar('2026-11-20')).toBe('2026-11-09'); // viernes
    expect(semanaQueTocaCerrar('2026-11-21')).toBe('2026-11-16'); // sábado
    expect(semanaQueTocaCerrar('2026-11-22')).toBe('2026-11-16'); // domingo
    expect(semanaQueTocaCerrar('2026-12-01')).toBe('2026-11-23'); // martes, cambio de mes
    expect(semanaQueTocaCerrar('2027-01-01')).toBe('2026-12-21'); // viernes, cambio de año
  });
  it('la etiqueta del conteo nombra el sábado', () => {
    expect(etiquetaDeConteo('2026-11-21')).toBe('Saldo al cierre del sábado 21/11');
  });
  it('avisa de movimientos posteriores al sábado solo si los hay, con signo claro', () => {
    expect(avisoDeMovimientosPosteriores(0)).toBeNull();
    expect(avisoDeMovimientosPosteriores(5_000)).toMatch(/\+S\/ 50\.00/);
    expect(avisoDeMovimientosPosteriores(-5_000)).toMatch(/−S\/ 50\.00/);
  });
  it('frase de un ajuste posterior a un cierre', () => {
    const t = textoDeAjusteAnterior({ cuentaId: 'a', nombre: 'Caja chica', contadoDelCierreCentimos: 10_000, saldoInicialCentimos: 12_000, diferenciaCentimos: 2_000 });
    expect(t).toBe('Caja chica: contaste S/ 100.00 y ahora la cuenta empieza en S/ 120.00 (diferencia +S/ 20.00).');
  });
  it('se mueve de semana en semana', () => {
    expect(moverSemana('2026-11-16', -1)).toBe('2026-11-09');
    expect(moverSemana('2026-11-16', 1)).toBe('2026-11-23');
    expect(moverSemana('2026-12-28', 1)).toBe('2027-01-04');
  });
  it('texto del rango', () => {
    expect(textoDeSemana('2026-11-16', '2026-11-21')).toBe('16/11 al 21/11/2026');
  });
  it('explica por qué no se puede contar', () => {
    expect(motivoParaNoContar('futura', '2026-11-28')).toMatch(/todavía no empieza/);
    expect(motivoParaNoContar('en_curso', '2026-11-21')).toBe('Esta semana termina el sábado 21/11/2026: ciérrala ese día o después.');
    expect(motivoParaNoContar('cerrada', '2026-11-21')).toMatch(/ya está cerrada/);
    expect(motivoParaNoContar('por_cerrar', '2026-11-21')).toBeNull();
  });
});

describe('diferencias', () => {
  it('contado menos sistema; sin contar es nulo', () => {
    expect(diferenciaDeConteo(10_000, c(9_500))).toBe(-500);
    expect(diferenciaDeConteo(10_000, c(10_000))).toBe(0);
    expect(diferenciaDeConteo(10_000, null)).toBeNull();
    expect(diferenciaDeConteo(10_000, undefined)).toBeNull();
  });
  it('texto con faltan, sobran o cuadra', () => {
    expect(textoDeDiferencia(-500)).toBe('Faltan S/ 5.00');
    expect(textoDeDiferencia(1_250)).toBe('Sobran S/ 12.50');
    expect(textoDeDiferencia(0)).toBe('Cuadra');
  });
  it('resume cuentas sin cuadrar y su suma con signo', () => {
    expect(resumenDeDiferencias(cuentas, { a: c(9_000), b: c(50_500) })).toEqual({ sinCuadrar: 2, totalCentimos: -500 });
    expect(resumenDeDiferencias(cuentas, { a: c(10_000), b: null })).toEqual({ sinCuadrar: 0, totalCentimos: 0 });
  });
});

describe('explicación mínima', () => {
  it('cuenta sin los espacios de los extremos: 14 no alcanza, 15 sí', () => {
    expect(faltanParaExplicar('  12345678901234  ')).toBe(1);
    expect(faltanParaExplicar('123456789012345')).toBe(0);
    expect(faltanParaExplicar('')).toBe(15);
  });
});

describe('validarConteos', () => {
  it('pide contar todas las cuentas', () => {
    expect(validarConteos(cuentas, { a: c(10_000) }, {})).toEqual({ b: { conteo: 'Escribe lo que contaste en «Cuenta de prueba».' } });
  });
  it('una diferencia pide explicación de al menos 15 caracteres', () => {
    const e = validarConteos(cuentas, { a: c(9_000), b: c(50_000) }, { a: 'corta' });
    expect(e.a?.explicacion).toBe('Explica por qué «Caja chica» no cuadra (Faltan S/ 10.00): al menos 15 caracteres.');
    expect(validarConteos(cuentas, { a: c(9_000), b: c(50_000) }, { a: 'Se pagó una movilidad sin anotar' })).toEqual({});
  });
  it('lo que cuadra no pide explicación', () => {
    expect(validarConteos(cuentas, { a: c(10_000), b: c(50_000) }, {})).toEqual({});
  });
});

describe('argumentosDeCierre', () => {
  it('la explicación solo viaja donde hay diferencia y las notas vacías no viajan', () => {
    const args = argumentosDeCierre('2026-11-16', cuentas, { a: c(9_000), b: c(50_000) }, { a: ' Faltó anotar la movilidad ', b: 'texto que sobra' }, '  ');
    expect(args).toEqual({
      desde: '2026-11-16',
      conteos: [{ cuentaId: 'a', contadoCentimos: 9_000, explicacion: 'Faltó anotar la movilidad' }, { cuentaId: 'b', contadoCentimos: 50_000 }],
    });
  });
  it('con notas las recorta; sin contar una cuenta no arma nada', () => {
    expect(argumentosDeCierre('2026-11-16', [cuentas[0]!], { a: c(10_000) }, {}, ' ok ').notas).toBe('ok');
    expect(() => argumentosDeCierre('2026-11-16', cuentas, { a: c(10_000) }, {}, '')).toThrow(/Falta lo contado/);
  });
});

describe('cambios desde el cierre', () => {
  it('dice lo contado y lo que el sistema marca hoy', () => {
    expect(textoDeCambioDesdeElCierre({ cuentaId: 'a', nombre: 'Caja chica', contadoCentimos: 10_000, sistemaCentimos: 12_000 })).toBe(
      'Caja chica: al cerrar contaste S/ 100.00 y hoy el sistema dice S/ 120.00.',
    );
  });
});
