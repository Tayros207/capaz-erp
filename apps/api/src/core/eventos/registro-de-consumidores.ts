import { Injectable } from '@nestjs/common';
import type { Consumidor } from './tipos.js';

/** Quién escucha qué. Cada módulo agrega sus consumidores al arrancar (`onModuleInit`). */
@Injectable()
export class RegistroDeConsumidores {
  private readonly lista: Consumidor[] = [];

  agregar(consumidores: readonly Consumidor[]): void {
    for (const c of consumidores) {
      if (this.lista.some((x) => x.nombre === c.nombre)) throw new Error(`Ya existe un consumidor llamado «${c.nombre}».`);
      this.lista.push(c);
    }
  }

  /** Los consumidores de un tipo de evento, más los de `'*'`. */
  para(tipo: string): readonly Consumidor[] {
    return this.lista.filter((c) => c.evento === tipo || c.evento === '*');
  }

  todos(): readonly Consumidor[] {
    return this.lista;
  }
}
