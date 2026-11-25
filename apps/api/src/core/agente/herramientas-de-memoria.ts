import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { exito, rechazo, type Ayuda } from '@capaz/shared';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { limpiarNombre } from './prompt.js';
import { buscarEnConversaciones } from './repositorio-de-recuerdos.js';
import { cambiarLeccion, comoLeccion, guardarLeccion, leerLeccion, listarAcciones, listarLecciones, TOPE_DE_LECCIONES_POR_PERSONA } from './repositorio-de-memoria.js';

// La huella y la memoria del asistente como herramientas registradas (regla 3): auditadas, con permisos y por el mismo ejecutor.
// El asistente puede ANOTAR lecciones y LEERLAS; corregirlas, archivarlas y aprobarlas es de las personas (están en `PROHIBIDAS`).
// Una lección que escribe el modelo nace «por revisar» y no se le muestra a nadie hasta que una persona la apruebe; solo es «vigente»
// al nacer si la persona misma la dijo (su cita aparece en SU mensaje, lo que comprueba el servidor) o si la escribe una persona.

const ayuda = (a: Ayuda): Ayuda => a;

const AYUDAS = {
  recuerdos: ayuda({
    titulo: 'Recordar chats anteriores',
    paraQueSirve: 'Busca en los chats anteriores de ESTA persona con el asistente (nunca en los de otra): qué se habló, qué se pidió, qué quedó pendiente. Sin texto devuelve lo más reciente.',
    cuandoUsarla: 'Cuando la persona diga «lo que hablamos», «como ayer», «lo del pedido de Juan que te pedí», o cuando te falte contexto de una conversación pasada.',
    campos: [{ nombre: 'texto', queSeAnota: 'Qué recordar, una palabra o frase corta que se haya dicho.', ejemplo: 'troquel' }],
    ejemploTecleado: 'qué hablamos de Juan Pérez',
    ejemploHablado: 'qué te pedí ayer',
    erroresComunes: ['Solo ve los chats de la persona que pregunta, y se guardan 90 días.'],
    relacionadas: ['memoria_listar'],
  }),
  acciones: ayuda({
    titulo: 'Ver lo que hizo el asistente',
    paraQueSirve: 'Lista, de lo más nuevo a lo más viejo, lo que el asistente hizo, propuso o intentó: qué herramienta, con qué datos, qué cambió y con qué resultado.',
    cuandoUsarla: 'Para revisar si el asistente está actuando bien: filtra por herramienta, por resultado o por conversación.',
    campos: [{ nombre: 'resultado', queSeAnota: 'ok, rechazada, pendiente_confirmacion o propuesta.', ejemplo: 'rechazada' }],
    ejemploTecleado: 'ver lo que hizo el asistente',
    ejemploHablado: 'qué ha hecho el asistente hoy',
    erroresComunes: ['Solo ve esto quien tiene permiso de auditoría.'],
    relacionadas: ['agente_configuracion_ver'],
  }),
  anotar: ayuda({
    titulo: 'Anotar una lección',
    paraQueSirve: 'Guarda en la memoria del asistente algo que no debe repetir o que debe recordar: una corrección de la persona, una preferencia, el apodo de un cliente o producto, una regla del ERP.',
    cuandoUsarla: 'Cuando la persona te corrige («no, eso está mal», «siempre hazlo así»), cuando algo falló y descubriste la forma correcta, o cuando te da una preferencia. Sin datos personales ni importes.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'error_de_herramienta, correccion, preferencia, alias o regla_del_erp.', ejemplo: 'correccion' },
      { nombre: 'texto', queSeAnota: 'La lección, en una frase corta.', ejemplo: 'Cuando digan «el grande de la esquina» es el cliente Imprenta Sol SAC.' },
      { nombre: 'cita', queSeAnota: 'Las palabras EXACTAS de la persona que motivan la lección. Sin ellas la lección queda por revisar.', ejemplo: 'siempre cobra con IGV incluido' },
    ],
    ejemploTecleado: 'recuerda que siempre cobro con IGV incluido',
    ejemploHablado: 'recuerda eso para la próxima',
    erroresComunes: ['Sin la cita de la persona, la lección queda «por revisar» y no se usa hasta que alguien la apruebe.', 'Tienes el máximo de lecciones guardadas: pide a la persona archivar alguna.'],
    relacionadas: ['memoria_listar'],
  }),
  listar: ayuda({
    titulo: 'Ver lo que aprendió el asistente',
    paraQueSirve: 'Lista las lecciones de la memoria del asistente: las tuyas y las de la empresa, con su estado.',
    cuandoUsarla: 'Para revisar o corregir lo que el asistente recuerda.',
    campos: [{ nombre: 'estado', queSeAnota: 'por_revisar, vigente o archivada.', ejemplo: 'por_revisar' }],
    ejemploTecleado: 'qué has aprendido',
    ejemploHablado: 'qué recuerdas de mí',
    erroresComunes: ['Solo ves tus lecciones y las de toda la empresa, nunca las personales de otra persona.'],
    relacionadas: ['memoria_anotar'],
  }),
  editar: ayuda({
    titulo: 'Corregir una lección',
    paraQueSirve: 'Cambia el texto de una lección de la memoria del asistente.',
    cuandoUsarla: 'Cuando una lección está mal escrita o ya no es del todo cierta.',
    campos: [{ nombre: 'texto', queSeAnota: 'El texto nuevo, de hasta 280 caracteres.', ejemplo: 'Cobrar siempre con IGV incluido.' }],
    ejemploTecleado: 'corregir una lección',
    ejemploHablado: 'cambia esa lección',
    erroresComunes: ['Una lección de la empresa solo la cambia quien administra la empresa.'],
    relacionadas: ['memoria_listar'],
  }),
  archivar: ayuda({
    titulo: 'Archivar una lección',
    paraQueSirve: 'Deja de usar una lección. No se borra: queda archivada para poder revisarla.',
    cuandoUsarla: 'Cuando el asistente aprendió algo equivocado o que ya no aplica.',
    campos: [],
    ejemploTecleado: 'archivar una lección',
    ejemploHablado: 'olvida eso',
    erroresComunes: ['Una lección de la empresa solo la archiva quien administra la empresa.'],
    relacionadas: ['memoria_listar'],
  }),
  aprobar: ayuda({
    titulo: 'Aprobar una lección',
    paraQueSirve: 'Pasa una lección «por revisar» a vigente: desde ahora el asistente la tiene en cuenta. Con alcance «empresa» la usa el asistente de toda la empresa.',
    cuandoUsarla: 'Cuando revisaste una lección que el asistente propuso y es correcta.',
    campos: [{ nombre: 'alcance', queSeAnota: 'persona (por omisión) o empresa.', ejemplo: 'empresa' }],
    ejemploTecleado: 'aprobar una lección',
    ejemploHablado: 'esa lección está bien',
    erroresComunes: ['Compartir una lección con toda la empresa pide el permiso de configurar la empresa.'],
    relacionadas: ['memoria_listar'],
  }),
};

