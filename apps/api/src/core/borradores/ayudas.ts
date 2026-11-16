import type { Ayuda } from '@capaz/shared';

const campoId = { nombre: 'id', queSeAnota: 'El borrador sobre el que actúas.', ejemplo: '0192f3a0-…' };

export const AYUDAS = {
  listar: {
    titulo: 'Ver la bandeja de borradores',
    paraQueSirve: 'Lista lo que el sistema, un agente o una regla propone hacer y espera tu aprobación.',
    cuandoUsarla: 'Cuando quieras revisar qué hay pendiente de aprobar.',
    campos: [
      { nombre: 'estado', queSeAnota: 'pendiente, aprobado o descartado (opcional).', ejemplo: 'pendiente' },
      { nombre: 'modulo', queSeAnota: 'Solo los de un módulo (opcional).', ejemplo: 'registro' },
      { nombre: 'origen', queSeAnota: 'voz, texto, agente, regla, conector o importacion (opcional).', ejemplo: 'voz' },
    ],
    ejemploTecleado: 'ver los borradores pendientes',
    ejemploHablado: 'qué tengo pendiente de aprobar',
    erroresComunes: ['Solo ves los borradores de módulos a los que puedes entrar.'],
    relacionadas: ['borrador_ver', 'borrador_aprobar'],
  },
  resumen: {
    titulo: 'Contar lo pendiente de aprobar',
    paraQueSirve: 'Dice cuántos borradores esperan tu aprobación y cuántos son de prioridad alta.',
    cuandoUsarla: 'Para avisar en el menú o en Inicio que hay algo por revisar.',
    campos: [],
    ejemploTecleado: 'cuántos pendientes tengo',
    ejemploHablado: 'qué tengo por aprobar',
    erroresComunes: ['Solo cuenta los borradores de módulos a los que puedes entrar.'],
    relacionadas: ['borradores_listar'],
  },
  ver: {
    titulo: 'Ver un borrador',
    paraQueSirve: 'Muestra lo que entendió el sistema y los datos que se guardarían al aprobar.',
    cuandoUsarla: 'Antes de aprobar, corregir o descartar.',
    campos: [campoId],
    ejemploTecleado: 'abrir el borrador',
    ejemploHablado: 'muéstrame ese borrador',
    erroresComunes: ['No existe ese borrador, o es de un módulo al que no puedes entrar.'],
    relacionadas: ['borradores_listar'],
  },
  corregir: {
    titulo: 'Corregir un borrador',
    paraQueSirve: 'Cambia los datos propuestos; se conservan los originales para medir cuánto hubo que corregir.',
    cuandoUsarla: 'Cuando lo que entendió el sistema está casi bien pero falta ajustar un dato.',
    campos: [campoId, { nombre: 'args', queSeAnota: 'Los datos completos corregidos.', ejemplo: '{ "telefono": "987654321" }' }],
    ejemploTecleado: 'corregir el teléfono del borrador',
    ejemploHablado: 'cambia el teléfono a 987654321',
    erroresComunes: ['Solo se corrige un borrador pendiente.', 'Hace falta el permiso de la herramienta que el borrador propone.'],
    relacionadas: ['borrador_aprobar', 'borrador_ver'],
  },
  aprobar: {
    titulo: 'Aprobar un borrador',
    paraQueSirve: 'Ejecuta lo propuesto con tus permisos y lo marca aprobado, todo junto.',
    cuandoUsarla: 'Cuando lo propuesto está bien y quieres que se haga.',
    campos: [campoId, { nombre: 'confirmacion', queSeAnota: 'Solo si lo propuesto es crítico: el código que te dio el paso anterior.', ejemplo: 'eyJ…' }],
    ejemploTecleado: 'aprobar el borrador',
    ejemploHablado: 'apruébalo',
    erroresComunes: [
      'Solo se aprueba desde la pantalla.',
      'Hace falta el permiso de la herramienta que el borrador propone.',
      'Si lo propuesto se rechaza, el borrador sigue pendiente.',
    ],
    relacionadas: ['borrador_corregir', 'borrador_descartar'],
  },
  descartar: {
    titulo: 'Descartar un borrador',
    paraQueSirve: 'Lo da por no válido sin ejecutar nada; queda el motivo.',
    cuandoUsarla: 'Cuando lo propuesto no corresponde o está repetido.',
    campos: [campoId, { nombre: 'motivo', queSeAnota: 'Por qué se descarta.', ejemplo: 'Cliente duplicado' }],
    ejemploTecleado: 'descartar el borrador por duplicado',
    ejemploHablado: 'descarta ese, ya existe',
    erroresComunes: ['Solo se descarta un borrador pendiente.'],
    relacionadas: ['borrador_ver'],
  },
} as const satisfies Record<string, Ayuda>;
