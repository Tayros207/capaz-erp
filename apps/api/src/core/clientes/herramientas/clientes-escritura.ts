import { exito, rechazo, type ArgsDe } from '@capaz/shared';
import { emitir } from '../../eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { prepararCliente, type EntradaDeCliente } from '../domain/cliente.js';
import {
  archivarCliente,
  buscarClientes,
  crearCliente,
  editarCliente,
  restaurarCliente,
  verCliente,
  type Cliente,
} from '../repositories/clientes.repository.js';
import { aCandidata, aClienteDto } from './cliente-mapeo.js';

const eventoDe = (f: Cliente) => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo as 'cliente' | 'proveedor' | 'ambos',
  clase: f.clase as 'persona' | 'empresa',
});
const emitirActualizado = (tx: Transaccion, f: Cliente) => emitir(tx, 'cliente.actualizado', { ...eventoDe(f), archivado: f.archivadoEn !== null });

/** El rechazo por choque lleva al existente y a los más parecidos como candidatas (la voz y la pantalla ofrecen «usar este»). */
async function conflictoDe(tx: Transaccion, ctx: ContextoDeHerramienta, motivo: 'nombre' | 'documento', existente: Cliente, nombreNormalizado: string) {
  const parecidos = await buscarClientes(tx, ctx, nombreNormalizado, 4);
  const candidatas = [existente, ...parecidos.filter((p) => p.id !== existente.id)].slice(0, 4).map(aCandidata);
  const mensaje =
    motivo === 'nombre' ? `Ya existe un cliente llamado «${existente.nombre}».` : `Ya existe un cliente con ese documento: «${existente.nombre}».`;
  return rechazo('conflicto', mensaje, candidatas);
}

const AUDITAR = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'cliente', entidadId: d?.id });

export const clientesCrear = definirHerramienta('clientes_crear', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un cliente',
    paraQueSirve: 'Registra a un cliente o proveedor nuevo. Si ya existe uno con el mismo nombre o documento, te lo muestra en lugar de duplicarlo.',
    cuandoUsarla: 'Cuando atiendes a alguien que todavía no está en tu lista.',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Nombre o razón social.', ejemplo: 'José Pérez' },
      { nombre: 'documentoTipo', queSeAnota: 'dni, ruc, ce, pasaporte u otro (opcional).', ejemplo: 'dni' },
      { nombre: 'documentoNumero', queSeAnota: 'Número del documento (opcional).', ejemplo: '45871236' },
      { nombre: 'telefono', queSeAnota: 'Teléfono (opcional).', ejemplo: '987654321' },
    ],
    ejemploTecleado: 'crear cliente José Pérez, DNI 45871236, teléfono 987654321',
    ejemploHablado: 'agrega a José Pérez como cliente, su teléfono es 987 654 321',
    erroresComunes: ['Ya existe un cliente con ese nombre o documento: elige uno de los candidatos.', 'El DNI tiene 8 dígitos y el RUC 11.'],
    relacionadas: ['clientes_buscar', 'clientes_editar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const entrada: EntradaDeCliente = { ...args, clase: args.clase ?? (args.documentoTipo === 'ruc' ? 'empresa' : 'persona') };
    const p = prepararCliente(entrada);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const r = await crearCliente(tx, ctx, p.datos);
    if (!r.creado) return conflictoDe(tx, ctx, r.conflicto, r.existente, p.datos.nombreNormalizado);
    await emitir(tx, 'cliente.creado', eventoDe(r.cliente));
    return exito(aClienteDto(r.cliente));
  },
});

/** Los datos actuales con lo que cambia encima (`null` borra un dato opcional). */
function fusionar(actual: Cliente, a: ArgsDe<'clientes_editar'>): EntradaDeCliente {
  return {
    tipo: a.tipo ?? (actual.tipo as EntradaDeCliente['tipo']),
    clase: a.clase ?? (actual.clase as EntradaDeCliente['clase']),
    nombre: a.nombre ?? actual.nombre,
    documentoTipo: a.documentoTipo !== undefined ? a.documentoTipo : (actual.documentoTipo as EntradaDeCliente['documentoTipo']),
    documentoNumero: a.documentoNumero !== undefined ? a.documentoNumero : actual.documentoNumero,
    telefono: a.telefono !== undefined ? a.telefono : actual.telefono,
    correo: a.correo !== undefined ? a.correo : actual.correo,
    direccion: a.direccion !== undefined ? a.direccion : actual.direccion,
    notas: a.notas !== undefined ? a.notas : actual.notas,
  };
}

export const clientesEditar = definirHerramienta('clientes_editar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar un cliente',
    paraQueSirve: 'Cambia los datos de un cliente. Envías solo lo que cambia; un dato opcional en blanco se borra.',
    cuandoUsarla: 'Cuando cambia su teléfono, su dirección o hay que corregir su nombre.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador del cliente.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'telefono', queSeAnota: 'Teléfono nuevo.', ejemplo: '999111222' },
    ],
    ejemploTecleado: 'cambiar el teléfono de José Pérez a 999111222',
    ejemploHablado: 'el nuevo teléfono de José Pérez es 999 111 222',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Otro cliente ya usa ese nombre o documento.'],
    relacionadas: ['clientes_ver', 'clientes_archivar'],
  },
  auditar: (a) => ({ entidadTipo: 'cliente', entidadId: a.id, resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(',') } }),
  async ejecutar(args, ctx, tx) {
    const actual = await verCliente(tx, ctx, args.id);
    if (!actual) return rechazo('no_encontrado', 'No existe ese cliente.');
    const p = prepararCliente(fusionar(actual, args));
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const r = await editarCliente(tx, ctx, args.id, p.datos);
    if (!r) return rechazo('no_encontrado', 'No existe ese cliente.');
    if ('conflicto' in r) return conflictoDe(tx, ctx, r.conflicto, r.existente, p.datos.nombreNormalizado);
    await emitirActualizado(tx, r.cliente);
    return exito(aClienteDto(r.cliente));
  },
});

export const clientesArchivar = definirHerramienta('clientes_archivar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar un cliente',
    paraQueSirve: 'Oculta al cliente de las listas sin borrar su historia. Se puede restaurar.',
    cuandoUsarla: 'Cuando ya no trabajas con esa persona o empresa.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del cliente.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }],
    ejemploTecleado: 'archivar al cliente José Pérez',
    ejemploHablado: 'archiva a José Pérez',
    erroresComunes: ['El cliente no existe o es de otra empresa.'],
    relacionadas: ['clientes_restaurar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const f = await archivarCliente(tx, ctx, args.id);
    if (!f) return rechazo('no_encontrado', 'No existe ese cliente.');
    await emitirActualizado(tx, f);
    return exito(aClienteDto(f));
  },
});

export const clientesRestaurar = definirHerramienta('clientes_restaurar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Restaurar un cliente',
    paraQueSirve: 'Devuelve a las listas a un cliente archivado.',
    cuandoUsarla: 'Cuando vuelves a trabajar con alguien que habías archivado.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del cliente.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }],
    ejemploTecleado: 'restaurar al cliente José Pérez',
    ejemploHablado: 'vuelve a activar a José Pérez',
    erroresComunes: ['El cliente no existe o es de otra empresa.'],
    relacionadas: ['clientes_archivar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const f = await restaurarCliente(tx, ctx, args.id);
    if (!f) return rechazo('no_encontrado', 'No existe ese cliente.');
    await emitirActualizado(tx, f);
    return exito(aClienteDto(f));
  },
});
