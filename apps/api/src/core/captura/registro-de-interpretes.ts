import { Injectable } from '@nestjs/common';
import type { InterpreteDeCaptura } from './tipos.js';

/** Quién interpreta el dictado de cada módulo. Cada módulo agrega el suyo al arrancar (`onModuleInit`). */
@Injectable()
export class RegistroDeInterpretes {
  private readonly lista = new Map<string, InterpreteDeCaptura>();

  agregar(interpretes: readonly InterpreteDeCaptura[]): void {
    for (const i of interpretes) {
      if (this.lista.has(i.modulo)) throw new Error(`Ya existe un intérprete de captura para el módulo «${i.modulo}».`);
      this.lista.set(i.modulo, i);
    }
  }

  para(modulo: string): InterpreteDeCaptura | undefined {
    return this.lista.get(modulo);
  }

  /** Reemplaza sin protestar. Solo para pruebas: así siguen pasando cuando se registra el intérprete real. */
  fijar(i: InterpreteDeCaptura): void {
    this.lista.set(i.modulo, i);
  }
}
