import { rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarCambios, prepararColaborador, type DatosDeColaborador } from '../domain/colaborador.js';
import type { Colaborador } from '../repositories/colaboradores.repository.js';
import { actualizarColaborador, cambiarArchivado, colaboradorActivoPorNombre, crearColaborador, verColaborador } from '../repositories/colaboradores.repository.js';
import { ID, MODULO, NO_EXISTE_COLABORADOR, auditarColaborador, comprobarReferencias, responderColaborador } from './comunes.js';

// Escrituras de colaboradores: crear, editar, archivar y restaurar. Un colaborador nunca se borra.

const aDatos = (f: Colaborador): DatosDeColaborador => ({
  nombre: f.nombre,
  nombreNormalizado: f.nombreNormalizado,
  documentoTipo: f.documentoTipo,
  documentoNumero: f.documentoNumero,
  telefono: f.telefono,
  cargo: f.cargo,
  cuentaId: f.usuarioId,
  fechaIngreso: f.fechaIngreso,
  sucursalId: f.sucursalId,
});

const choque = (otro: Colaborador) => rechazo('conflicto', 'Ya hay un colaborador activo con ese nombre.', [{ id: otro.id, nombre: otro.nombre }]);

export const colaboradorCrear = definirHerramienta('colaborador_crear', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un colaborador',
    paraQueSirve: 'Da de alta a una persona del equipo con sus datos básicos. Solo el nombre es obligatorio.',
    cuandoUsarla: 'Cuando entra alguien nuevo y quieres marcar su asistencia o darle adelantos.',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Nombre completo.', ejemplo: 'Rosa Mamani Quispe' },
      { nombre: 'documentoTipo', queSeAnota: 'dni, ce, pasaporte u otro (opcional; va con el número).', ejemplo: 'dni' },
      { nombre: 'documentoNumero', queSeAnota: 'Número del documento (opcional).', ejemplo: '45871236' },
      { nombre: 'telefono', queSeAnota: 'Teléfono (opcional).', ejemplo: '987654321' },
      { nombre: 'cargo', queSeAnota: 'Qué hace en el negocio (opcional).', ejemplo: 'Operaria de imprenta' },
      { nombre: 'fechaIngreso', queSeAnota: 'Día en que empezó (opcional).', ejemplo: '2026-03-01' },
    ],
    ejemploTecleado: 'nuevo colaborador Rosa Mamani, operaria de imprenta, DNI 45871236',
    ejemploHablado: 'agrega a Rosa Mamani como operaria de imprenta',
    erroresComunes: ['Ya hay un colaborador activo con ese nombre.', 'El número de documento no es válido para su tipo.', 'La sucursal no existe o está archivada.'],
    relacionadas: ['colaborador_editar', 'colaboradores_listar', 'asistencia_marcar'],
  },
  auditar: auditarColaborador,
  async ejecutar(args, ctx, tx) {
    const p = prepararColaborador(args);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const falta = await comprobarReferencias(tx, ctx, p.datos);
    if (falta) return rechazo('argumentos_invalidos', falta);
    const creado = await crearColaborador(tx, ctx, p.datos);
    if (!creado) {
      const otro = await colaboradorActivoPorNombre(tx, ctx, p.datos.nombreNormalizado);
      if (!otro) throw new Error('Conflicto de unicidad de colaboradores sin fila que lo explique.');
      return choque(otro);
    }
    return responderColaborador(tx, ctx, creado.id);
  },
});

export const colaboradorEditar = definirHerramienta('colaborador_editar', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar un colaborador',
    paraQueSirve: 'Cambia solo los datos que indiques. Un dato opcional enviado vacío se borra.',
    cuandoUsarla: 'Cuando cambia el cargo, el teléfono, el documento o cualquier otro dato de la ficha.',
    campos: [ID, { nombre: 'cargo', queSeAnota: 'Nuevo cargo, o vacío para quitarlo.', ejemplo: 'Encargada de turno' }],
    ejemploTecleado: 'cambiar el cargo de Rosa Mamani a encargada de turno',
    ejemploHablado: 'Rosa ahora es encargada de turno',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Ya hay un colaborador activo con ese nombre.', 'Un colaborador archivado no se edita: restáuralo primero.'],
    relacionadas: ['colaborador_ver', 'colaborador_archivar'],
  },
  auditar: (a, d) => ({
    ...auditarColaborador(a, d),
    entidadId: a.id,
    resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(',') },
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await verColaborador(tx, ctx, args.id, { bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (actual.archivadoEn) return rechazo('conflicto', 'Un colaborador archivado no se edita: restáuralo primero.');
    const { id, ...cambios } = args;
    const p = aplicarCambios(aDatos(actual), cambios);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const falta = await comprobarReferencias(tx, ctx, { sucursalId: cambios.sucursalId, cuentaId: cambios.cuentaId });
    if (falta) return rechazo('argumentos_invalidos', falta);
    const otro = await colaboradorActivoPorNombre(tx, ctx, p.datos.nombreNormalizado, id);
    if (otro) return choque(otro);
    await actualizarColaborador(tx, ctx, id, p.datos);
    return responderColaborador(tx, ctx, id);
  },
});

export const colaboradorArchivar = definirHerramienta('colaborador_archivar', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar un colaborador',
    paraQueSirve: 'Retira a la persona de las listas del día. Su historial de asistencia y adelantos se conserva; no se borra nada.',
    cuandoUsarla: 'Cuando deja de trabajar en el negocio.',
    campos: [ID],
    ejemploTecleado: 'archivar a Rosa Mamani',
    ejemploHablado: 'Rosa ya no trabaja con nosotros',
    erroresComunes: ['El colaborador ya está archivado.'],
    relacionadas: ['colaborador_restaurar', 'colaboradores_listar'],
  },
  auditar: auditarColaborador,
  async ejecutar(args, ctx, tx) {
    const actual = await verColaborador(tx, ctx, args.id, { bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (actual.archivadoEn) return rechazo('conflicto', 'El colaborador ya está archivado.');
    await cambiarArchivado(tx, ctx, args.id, true);
    return responderColaborador(tx, ctx, args.id);
  },
});

export const colaboradorRestaurar = definirHerramienta('colaborador_restaurar', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Restaurar un colaborador',
    paraQueSirve: 'Devuelve a las listas a un colaborador archivado.',
    cuandoUsarla: 'Cuando vuelve a trabajar o se archivó por error.',
    campos: [ID],
    ejemploTecleado: 'restaurar a Rosa Mamani',
    ejemploHablado: 'Rosa vuelve al equipo',
    erroresComunes: ['El colaborador no está archivado.', 'Ya hay otro colaborador activo con ese nombre.'],
    relacionadas: ['colaborador_archivar', 'colaboradores_listar'],
  },
  auditar: auditarColaborador,
  async ejecutar(args, ctx, tx) {
    const actual = await verColaborador(tx, ctx, args.id, { bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (!actual.archivadoEn) return rechazo('conflicto', 'El colaborador no está archivado.');
    const otro = await colaboradorActivoPorNombre(tx, ctx, actual.nombreNormalizado, args.id);
    if (otro) return choque(otro);
    await cambiarArchivado(tx, ctx, args.id, false);
    return responderColaborador(tx, ctx, args.id);
  },
});
