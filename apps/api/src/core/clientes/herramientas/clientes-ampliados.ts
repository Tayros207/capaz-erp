import { exito, rechazo, type ClienteComercialDto, type ContactoDto, type DireccionDto } from '@capaz/shared';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { normalizarTelefono, textoOpcional } from '../domain/normalizacion.js';
import {
  eliminarContacto,
  eliminarDireccion,
  guardarComercial,
  guardarContacto,
  guardarDireccion,
  listarContactos,
  listarDirecciones,
  verComercial,
  type ClienteComercial,
  type Contacto,
  type Direccion,
} from '../repositories/maestros-clientes.repository.js';
import { verCliente } from '../repositories/clientes.repository.js';

// Ficha comercial, contactos y direcciones de clientes y proveedores (0025).

const ID_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';
const NO_EXISTE = 'No existe ese cliente.';

const comercialPorDefecto = (clienteId: string): ClienteComercialDto => ({
  clienteId,
  condicionPagoDias: 0,
  limiteCreditoCentimos: null,
  moneda: 'PEN',
  vendedorId: null,
  segmento: null,
  sitioWeb: null,
  agenteRetencion: false,
  sujetoDetraccion: false,
  banco: null,
  cuentaBancaria: null,
  cci: null,
  notasComerciales: null,
  actualizadoEn: null,
});

const aComercialDto = (f: ClienteComercial): ClienteComercialDto => ({
  clienteId: f.clienteId,
  condicionPagoDias: f.condicionPagoDias,
  limiteCreditoCentimos: f.limiteCreditoCentimos,
  moneda: f.moneda as ClienteComercialDto['moneda'],
  vendedorId: f.vendedorId,
  segmento: f.segmento,
  sitioWeb: f.sitioWeb,
  agenteRetencion: f.agenteRetencion,
  sujetoDetraccion: f.sujetoDetraccion,
  banco: f.banco,
  cuentaBancaria: f.cuentaBancaria,
  cci: f.cci,
  notasComerciales: f.notasComerciales,
  actualizadoEn: f.actualizadoEn.toISOString(),
});

const aContactoDto = (f: Contacto): ContactoDto => ({
  id: f.id,
  clienteId: f.clienteId,
  nombre: f.nombre,
  cargo: f.cargo,
  telefono: f.telefono,
  correo: f.correo,
  esPrincipal: f.esPrincipal,
  notas: f.notas,
  actualizadoEn: f.actualizadoEn.toISOString(),
});

const aDireccionDto = (f: Direccion): DireccionDto => ({
  id: f.id,
  clienteId: f.clienteId,
  tipo: f.tipo as DireccionDto['tipo'],
  direccion: f.direccion,
  ciudad: f.ciudad,
  departamento: f.departamento,
  referencia: f.referencia,
  esPrincipal: f.esPrincipal,
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const clientesComercialVer = definirHerramienta('clientes_comercial_ver', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver las condiciones comerciales',
    paraQueSirve: 'Muestra el plazo de pago, el límite de crédito, la moneda, el vendedor y los datos bancarios de un cliente o proveedor.',
    cuandoUsarla: 'Antes de venderle a crédito o de pagarle a un proveedor.',
    campos: [{ nombre: 'clienteId', queSeAnota: 'Identificador del cliente o proveedor.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'ver las condiciones de pago de Gráfica Sur',
    ejemploHablado: 'qué plazo de pago tiene Gráfica Sur',
    erroresComunes: ['El cliente no existe o es de otra empresa.'],
    relacionadas: ['clientes_comercial_guardar', 'clientes_ver'],
  },
  async ejecutar(args, ctx, tx) {
    if (!(await verCliente(tx, ctx, args.clienteId))) return rechazo('no_encontrado', NO_EXISTE);
    const f = await verComercial(tx, ctx, args.clienteId);
    return exito(f ? aComercialDto(f) : comercialPorDefecto(args.clienteId));
  },
});

export const clientesComercialGuardar = definirHerramienta('clientes_comercial_guardar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Guardar las condiciones comerciales',
    paraQueSirve: 'Anota el plazo de pago, el límite de crédito, la moneda, el vendedor, las retenciones y los datos bancarios. Envías solo lo que cambia.',
    cuandoUsarla: 'Cuando acuerdas crédito con un cliente o te pasan la cuenta de un proveedor.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Identificador del cliente o proveedor.', ejemplo: ID_EJEMPLO },
      { nombre: 'condicionPagoDias', queSeAnota: 'Días de crédito (0 es al contado).', ejemplo: '30' },
      { nombre: 'limiteCreditoCentimos', queSeAnota: 'Límite de crédito en céntimos.', ejemplo: '500000' },
    ],
    ejemploTecleado: 'a Gráfica Sur dale 30 días de crédito y límite de 5000 soles',
    ejemploHablado: 'Gráfica Sur paga a treinta días con un límite de cinco mil soles',
    erroresComunes: ['Hay que indicar al menos un dato.', 'El plazo va de 0 a 365 días.'],
    relacionadas: ['clientes_comercial_ver'],
  },
  auditar: (a) => ({ entidadTipo: 'cliente', entidadId: a.clienteId, resumen: { campos: Object.keys(a).filter((k) => k !== 'clienteId').sort().join(',') } }),
  async ejecutar(args, ctx, tx) {
    if (!(await verCliente(tx, ctx, args.clienteId))) return rechazo('no_encontrado', NO_EXISTE);
    const { clienteId, ...resto } = args;
    const cambios = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined));
    for (const campo of ['segmento', 'sitioWeb', 'banco', 'cuentaBancaria', 'cci', 'notasComerciales', 'vendedorId'] as const) {
      if (typeof cambios[campo] === 'string') cambios[campo] = textoOpcional(cambios[campo] as string);
    }
    return exito(aComercialDto(await guardarComercial(tx, ctx, clienteId, cambios)));
  },
});

