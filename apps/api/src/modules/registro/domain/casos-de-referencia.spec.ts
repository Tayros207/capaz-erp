import { describe, expect, it } from 'vitest';
import { aCentimos } from '@capaz/shared';
import { aplicarAbono, estadoDeDeuda, puedeAnularseLaDeuda, revertirAbono, saldoDeDeuda, type SaldoDeDeuda } from './deuda.js';

// Casos de referencia de la ficha §4.2 (sustituyen a ejecutar el SQL de Tairos.RC; decisión D15). Cada caso es una
// secuencia y el saldo esperado. Su par por HTTP está en `herramientas/casos-de-referencia.int.spec.ts`, donde además
// se comprueban los casos que dependen de la base: el bloqueo (e) y la idempotencia (f).

/** Una deuda en memoria que aplica las mismas reglas que las herramientas. */
class DeudaDePrueba {
  estado: SaldoDeDeuda['estado'] = 'pendiente';
  abonado = 0;
  abonosVivos: number[] = [];
  eventosDePagada = 0;
  constructor(readonly total: number) {}

  private get foto(): SaldoDeDeuda {
    return { estado: this.estado, totalCentimos: this.total, abonadoCentimos: this.abonado };
  }
  get saldo(): number {
    return saldoDeDeuda(this.total, this.abonado);
  }
  abonar(soles: string): 'ok' | 'conflicto' | 'argumentos_invalidos' {
    const monto = aCentimos(soles);
    const r = aplicarAbono(this.foto, monto);
    if (!r.ok) return r.codigo;
    this.abonado = r.abonadoCentimos;
    this.estado = r.estado;
    this.abonosVivos.push(monto);
    if (r.quedaPagada) this.eventosDePagada += 1;
    return 'ok';
  }
  anularAbono(soles: string): void {
    const monto = aCentimos(soles);
    const i = this.abonosVivos.indexOf(monto);
    if (i < 0) throw new Error('No hay un abono vivo de ese monto.');
    const r = revertirAbono(this.foto, monto);
    this.abonosVivos.splice(i, 1);
    this.abonado = r.abonadoCentimos;
    this.estado = r.estado;
  }
  anular(): 'ok' | 'conflicto' {
    const r = puedeAnularseLaDeuda(this.foto, this.abonosVivos.length);
    if (!r.ok) return 'conflicto';
    this.estado = 'anulada';
    return 'ok';
  }
}

const CIEN = aCentimos('100.00');

describe('casos de referencia de deudas y abonos', () => {
  it('a. 100.00 → abono 30.00 → abono 70.00 ⇒ pagada, saldo 0, «pagada» una sola vez', () => {
    const d = new DeudaDePrueba(CIEN);
    expect(d.abonar('30.00')).toBe('ok');
    expect(d.estado).toBe('parcial');
    expect(d.abonar('70.00')).toBe('ok');
    expect(d).toMatchObject({ estado: 'pagada', saldo: 0, eventosDePagada: 1 });
  });

  it('b. 100.00 → abono 100.01 ⇒ conflicto, sin movimiento', () => {
    const d = new DeudaDePrueba(CIEN);
    expect(d.abonar('100.01')).toBe('conflicto');
    expect(d).toMatchObject({ estado: 'pendiente', saldo: CIEN, abonosVivos: [] });
  });

  it('c. 100.00 → abono 40.00 → anular ese movimiento ⇒ pendiente, saldo 100.00', () => {
    const d = new DeudaDePrueba(CIEN);
    d.abonar('40.00');
    d.anularAbono('40.00');
    expect(d).toMatchObject({ estado: 'pendiente', saldo: CIEN });
  });

  it('d. 100.00 → abonos 60.00 y 40.00 → anular el de 40.00 ⇒ parcial, saldo 40.00', () => {
    const d = new DeudaDePrueba(CIEN);
    d.abonar('60.00');
    d.abonar('40.00');
    expect(d.estado).toBe('pagada');
    d.anularAbono('40.00');
    expect(d).toMatchObject({ estado: 'parcial', saldo: aCentimos('40.00') });
  });

  it('e. dos abonos de 60.00 sobre 100.00: uno entra y el otro es conflicto (en la base los ordena el bloqueo)', () => {
    const d = new DeudaDePrueba(CIEN);
    expect([d.abonar('60.00'), d.abonar('60.00')]).toEqual(['ok', 'conflicto']);
    expect(d).toMatchObject({ estado: 'parcial', saldo: aCentimos('40.00') });
  });

  it('f. repetir un abono sobre una deuda ya pagada sería conflicto: por eso la repetición la resuelve la clave de idempotencia', () => {
    const d = new DeudaDePrueba(CIEN);
    expect(d.abonar('100.00')).toBe('ok');
    expect(d.abonar('100.00')).toBe('conflicto');
    expect(d.abonosVivos).toHaveLength(1);
  });

  it('g. deuda con un abono → anular ⇒ conflicto; tras anular el abono, se anula', () => {
    const d = new DeudaDePrueba(CIEN);
    d.abonar('25.00');
    expect(d.anular()).toBe('conflicto');
    expect(d.estado).toBe('parcial');
    d.anularAbono('25.00');
    expect(d.anular()).toBe('ok');
    expect(d.estado).toBe('anulada');
    expect(d.abonar('1.00')).toBe('conflicto');
  });

  it('h. céntimos: 0.01 + 0.02 + 99.97 sobre 100.00 ⇒ pagada exacta', () => {
    const d = new DeudaDePrueba(CIEN);
    for (const monto of ['0.01', '0.02', '99.97']) expect(d.abonar(monto)).toBe('ok');
    expect(d).toMatchObject({ estado: 'pagada', saldo: 0, abonado: CIEN, eventosDePagada: 1 });
    expect(estadoDeDeuda(CIEN, d.abonado)).toBe('pagada');
  });
});