const sinFila = () => rechazo('no_encontrado', 'No encontré esa lección.');
const claveDe = (texto: string): string => `n:${texto.toLowerCase().replace(/\s+/g, ' ').slice(0, 150)}`;

export function crearHerramientasDeMemoria(): HerramientaRegistrada[] {
  const recuerdos = definirHerramienta('conversaciones_buscar', {
    modulo: 'core', permiso: null, criticidad: 'lectura', ayuda: AYUDAS.recuerdos,
    async ejecutar(args, _ctx, tx) {
      return exito({ coincidencias: await buscarEnConversaciones(tx, { texto: args.texto && args.texto !== '' ? args.texto : null, limite: args.limite }) });
    },
  });

  const acciones = definirHerramienta('agente_acciones_listar', {
    modulo: 'core', permiso: 'auditoria:ver', criticidad: 'lectura', ayuda: AYUDAS.acciones,
    async ejecutar(args, _ctx, tx) {
      return exito(await listarAcciones(tx, args));
    },
  });

  const anotar = definirHerramienta('memoria_anotar', {
    modulo: 'core', permiso: null, criticidad: 'normal', ayuda: AYUDAS.anotar,
    auditar: (_args, datos) => ({ entidadTipo: 'agente_leccion', ...(datos?.leccion.id ? { entidadId: datos.leccion.id } : {}) }),
    async ejecutar(args, ctx, tx) {
      const texto = limpiarNombre(args.texto, 280);
      if (texto === '') return rechazo('argumentos_invalidos', 'La lección no puede quedar vacía.');
      // Una persona que anota por la pantalla es la fuente; el modelo solo es fuente si la persona dijo esas palabras (lo comprobó el servidor).
      const dePersona = ctx.canal !== 'agente' || (args.citaVerificada === true && (args.cita ?? '') !== '');
      const r = await guardarLeccion(tx, {
        tipo: args.tipo, clave: args.clave ? limpiarNombre(args.clave, 160) : claveDe(texto), texto, herramienta: args.herramienta ?? null,
        origen: dePersona ? 'persona' : 'modelo', estado: dePersona ? 'vigente' : 'por_revisar',
      });
      if ('lleno' in r) return rechazo('conflicto', `Ya hay ${TOPE_DE_LECCIONES_POR_PERSONA} lecciones guardadas. Pídele a la persona que archive alguna.`);
      return exito({ leccion: comoLeccion(r.fila) });
    },
  });

  const listar = definirHerramienta('memoria_listar', {
    modulo: 'core', permiso: null, criticidad: 'lectura', ayuda: AYUDAS.listar,
    async ejecutar(args, ctx, tx) {
      // El asistente solo lee lo que una persona o el sistema dejó vigente: lo «por revisar» no se aprobó y no debe influirle.
      return exito(await listarLecciones(tx, ctx.canal === 'agente' ? { ...args, estado: 'vigente' } : args));
    },
  });

  const editar = definirHerramienta('memoria_editar', {
    modulo: 'core', permiso: null, criticidad: 'normal', ayuda: AYUDAS.editar,
    auditar: (args) => ({ entidadTipo: 'agente_leccion', entidadId: args.id }),
    async ejecutar(args, ctx, tx) {
      const f = await leerLeccion(tx, args.id);
      if (!f) return sinFila();
      if (f.alcance === 'empresa' ? !ctx.permisos.includes('empresa:configurar') : f.usuarioId !== ctx.usuarioId) return rechazo('sin_permiso', 'Esa lección no es tuya.');
      return exito({ leccion: comoLeccion(await cambiarLeccion(tx, f.id, { texto: limpiarNombre(args.texto, 280) })) });
    },
  });

  const archivar = definirHerramienta('memoria_archivar', {
    modulo: 'core', permiso: null, criticidad: 'normal', ayuda: AYUDAS.archivar,
    auditar: (args) => ({ entidadTipo: 'agente_leccion', entidadId: args.id }),
    async ejecutar(args, ctx, tx) {
      const f = await leerLeccion(tx, args.id);
      if (!f) return sinFila();
      if (f.alcance === 'empresa' ? !ctx.permisos.includes('empresa:configurar') : f.usuarioId !== ctx.usuarioId) return rechazo('sin_permiso', 'Esa lección no es tuya.');
      return exito({ leccion: comoLeccion(await cambiarLeccion(tx, f.id, { estado: 'archivada' })) });
    },
  });

  const aprobar = definirHerramienta('memoria_aprobar', {
    modulo: 'core', permiso: null, criticidad: 'normal', ayuda: AYUDAS.aprobar,
    auditar: (args) => ({ entidadTipo: 'agente_leccion', entidadId: args.id }),
    async ejecutar(args, ctx, tx) {
      const f = await leerLeccion(tx, args.id);
      if (!f) return sinFila();
      const aEmpresa = (args.alcance ?? f.alcance) === 'empresa';
      // Compartir con la empresa, y también sacar algo de la empresa, es de quien la administra.
      if ((aEmpresa || f.alcance === 'empresa') && !ctx.permisos.includes('empresa:configurar')) return rechazo('sin_permiso', 'Compartir una lección con toda la empresa pide el permiso de configurar la empresa.');
      if (!aEmpresa && f.usuarioId !== ctx.usuarioId) return rechazo('sin_permiso', 'Esa lección no es tuya.');
      return exito({ leccion: comoLeccion(await cambiarLeccion(tx, f.id, { estado: 'vigente', alcance: aEmpresa ? 'empresa' : 'persona' })) });
    },
  });
  return [acciones, recuerdos, anotar, listar, editar, archivar, aprobar];
}

/** Registra la huella y la memoria al arrancar. El contrato y las herramientas entran en el MISMO paso (si no, el registro no arranca). */
@Injectable()
export class HerramientasDeMemoria implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeMemoria());
  }
}
