import { exito, formatearSoles, rechazo } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { CLAVE_DE_ADELANTO, codigoDeAdelanto, comprobarFechaDeAdelanto, puedeAnularseElAdelanto } from '../domain/adelanto.js';
import { decodificarCursorPorFecha } from '../domain/cursor.js';
import { anularAdelanto, bloquearAdelanto, insertarAdelanto, listarAdelantos, verAdelanto } from '../repositories/adelantos.repository.js';
import { verColaborador } from '../repositories/colaboradores.repository.js';
import { COLABORADOR_ID, ID_DE_EJEMPLO, MODULO, NO_EXISTE_ADELANTO, NO_EXISTE_COLABORADOR, auditarAdelanto, propietarioDe, responderAdelanto } from './comunes.js';
import { aAdelantoDto } from './mapeo.js';

// Adelantos de dinero: registrar (mueve dinero, idempotente) y anular (crítica). Un adelanto nunca se edita ni se borra.
// Los eventos solo llevan ids y monto (sin nombres ni documentos).

export const adelantoRegistrar = definirHerramienta('adelanto_registrar', {
  modulo: MODULO,
  permiso: 'personal:adelantos',
  criticidad: 'normal',
  idempotente: true,
  mueveDinero: true,
  ayuda: {
    titulo: 'Registrar un adelanto',
    paraQueSirve: 'Anota dinero que se le adelantó a un colaborador y le da un código correlativo (ADE-2026-0001). Si no indicas fecha, es hoy.',
    cuandoUsarla: 'Cada vez que le entregas dinero por adelantado a alguien del equipo.',
    campos: [
      COLABORADOR_ID,
      { nombre: 'montoCentimos', queSeAnota: 'Monto en céntimos, mayor que cero.', ejemplo: '15000' },
      { nombre: 'fecha', queSeAnota: 'Día del adelanto (AAAA-MM-DD); no puede ser futuro (opcional).', ejemplo: '2026-03-10' },
      { nombre: 'motivo', queSeAnota: 'Para qué fue (opcional).', ejemplo: 'Pasajes de la semana' },
    ],
    ejemploTecleado: 'adelanto de 150 soles a Rosa Mamani por pasajes',
    ejemploHablado: 'dale un adelanto de ciento cincuenta soles a Rosa',
    erroresComunes: ['La fecha del adelanto no puede ser futura.', 'El colaborador está archivado.', 'El monto debe ser mayor que cero.'],
    relacionadas: ['adelantos_listar', 'adelanto_anular', 'colaboradores_listar'],
  },
  auditar: auditarAdelanto,
  async ejecutar(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (colaborador.archivadoEn) return rechazo('conflicto', 'El colaborador está archivado.');
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const regla = comprobarFechaDeAdelanto(fecha, hoy.dia);
    if (!regla.ok) return rechazo('argumentos_invalidos', regla.motivo);
    // El número se toma al final: si algo falla antes o después, la transacción lo devuelve (sin huecos).
    const numero = await siguienteNumero(tx, CLAVE_DE_ADELANTO, { anio: hoy.anio });
    const id = await insertarAdelanto(tx, ctx, { numero, anio: hoy.anio, colaboradorId: colaborador.id, montoCentimos: args.montoCentimos, fecha, motivo: args.motivo?.trim() || null });
    await emitir(tx, 'adelanto.registrado', { adelantoId: id, colaboradorId: colaborador.id, montoCentimos: args.montoCentimos, fecha });
    return responderAdelanto(tx, ctx, id);
  },
});

export const adelantoAnular = definirHerramienta('adelanto_anular', {
  modulo: MODULO,
  permiso: 'personal:anular',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Anular un adelanto',
    paraQueSirve: 'Deja sin efecto un adelanto mal registrado. No se borra: queda marcado como anulado con su motivo.',
    cuandoUsarla: 'Cuando un adelanto se registró por error o se devolvió. Para corregirlo, anúlalo y regístralo de nuevo.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador del adelanto.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se registró dos veces' },
    ],
    ejemploTecleado: 'anular el adelanto ADE-2026-0003 porque se registró dos veces',
    ejemploHablado: 'anula el adelanto tres, estaba duplicado',
    erroresComunes: ['Ese adelanto ya está anulado.', 'La confirmación venció o el adelanto cambió: vuelve a pedirla.'],
    relacionadas: ['adelantos_listar', 'adelanto_registrar'],
  },
  auditar: (a, d) => ({ ...auditarAdelanto(a, d), entidadId: a.id }),
  async resumir(args, ctx, tx) {
    const a = await verAdelanto(tx, ctx, args.id, propietarioDe(ctx));
    if (!a) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE_ADELANTO } };
    const regla = puedeAnularseElAdelanto(a.estado as 'registrado' | 'anulado');
    if (!regla.ok) return { ok: false, error: { codigo: 'conflicto', mensaje: regla.motivo } };
    return {
      ok: true,
      resumen: {
        resumen: `Anularás el adelanto ${codigoDeAdelanto(a.anio, a.numero)} de ${formatearSoles(a.montoCentimos)}. No se puede deshacer.`,
        huella: hashCanonico({ estado: a.estado, montoCentimos: a.montoCentimos }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const previo = await bloquearAdelanto(tx, ctx, args.id, propietarioDe(ctx));
    if (!previo) return rechazo('no_encontrado', NO_EXISTE_ADELANTO);
    const regla = puedeAnularseElAdelanto(previo.estado as 'registrado' | 'anulado');
    if (!regla.ok) return rechazo('conflicto', regla.motivo);
    if (!(await anularAdelanto(tx, ctx, previo.id, args.motivo))) return rechazo('conflicto', 'Ese adelanto ya está anulado.');
    await emitir(tx, 'adelanto.anulado', { adelantoId: previo.id, colaboradorId: previo.colaboradorId, montoCentimos: previo.montoCentimos });
    return responderAdelanto(tx, ctx, previo.id);
  },
});

export const adelantosListar = definirHerramienta('adelantos_listar', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar adelantos',
    paraQueSirve: 'Muestra los adelantos del más reciente al más antiguo, por páginas. Sin filtro trae los vigentes (no anulados).',
    cuandoUsarla: 'Cuando quieres saber cuánto se adelantó, a quién y cuándo.',
    campos: [
      { nombre: 'estado', queSeAnota: 'vigentes, anulados o todos.', ejemplo: 'vigentes' },
      { nombre: 'colaboradorId', queSeAnota: 'Solo los de esa persona (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'desde', queSeAnota: 'Desde ese día (opcional).', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Hasta ese día (opcional).', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'adelantos de marzo',
    ejemploHablado: 'cuánto he adelantado este mes',
    erroresComunes: ['El período empieza antes de terminar.', 'El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['adelanto_registrar', 'colaborador_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor === undefined ? null : decodificarCursorPorFecha(args.cursor);
    if (args.cursor !== undefined && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const r = await listarAdelantos(tx, ctx, { limite: args.limite, cursor, estado: args.estado, colaboradorId: args.colaboradorId, desde: args.desde, hasta: args.hasta }, propietarioDe(ctx));
    return exito({ items: r.items.map(aAdelantoDto), siguiente: r.siguiente });
  },
});
