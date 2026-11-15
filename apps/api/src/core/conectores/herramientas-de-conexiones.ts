import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { exito, rechazo, type Conector } from '@capaz/shared';
import { Cifrador } from './cifrado.js';
import { CIFRADOR } from './tokens.js';
import { generarClaveDeApi } from './firma.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type ContextoDeHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { AYUDAS } from './ayudas.js';
import * as repo from './repositorio.js';
import { RegistroDeConectores } from './registro-de-conectores.js';


const noExisteConector = () => rechazo('no_encontrado', 'No existe ese conector.');
const sinConexion = () => rechazo('no_encontrado', 'Aún no configuraste esa conexión.');
const sinClave = () => rechazo('sin_conexion', 'El servidor no tiene configurada la clave de cifrado de conexiones.');
const puedeUsar = (ctx: ContextoDeHerramienta, codigo: string) => ctx.modulos.find((m) => m.codigo === codigo)?.puedeEscribir === true;

/** Solo rutas y mensajes de zod: nunca los valores recibidos (pueden ser secretos). */
const problemasDe = (r: { error: { issues: readonly { path: PropertyKey[]; message: string }[] } }) =>
  r.error.issues.map((i) => `${i.path.map(String).join('.') || 'valor'}: ${i.message}`).join('; ');

const aad = (empresaId: string, conector: string) => `conexion:${empresaId}:${conector}`;

export type DependenciasDeConexiones = { conectores: RegistroDeConectores; cifrador: Cifrador | null };

export function crearHerramientasDeConexiones(d: DependenciasDeConexiones): HerramientaRegistrada[] {
  const listar = definirHerramienta('conectores_listar', {
    modulo: 'core',
    permiso: 'conexiones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.conectoresListar,
    async ejecutar(_args, ctx, tx) {
      const estados = await repo.estadosDeConexiones(tx);
      const items: Conector[] = d.conectores.todos().map((m) => ({
        codigo: m.codigo,
        nombre: m.nombre,
        descripcion: m.descripcion,
        version: m.version,
        capacidades: [...m.capacidades],
        autenticacion: m.autenticacion,
        moduloActivo: puedeUsar(ctx, m.codigo),
        estado: estados.get(m.codigo) ?? null,
      }));
      return exito({ items });
    },
  });

  const ver = definirHerramienta('conexion_ver', {
    modulo: 'core',
    permiso: 'conexiones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.conexionVer,
    async ejecutar(args, _ctx, tx) {
      if (!d.conectores.obtener(args.conector)) return noExisteConector();
      const f = await repo.buscarConexion(tx, args.conector);
      return f ? exito(repo.comoConexion(f)) : sinConexion();
    },
  });

  const configurar = definirHerramienta('conexion_configurar', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'critica',
    ayuda: AYUDAS.conexionConfigurar,
    auditar: (a) => ({ entidadTipo: 'conexion', entidadId: a.conector, resumen: { conector: a.conector, conCredenciales: a.credenciales !== undefined } }),
    async resumir(args, ctx, tx) {
      const m = d.conectores.obtener(args.conector);
      if (!m) return { ok: false, error: { codigo: 'no_encontrado', mensaje: 'No existe ese conector.' } };
      const actual = await repo.buscarConexion(tx, args.conector);
      const huella = actual ? `${new Date(actual.actualizado_en).toISOString()}|${actual.estado}` : 'nueva';
      const cambia = args.credenciales ? ' Se reemplazarán sus credenciales (cifradas).' : '';
      return { ok: true, resumen: { resumen: `${actual ? 'Actualizar' : 'Crear'} la conexión con «${m.nombre}».${cambia}`, huella } };
    },
    async ejecutar(args, ctx, tx) {
      const m = d.conectores.obtener(args.conector);
      if (!m) return noExisteConector();
      if (!puedeUsar(ctx, m.codigo)) return rechazo('modulo_no_disponible', `Tu empresa no tiene activo el módulo «${m.nombre}».`);
      const config = m.configuracion.safeParse(args.configuracion);
      if (!config.success) return rechazo('argumentos_invalidos', `La configuración no es válida (${problemasDe(config)}).`);
      let credenciales: { cifrado: string; version: number } | undefined;
      if (args.credenciales !== undefined) {
        if (m.autenticacion === 'ninguna') return rechazo('argumentos_invalidos', 'Este conector no usa credenciales.');
        const cred = m.credenciales.safeParse(args.credenciales);
        if (!cred.success) return rechazo('argumentos_invalidos', `Las credenciales no son válidas (${problemasDe(cred)}).`);
        if (!d.cifrador) return sinClave();
        credenciales = d.cifrador.cifrar(JSON.stringify(cred.data), aad(ctx.empresaId, m.codigo));
      }
      const previa = await repo.buscarConexion(tx, m.codigo, true);
      const tendraCredenciales = credenciales !== undefined || previa?.tiene_credenciales === true;
      const estado = m.autenticacion === 'ninguna' || tendraCredenciales ? 'activa' : 'pendiente';
      const f = await repo.guardarConexion(tx, {
        conector: m.codigo,
        estado,
        configuracion: config.data as Record<string, unknown>,
        credenciales,
        usuarioId: ctx.usuarioId,
      });
      return exito(repo.comoConexion(f));
    },
  });

  const desactivar = definirHerramienta('conexion_desactivar', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.conexionDesactivar,
    auditar: (a) => ({ entidadTipo: 'conexion', entidadId: a.conector }),
    async ejecutar(args, _ctx, tx) {
      if (!d.conectores.obtener(args.conector)) return noExisteConector();
      const f = await repo.desactivarConexion(tx, args.conector);
      return f ? exito(repo.comoConexion(f)) : sinConexion();
    },
  });

  return [listar, ver, configurar, desactivar, ...crearHerramientasDeClaves()];
}

