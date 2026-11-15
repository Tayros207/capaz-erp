import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { normalizarNombre } from '../domain/normalizacion.js';
import { buscarClientes, listarClientes, verCliente } from '../repositories/clientes.repository.js';
import { aClienteDto } from './cliente-mapeo.js';

export const clientesListar = definirHerramienta('clientes_listar', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar clientes',
    paraQueSirve: 'Muestra los clientes y proveedores de tu empresa, por orden alfabético y por páginas.',
    cuandoUsarla: 'Cuando quieras recorrer la lista completa o ver los archivados.',
    campos: [
      { nombre: 'estado', queSeAnota: 'activos, archivados o todos (por defecto, activos).', ejemplo: 'activos' },
      { nombre: 'limite', queSeAnota: 'Cuántos por página, hasta 100.', ejemplo: '25' },
    ],
    ejemploTecleado: 'ver mis clientes',
    ejemploHablado: 'muéstrame los clientes',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['clientes_buscar', 'clientes_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarClientes(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    return exito({ items: r.items.map(aClienteDto), siguiente: r.siguiente });
  },
});

export const clientesVer = definirHerramienta('clientes_ver', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un cliente',
    paraQueSirve: 'Muestra todos los datos de un cliente o proveedor.',
    cuandoUsarla: 'Cuando necesitas su documento, teléfono, dirección o notas.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del cliente.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }],
    ejemploTecleado: 'ver el cliente José Pérez',
    ejemploHablado: 'abre la ficha de José Pérez',
    erroresComunes: ['El cliente no existe o es de otra empresa.'],
    relacionadas: ['clientes_buscar', 'clientes_editar'],
  },
  async ejecutar(args, ctx, tx) {
    const f = await verCliente(tx, ctx, args.id);
    return f ? exito(aClienteDto(f)) : rechazo('no_encontrado', 'No existe ese cliente.');
  },
});

export const clientesBuscar = definirHerramienta('clientes_buscar', {
  modulo: 'core',
  permiso: 'clientes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Buscar clientes por parecido',
    paraQueSirve: 'Encuentra los clientes cuyo nombre se parece al texto, sin importar tildes ni mayúsculas.',
    cuandoUsarla: 'Cuando alguien menciona a un cliente y hay que saber si ya existe.',
    campos: [
      { nombre: 'texto', queSeAnota: 'Parte del nombre.', ejemplo: 'jose perez' },
      { nombre: 'limite', queSeAnota: 'Cuántos candidatos, hasta 20 (por defecto 5).', ejemplo: '5' },
    ],
    ejemploTecleado: 'buscar cliente jose perez',
    ejemploHablado: 'busca a José Pérez entre mis clientes',
    erroresComunes: ['Sin resultados: prueba con menos letras o créalo.'],
    relacionadas: ['clientes_crear', 'clientes_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const texto = normalizarNombre(args.texto);
    if (!texto) return rechazo('argumentos_invalidos', 'Escribe qué buscar.');
    const filas = await buscarClientes(tx, ctx, texto, args.limite);
    return exito({ items: filas.map((f) => ({ ...aClienteDto(f), parecido: Number(f.parecido) })) });
  },
});
