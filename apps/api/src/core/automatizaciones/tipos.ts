import { Injectable } from '@nestjs/common';
import type { Transaccion } from '../../infra/database/con-empresa.js';

/**
 * «N días después de una fecha»: cada módulo declara las suyas. `fecha` es un instante; el motor toma su día
 * en la zona horaria de la empresa. `candidatos` corre dentro de `conEmpresa` (RLS) y no debe escribir.
 */
export type FuenteDeTiempo = {
  /** Ej.: `registro.deuda_vence`. */
  clave: string;
  modulo: string;
  descripcion: string;
  candidatos: (
    tx: Transaccion,
    hoy: Date,
  ) => Promise<Array<{ entidadTipo: string; entidadId: string; fecha: Date; datos: Record<string, unknown> }>>;
};

@Injectable()
export class RegistroDeFuentesDeTiempo {
  private readonly lista = new Map<string, FuenteDeTiempo>();

  agregar(fuentes: readonly FuenteDeTiempo[]): void {
    for (const f of fuentes) {
      if (this.lista.has(f.clave)) throw new Error(`Ya existe una fuente de tiempo llamada «${f.clave}».`);
      this.lista.set(f.clave, f);
    }
  }

  obtener(clave: string): FuenteDeTiempo | undefined {
    return this.lista.get(clave);
  }

  todas(): readonly FuenteDeTiempo[] {
    return [...this.lista.values()];
  }
}

/** Lo que ve una regla al evaluarse: `disparo` (qué la despertó) y `datos` (la carga del evento o de la fuente). */
export type RaizDeDatos = { disparo: Record<string, unknown>; datos: Record<string, unknown> };