function crearHerramientasDeClaves(): HerramientaRegistrada[] {
  const listar = definirHerramienta('claves_api_listar', {
    modulo: 'core',
    permiso: 'conexiones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.clavesListar,
    async ejecutar(_args, _ctx, tx) {
      return exito({ items: (await repo.listarClaves(tx)).map(repo.comoClave) });
    },
  });

  const crear = definirHerramienta('clave_api_crear', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.claveCrear,
    // Sin la clave: solo el nombre y el alcance.
    auditar: (a, datos) => ({ entidadTipo: 'clave_api', entidadId: datos?.id, resumen: { nombre: a.nombre } }),
    async ejecutar(args, ctx, tx) {
      const nueva = generarClaveDeApi();
      const f = await repo.insertarClave(tx, { hash: nueva.hash, nombre: args.nombre, prefijo: nueva.prefijo, alcance: args.alcance, usuarioId: ctx.usuarioId });
      return exito({ ...repo.comoClave(f), clave: nueva.clave });
    },
  });

  const revocar = definirHerramienta('clave_api_revocar', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'critica',
    ayuda: AYUDAS.claveRevocar,
    auditar: (a) => ({ entidadTipo: 'clave_api', entidadId: a.id }),
    async resumir(args, _ctx, tx) {
      const f = await repo.buscarClave(tx, args.id);
      if (!f) return { ok: false, error: { codigo: 'no_encontrado', mensaje: 'No existe esa clave.' } };
      return { ok: true, resumen: { resumen: `Revocar la clave «${f.nombre}»: quien la use dejará de poder enviar datos.`, huella: String(f.revocada_en) } };
    },
    async ejecutar(args, _ctx, tx) {
      const f = await repo.revocarClave(tx, args.id);
      return f ? exito(repo.comoClave(f)) : rechazo('no_encontrado', 'No existe esa clave.');
    },
  });

  return [listar, crear, revocar];
}

@Injectable()
export class HerramientasDeConexiones implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(RegistroDeConectores) private readonly conectores: RegistroDeConectores,
    @Optional() @Inject(CIFRADOR) private readonly cifrador: Cifrador | null,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeConexiones({ conectores: this.conectores, cifrador: this.cifrador ?? null }));
  }
}
