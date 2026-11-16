import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { exito, rechazo, type Respuesta } from '@capaz/shared';
import { EjecutorDeHerramientas } from '../../../core/herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { definirHerramienta, type HerramientaRegistrada } from '../../../core/herramientas/tipos.js';
import { escribirCsv } from '../../../core/intercambio/csv.js';
import { filasPlanas, nombreDeArchivo } from '../domain/composicion.js';
import { componerPanel } from './panel.js';

const MODULO = 'reportes';

const AYUDA_PANEL = {
  titulo: 'Indicadores por período',
  paraQueSirve: 'Reúne en un solo lugar las cifras de cada módulo al que tienes acceso para un período.',
  cuandoUsarla: 'Cuando quieres ver cómo va el negocio entre dos fechas sin entrar módulo por módulo.',
  campos: [
    { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-03-01' },
    { nombre: 'hasta', queSeAnota: 'Último día del período (máximo 366 días).', ejemplo: '2026-03-31' },
  ],
  ejemploTecleado: 'indicadores de marzo',
  ejemploHablado: 'cómo va el negocio este mes',
  erroresComunes: ['El período empieza antes de terminar.', 'Un módulo al que no tienes acceso no aparece en el panel.'],
  relacionadas: ['reportes_exportar_csv'],
};

const AYUDA_EXPORTAR = {
  titulo: 'Exportar indicadores a CSV',
  paraQueSirve: 'Entrega el mismo panel en filas planas (módulo, indicador, valor, unidad) para abrirlo en una hoja de cálculo.',
  cuandoUsarla: 'Cuando necesitas llevarte las cifras de un período a otra herramienta o archivarlas.',
  campos: AYUDA_PANEL.campos,
  ejemploTecleado: 'exportar indicadores de marzo',
  ejemploHablado: 'descarga las cifras de este mes',
  erroresComunes: ['Exportar exige el permiso de exportar además del de ver.', 'Solo salen los módulos a los que tienes acceso.'],
  relacionadas: ['reportes_panel'],
};

export function crearHerramientasDeReportes(ejecutor: EjecutorDeHerramientas, registro: RegistroDeHerramientas): HerramientaRegistrada[] {
  const panel = definirHerramienta('reportes_panel', {
    modulo: MODULO,
    permiso: 'reportes:ver',
    criticidad: 'lectura',
    ayuda: AYUDA_PANEL,
    auditar: (a, d) => ({ resumen: { desde: a.desde, hasta: a.hasta, ...(d && { bloques: d.bloques.length }) } }),
    ejecutar: (args, ctx, tx) => componerPanel(ejecutor, registro, tx, ctx, args),
  });

  const exportar = definirHerramienta('reportes_exportar_csv', {
    modulo: MODULO,
    permiso: 'reportes:exportar',
    criticidad: 'lectura',
    ayuda: AYUDA_EXPORTAR,
    auditar: (a, d) => ({ resumen: { desde: a.desde, hasta: a.hasta, ...(d && { filas: d.filas }) } }),
    async ejecutar(args, ctx, tx): Promise<Respuesta<{ nombreDeArchivo: string; contenido: string; filas: number }>> {
      // Exportar es ver y además llevarse el archivo: sin el permiso de ver tampoco se exporta.
      if (!ctx.permisos.includes('reportes:ver')) return rechazo('sin_permiso', 'No tienes permiso para ver los indicadores.');
      const r = await componerPanel(ejecutor, registro, tx, ctx, args);
      if (!r.ok || !('datos' in r)) return r as Respuesta<never>;
      const filas = filasPlanas(r.datos.bloques);
      return exito({
        nombreDeArchivo: nombreDeArchivo(args.desde, args.hasta),
        contenido: escribirCsv(filas, { separador: ',', bom: true }),
        filas: filas.length - 1,
      });
    },
  });

  return [panel, exportar];
}

/** Las dos herramientas del módulo. Reportes no consume eventos ni tiene fuentes de tiempo. */
@Injectable()
export class HerramientasDeReportes implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeReportes(this.ejecutor, this.registro));
  }
}