export const clientesContactosListar = definirHerramienta('clientes_contactos_listar', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los contactos',
    paraQueSirve: 'Muestra las personas de contacto de un cliente o proveedor; la principal va primero.',
    cuandoUsarla: 'Cuando necesitas saber con quién hablar en esa empresa.',
    campos: [{ nombre: 'clienteId', queSeAnota: 'Identificador del cliente o proveedor.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'contactos de Gráfica Sur',
    ejemploHablado: 'con quién hablo en Gráfica Sur',
    erroresComunes: ['El cliente no existe o es de otra empresa.'],
    relacionadas: ['clientes_contacto_guardar'],
  },
  async ejecutar(args, ctx, tx) {
    if (!(await verCliente(tx, ctx, args.clienteId))) return rechazo('no_encontrado', NO_EXISTE);
    return exito({ items: (await listarContactos(tx, ctx, args.clienteId)).map(aContactoDto) });
  },
});

export const clientesContactoGuardar = definirHerramienta('clientes_contacto_guardar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Guardar un contacto',
    paraQueSirve: 'Agrega una persona de contacto o corrige una que ya existe. Si la marcas como principal, la anterior deja de serlo.',
    cuandoUsarla: 'Cuando conoces a alguien nuevo en la empresa de un cliente o proveedor.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Identificador del cliente o proveedor.', ejemplo: ID_EJEMPLO },
      { nombre: 'id', queSeAnota: 'Solo para corregir un contacto existente.', ejemplo: ID_EJEMPLO },
      { nombre: 'nombre', queSeAnota: 'Nombre de la persona.', ejemplo: 'Ana Rojas' },
      { nombre: 'cargo', queSeAnota: 'Su puesto (opcional).', ejemplo: 'Compras' },
    ],
    ejemploTecleado: 'agregar contacto Ana Rojas, compras, 987654321 a Gráfica Sur',
    ejemploHablado: 'agrega a Ana Rojas de compras como contacto de Gráfica Sur',
    erroresComunes: ['El teléfono o el correo no son válidos.', 'El contacto no pertenece a ese cliente.'],
    relacionadas: ['clientes_contactos_listar', 'clientes_contacto_eliminar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'cliente_contacto', entidadId: d?.id ?? a.id }),
  async ejecutar(args, ctx, tx) {
    if (!(await verCliente(tx, ctx, args.clienteId))) return rechazo('no_encontrado', NO_EXISTE);
    const telefono = normalizarTelefono(args.telefono);
    if (telefono === undefined) return rechazo('argumentos_invalidos', 'El teléfono no es válido.');
    const correo = textoOpcional(args.correo)?.toLowerCase() ?? null;
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return rechazo('argumentos_invalidos', 'El correo no es válido.');
    if (args.id && !(await listarContactos(tx, ctx, args.clienteId)).some((c) => c.id === args.id)) {
      return rechazo('no_encontrado', 'No existe ese contacto en este cliente.');
    }
    const f = await guardarContacto(tx, ctx, args.clienteId, args.id, {
      nombre: args.nombre.replace(/\s+/g, ' ').trim(),
      cargo: textoOpcional(args.cargo),
      telefono,
      correo,
      notas: textoOpcional(args.notas),
      esPrincipal: args.esPrincipal ?? false,
    });
    return f ? exito(aContactoDto(f)) : rechazo('no_encontrado', 'No existe ese contacto en este cliente.');
  },
});

