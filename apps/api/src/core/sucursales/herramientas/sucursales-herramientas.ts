import { exito, rechazo, type SucursalDto } from '@capaz/shared';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { prepararSucursal } from '../domain/sucursal.js';
import {
  archivarSucursal,
  crearSucursal,
  editarSucursal,
  listarSucursales,
  marcarPrincipal,
  verSucursal,
  type Sucursal,
} from '../repositories/sucursales.repository.js';

export const aSucursalDto = (f: Sucursal): SucursalDto => ({
  id: f.id,
  codigo: f.codigo,
  nombre: f.nombre,
  direccion: f.direccion,
  telefono: f.telefono,
  esPrincipal: f.esPrincipal,
  archivadoEn: f.archivadoEn?.toISOString() ?? null,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

const NO_EXISTE = 'No existe esa sucursal.';
const AUDITAR = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'sucursal', entidadId: d?.id });
const ID = { nombre: 'id', queSeAnota: 'Identificador de la sucursal.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000003' };

export const sucursalesListar = definirHerramienta('sucursales_listar', {
  modulo: 'core',
  permiso: 'sucursales:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar sucursales',
    paraQueSirve: 'Muestra los locales de tu empresa, con la principal primero.',
    cuandoUsarla: 'Cuando quieras ver o elegir una sucursal.',
    campos: [{ nombre: 'incluirArchivadas', queSeAnota: 'Si es verdadero, también las archivadas.', ejemplo: 'false' }],
    ejemploTecleado: 'ver mis sucursales',
    ejemploHablado: 'qué sucursales tengo',
    erroresComunes: ['Tu empresa todavía no terminó de prepararse: vuelve a intentarlo en unos segundos.'],
    relacionadas: ['sucursal_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const filas = await listarSucursales(tx, ctx, { incluirArchivadas: args.incluirArchivadas });
    return exito({ items: filas.map(aSucursalDto), siguiente: null });
  },
});

export const sucursalCrear = definirHerramienta('sucursal_crear', {
  modulo: 'core',
  permiso: 'sucursales:gestionar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Crear una sucursal',
    paraQueSirve: 'Agrega un local. Su código (2 a 6 letras o cifras) identifica la serie de sus documentos.',
    cuandoUsarla: 'Cuando abres un local nuevo.',
    campos: [
      { nombre: 'codigo', queSeAnota: 'Código corto y único.', ejemplo: 'SUR' },
      { nombre: 'nombre', queSeAnota: 'Nombre del local.', ejemplo: 'Tienda Sur' },
      { nombre: 'direccion', queSeAnota: 'Dirección (opcional).', ejemplo: 'Av. Sur 123' },
    ],
    ejemploTecleado: 'crear sucursal SUR llamada Tienda Sur',
    ejemploHablado: 'abre una sucursal nueva, Tienda Sur, con código SUR',
    erroresComunes: ['Ya existe una sucursal con ese código.', 'El código tiene de 2 a 6 letras o cifras.'],
    relacionadas: ['sucursales_listar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const p = prepararSucursal(args);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const r = await crearSucursal(tx, ctx, p.datos);
    if (!r.creada) return rechazo('conflicto', `Ya existe la sucursal «${r.existente.nombre}» con el código ${r.existente.codigo}.`, [{ id: r.existente.id, nombre: r.existente.nombre, detalle: r.existente.codigo }]);
    return exito(aSucursalDto(r.sucursal));
  },
});

export const sucursalEditar = definirHerramienta('sucursal_editar', {
  modulo: 'core',
  permiso: 'sucursales:gestionar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar una sucursal',
    paraQueSirve: 'Cambia el nombre, la dirección o el teléfono. El código no cambia.',
    cuandoUsarla: 'Cuando el local se muda o cambia de nombre.',
    campos: [ID, { nombre: 'nombre', queSeAnota: 'Nombre nuevo.', ejemplo: 'Tienda Sur 2' }],
    ejemploTecleado: 'cambiar la dirección de la sucursal SUR',
    ejemploHablado: 'la tienda sur ahora está en Av. Sur 456',
    erroresComunes: ['Hay que indicar al menos un dato.', 'La sucursal no existe o es de otra empresa.'],
    relacionadas: ['sucursales_listar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const actual = await verSucursal(tx, ctx, args.id);
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const p = prepararSucursal({
      codigo: actual.codigo,
      nombre: args.nombre ?? actual.nombre,
      direccion: args.direccion !== undefined ? args.direccion : actual.direccion,
      telefono: args.telefono !== undefined ? args.telefono : actual.telefono,
    });
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const f = await editarSucursal(tx, ctx, args.id, p.datos);
    return f ? exito(aSucursalDto(f)) : rechazo('no_encontrado', NO_EXISTE);
  },
});

export const sucursalArchivar = definirHerramienta('sucursal_archivar', {
  modulo: 'core',
  permiso: 'sucursales:gestionar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una sucursal',
    paraQueSirve: 'Oculta un local que ya no se usa. La sucursal principal no se archiva.',
    cuandoUsarla: 'Cuando cierras un local.',
    campos: [ID],
    ejemploTecleado: 'archivar la sucursal SUR',
    ejemploHablado: 'cierra la tienda sur',
    erroresComunes: ['La sucursal principal no se archiva: marca otra como principal primero.'],
    relacionadas: ['sucursal_marcar_principal'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const r = await archivarSucursal(tx, ctx, args.id);
    if (r === null) return rechazo('no_encontrado', NO_EXISTE);
    if (r === 'es_principal') return rechazo('conflicto', 'La sucursal principal no se archiva: marca otra como principal primero.');
    return exito(aSucursalDto(r));
  },
});

export const sucursalMarcarPrincipal = definirHerramienta('sucursal_marcar_principal', {
  modulo: 'core',
  permiso: 'sucursales:gestionar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Marcar la sucursal principal',
    paraQueSirve: 'Cambia cuál es la sucursal principal de la empresa.',
    cuandoUsarla: 'Cuando tu local principal pasa a ser otro.',
    campos: [ID],
    ejemploTecleado: 'marcar la sucursal SUR como principal',
    ejemploHablado: 'que la tienda sur sea la principal',
    erroresComunes: ['No se puede marcar una sucursal archivada.'],
    relacionadas: ['sucursales_listar'],
  },
  auditar: AUDITAR,
  async resumir(args, ctx, tx) {
    const destino = await verSucursal(tx, ctx, args.id);
    if (!destino) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE } };
    const actual = (await listarSucursales(tx, ctx, { incluirArchivadas: true })).find((s) => s.esPrincipal);
    return {
      ok: true,
      resumen: {
        resumen: `La sucursal principal pasará de «${actual?.nombre ?? 'ninguna'}» a «${destino.nombre}».`,
        huella: hashCanonico({ destino: destino.id, archivada: destino.archivadoEn !== null, principal: actual?.id ?? null }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const r = await marcarPrincipal(tx, ctx, args.id);
    if (r === null) return rechazo('no_encontrado', NO_EXISTE);
    if (r === 'archivada') return rechazo('conflicto', 'No se puede marcar como principal una sucursal archivada.');
    return exito(aSucursalDto(r));
  },
});
