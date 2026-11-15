import { Injectable } from '@nestjs/common';
import type { TareaPeriodica } from './tipos.js';

/** Tareas periódicas que corre el relevo (el mantenimiento diario es la primera). */
@Injectable()
export class RegistroDeTareas {
  private readonly lista: TareaPeriodica[] = [];

  agregar(tarea: TareaPeriodica): void {
    if (this.lista.some((t) => t.nombre === tarea.nombre)) throw new Error(`Ya existe una tarea llamada «${tarea.nombre}».`);
    if (!(tarea.cadaSegundos > 0)) throw new Error(`La tarea «${tarea.nombre}» necesita cadaSegundos mayor que cero.`);
    this.lista.push(tarea);
  }

  todas(): readonly TareaPeriodica[] {
    return this.lista;
  }
}
