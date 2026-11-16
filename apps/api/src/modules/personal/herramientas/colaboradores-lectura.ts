import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorPorNombre } from '../domain/cursor.js';
import { listarColaboradores } from '../repositories/colaboradores.repository.js';
import { ID, MODULO, responderColaborador } from './comunes.js';
import { aColaboradorDto } from './mapeo.js';

export const colaboradorVer = definirHerramienta('colaborador_ver', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un colaborador',
    paraQueSirve: 'Muestra la ficha de una persona con sus últimas asistencias y sus últimos adelantos.',
    cuandoUsarla: 'Cuando quieres saber cómo viene una persona o cuánto se le ha adelantado.',
    campos: [ID],
    ejemploTecleado: 'ver a Rosa Mamani',
    ejemploHablado: 'abre la ficha de Rosa',
    erroresComunes: ['No existe ese colaborador o es de otra empresa.'],
    relacionadas: ['colaboradores_listar', 'asistencias_listar', 'adelantos_listar'],
  },
  ejecutar: (args, ctx, tx) => responderColaborador(tx, ctx, args.id),
});

export const colaboradoresListar = definirHerramienta('colaboradores_listar', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar colaboradores',
    paraQueSirve: 'Muestra al equipo por orden de nombre, por páginas. Sin filtro trae solo a los activos.',
    cuandoUsarla: 'Cuando quieres ver quién trabaja contigo o buscar a alguien por su nombre.',
    campos: [
      { nombre: 'buscar', queSeAnota: 'Parte del nombre (opcional; no distingue tildes ni mayúsculas).', ejemplo: 'rosa' },
      { nombre: 'estado', queSeAnota: 'activos, archivados o todos.', ejemplo: 'activos' },
      { nombre: 'sucursalId', queSeAnota: 'Solo los de esa sucursal (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
    ],
    ejemploTecleado: 'ver los colaboradores activos',
    ejemploHablado: 'quiénes trabajan conmigo',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['colaborador_ver', 'colaborador_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor === undefined ? null : decodificarCursorPorNombre(args.cursor);
    if (args.cursor !== undefined && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const r = await listarColaboradores(tx, ctx, { limite: args.limite, cursor, buscar: args.buscar, estado: args.estado, sucursalId: args.sucursalId });
    return exito({ items: r.items.map(aColaboradorDto), siguiente: r.siguiente });
  },
});
