import { exito } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { semillaDelTaller } from '../domain/taller-semilla.js';
import { insertarSemilla, tallerTieneFilas } from '../repositories/taller.repository.js';
import { MODULO } from './comun.js';

const VACIO = { formatos: 0, maquinas: 0, tarifas: 0, items: 0 };

export const tallerSembrar = definirHerramienta('taller_sembrar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Cargar los valores de ejemplo del taller (Perú)',
    paraQueSirve: 'Carga formatos, una máquina, tarifas e ítems de ejemplo para empezar. SON ILUSTRATIVOS: cada taller debe poner sus propios costos y medidas.',
    cuandoUsarla: 'Solo la primera vez, con el taller vacío. Si ya hay datos, no hace nada.',
    campos: [],
    ejemploTecleado: 'cargar los valores de ejemplo del taller',
    ejemploHablado: 'carga los datos de ejemplo del taller',
    erroresComunes: ['Si el taller ya tiene datos (aunque estén archivados), no se carga nada y se avisa.'],
    relacionadas: ['tarifas_listar', 'maquinas_listar', 'formatos_pliego_listar', 'items_cuadro_listar'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'taller', resumen: d ? { sembrado: d.sembrado } : undefined }),
  async ejecutar(_args, ctx, tx) {
    if (await tallerTieneFilas(tx, ctx)) return exito({ sembrado: false, mensaje: 'El taller ya tiene datos: no se cargó nada.', ...VACIO });
    const s = semillaDelTaller();
    await insertarSemilla(tx, ctx, s);
    const cuenta = { formatos: s.formatos.length, maquinas: s.maquinas.length, tarifas: s.tarifas.length, items: s.items.length };
    return exito({ sembrado: true, mensaje: 'Se cargaron valores de ejemplo (Perú). Son ilustrativos: revisa y ajusta tus costos.', ...cuenta });
  },
});