export const clientesContactoEliminar = definirHerramienta('clientes_contacto_eliminar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Quitar un contacto',
    paraQueSirve: 'Borra a una persona de contacto de la ficha del cliente o proveedor.',
    cuandoUsarla: 'Cuando esa persona ya no trabaja allí o se cargó por error.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del contacto.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'quitar el contacto Ana Rojas',
    ejemploHablado: 'borra a Ana Rojas de los contactos',
    erroresComunes: ['El contacto no existe o es de otra empresa.'],
    relacionadas: ['clientes_contactos_listar'],
  },
  auditar: (a) => ({ entidadTipo: 'cliente_contacto', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    return (await eliminarContacto(tx, ctx, args.id)) ? exito({ id: args.id }) : rechazo('no_encontrado', 'No existe ese contacto.');
  },
});

export const clientesDireccionesListar = definirHerramienta('clientes_direcciones_listar', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las direcciones',
    paraQueSirve: 'Muestra las direcciones fiscal, de entrega y otras de un cliente o proveedor.',
    cuandoUsarla: 'Cuando vas a despachar un pedido o emitir un documento.',
    campos: [{ nombre: 'clienteId', queSeAnota: 'Identificador del cliente o proveedor.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'direcciones de Gráfica Sur',
    ejemploHablado: 'dónde entrego a Gráfica Sur',
    erroresComunes: ['El cliente no existe o es de otra empresa.'],
    relacionadas: ['clientes_direccion_guardar'],
  },
  async ejecutar(args, ctx, tx) {
    if (!(await verCliente(tx, ctx, args.clienteId))) return rechazo('no_encontrado', NO_EXISTE);
    return exito({ items: (await listarDirecciones(tx, ctx, args.clienteId)).map(aDireccionDto) });
  },
});

export const clientesDireccionGuardar = definirHerramienta('clientes_direccion_guardar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Guardar una dirección',
    paraQueSirve: 'Agrega una dirección o corrige una existente. Por cliente y tipo solo una puede ser la principal.',
    cuandoUsarla: 'Cuando el cliente tiene otro local o un punto de entrega distinto del fiscal.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Identificador del cliente o proveedor.', ejemplo: ID_EJEMPLO },
      { nombre: 'tipo', queSeAnota: 'fiscal, entrega u otra (por defecto, entrega).', ejemplo: 'entrega' },
      { nombre: 'direccion', queSeAnota: 'Calle y número.', ejemplo: 'Av. Industrial 450' },
      { nombre: 'ciudad', queSeAnota: 'Ciudad (opcional).', ejemplo: 'Lima' },
    ],
    ejemploTecleado: 'dirección de entrega de Gráfica Sur: Av. Industrial 450, Lima',
    ejemploHablado: 'entregamos a Gráfica Sur en Avenida Industrial cuatrocientos cincuenta, Lima',
    erroresComunes: ['La dirección es obligatoria.', 'La dirección no pertenece a ese cliente.'],
    relacionadas: ['clientes_direcciones_listar', 'clientes_direccion_eliminar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'cliente_direccion', entidadId: d?.id ?? a.id }),
  async ejecutar(args, ctx, tx) {
    if (!(await verCliente(tx, ctx, args.clienteId))) return rechazo('no_encontrado', NO_EXISTE);
    if (args.id && !(await listarDirecciones(tx, ctx, args.clienteId)).some((d) => d.id === args.id)) {
      return rechazo('no_encontrado', 'No existe esa dirección en este cliente.');
    }
    const f = await guardarDireccion(tx, ctx, args.clienteId, args.id, {
      tipo: args.tipo,
      direccion: args.direccion.replace(/\s+/g, ' ').trim(),
      ciudad: textoOpcional(args.ciudad),
      departamento: textoOpcional(args.departamento),
      referencia: textoOpcional(args.referencia),
      esPrincipal: args.esPrincipal ?? false,
    });
    return f ? exito(aDireccionDto(f)) : rechazo('no_encontrado', 'No existe esa dirección en este cliente.');
  },
});

export const clientesDireccionEliminar = definirHerramienta('clientes_direccion_eliminar', {
  modulo: 'core',
  permiso: 'clientes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Quitar una dirección',
    paraQueSirve: 'Borra una dirección de la ficha del cliente o proveedor.',
    cuandoUsarla: 'Cuando ese local ya no existe o se cargó por error.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la dirección.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'quitar la dirección de Av. Industrial 450',
    ejemploHablado: 'borra esa dirección de entrega',
    erroresComunes: ['La dirección no existe o es de otra empresa.'],
    relacionadas: ['clientes_direcciones_listar'],
  },
  auditar: (a) => ({ entidadTipo: 'cliente_direccion', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    return (await eliminarDireccion(tx, ctx, args.id)) ? exito({ id: args.id }) : rechazo('no_encontrado', 'No existe esa dirección.');
  },
});

export const HERRAMIENTAS_DE_CLIENTES_AMPLIADOS = [
  clientesComercialVer,
  clientesComercialGuardar,
  clientesContactosListar,
  clientesContactoGuardar,
  clientesContactoEliminar,
  clientesDireccionesListar,
  clientesDireccionGuardar,
  clientesDireccionEliminar,
];
