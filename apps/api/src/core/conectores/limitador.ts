/** Cuenta fallos por origen en una ventana móvil, en memoria: frena los intentos de adivinar claves. */
export class LimitadorDeFallos {
  private readonly registro = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs: number,
    private readonly reloj: () => number = Date.now,
  ) {}

  private vigentes(origen: string): number[] {
    const corte = this.reloj() - this.ventanaMs;
    const v = (this.registro.get(origen) ?? []).filter((t) => t > corte);
    if (v.length) this.registro.set(origen, v);
    else this.registro.delete(origen);
    return v;
  }

  registrar(origen: string): void {
    const v = this.vigentes(origen);
    v.push(this.reloj());
    this.registro.set(origen, v);
    if (this.registro.size > 10_000) this.registro.delete(this.registro.keys().next().value!);
  }

  bloqueado(origen: string): boolean {
    return this.vigentes(origen).length >= this.maximo;
  }
}
