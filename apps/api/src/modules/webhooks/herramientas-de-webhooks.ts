import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { exito, rechazo } from '@capaz/shared';
import { AYUDAS } from '../../core/conectores/ayudas.js';
import { Cifrador } from '../../core/conectores/cifrado.js';
import { DestinoNoPermitido } from '../../core/conectores/destinos.js';
import { generarSecreto } from '../../core/conectores/firma.js';
import { CIFRADOR } from '../../core/conectores/tokens.js';
import { MAX_INTENTOS } from '../../core/eventos/relevo.js';
import { RegistroDeHerramientas } from '../../core/herramientas/registro.js';
import { definirHerramienta, type ContextoDeHerramienta, type HerramientaRegistrada } from '../../core/herramientas/tipos.js';
import { aadDeSecreto, EntregaDeWebhooks } from './entrega.js';
import * as repo from './repositorio.js';

const noExiste = () => rechazo('no_encontrado', 'No existe ese webhook.');
const sinClave = () => rechazo('sin_conexion', 'El servidor no tiene configurada la clave de cifrado de conexiones.');
const moduloInactivo = (ctx: ContextoDeHerramienta) => (ctx.modulos.find((m) => m.codigo === 'webhooks')?.puedeEscribir ? null : rechazo('modulo_no_disponible', 'Tu empresa no tiene activo el módulo «Webhooks y claves».'));
const cursorMalo = () => rechazo('argumentos_invalidos', 'El cursor no es válido.');

export function crearHerramientasDeWebhooks(entrega: EntregaDeWebhooks, cifrador: Cifrador | null): HerramientaRegistrada[] {
  const listar = definirHerramienta('webhooks_salientes_listar', {
    modulo: 'core',
    permiso: 'conexiones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.webhooksListar,
    async ejecutar(args, _ctx, tx) {
      const cursor = args.cursor ? repo.decodificarCursor(args.cursor) : null;
      if (args.cursor && !cursor) return cursorMalo();
      const { filas, siguiente } = await repo.listarSalientes(tx, args, cursor);
      return exito({ items: filas.map(repo.comoSaliente), siguiente });
    },
  });

  const crear = definirHerramienta('webhooks_salientes_crear', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.webhookCrear,
    auditar: (a, datos) => ({ entidadTipo: 'webhook_saliente', entidadId: datos?.id, resumen: { nombre: a.nombre } }),
    async ejecutar(args, ctx, tx) {
      const inactivo = moduloInactivo(ctx);
      if (inactivo) return inactivo;
      if (!cifrador) return sinClave();
      try {
        await entrega.validarDestino(args.url);
      } catch (error) {
        if (error instanceof DestinoNoPermitido) return rechazo('argumentos_invalidos', error.message);
        throw error;
      }
      const id = randomUUID();
      const secreto = generarSecreto();
      const s = cifrador.cifrar(secreto, aadDeSecreto(ctx.empresaId, id));
      const fila = await repo.insertarSaliente(tx, { id, nombre: args.nombre, url: args.url, eventos: args.eventos, secretoCifrado: s.cifrado, version: s.version, usuarioId: ctx.usuarioId });
      return exito({ ...repo.comoSaliente(fila), secreto });
    },
  });

  const editar = definirHerramienta('webhooks_salientes_editar', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.webhookEditar,
    auditar: (a) => ({ entidadTipo: 'webhook_saliente', entidadId: a.id, resumen: { rotoSecreto: a.rotarSecreto === true } }),
    async ejecutar(args, ctx, tx) {
      const actual = await repo.buscarSaliente(tx, args.id, true);
      if (!actual) return noExiste();
      if (args.url !== undefined) {
        try {
          await entrega.validarDestino(args.url);
        } catch (error) {
          if (error instanceof DestinoNoPermitido) return rechazo('argumentos_invalidos', error.message);
          throw error;
        }
      }
      let secreto: string | undefined;
      let cifrado: { cifrado: string; version: number } | undefined;
      if (args.rotarSecreto) {
        if (!cifrador) return sinClave();
        secreto = generarSecreto();
        cifrado = cifrador.cifrar(secreto, aadDeSecreto(ctx.empresaId, args.id));
      }
      const fila = await repo.editarSaliente(tx, args.id, { nombre: args.nombre, url: args.url, eventos: args.eventos, activo: args.activo, secreto: cifrado });
      return fila ? exito({ ...repo.comoSaliente(fila), ...(secreto && { secreto }) }) : noExiste();
    },
  });

  const archivar = definirHerramienta('webhooks_salientes_archivar', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.webhookArchivar,
    auditar: (a) => ({ entidadTipo: 'webhook_saliente', entidadId: a.id }),
    async ejecutar(args, _ctx, tx) {
      const fila = await repo.editarSaliente(tx, args.id, { activo: false });
      return fila ? exito(repo.comoSaliente(fila)) : noExiste();
    },
  });

  const envios = definirHerramienta('webhook_envios_listar', {
    modulo: 'core',
    permiso: 'conexiones:ver',
    criticidad: 'lectura',
    ayuda: AYUDAS.enviosListar,
    async ejecutar(args, _ctx, tx) {
      const cursor = args.cursor ? repo.decodificarCursor(args.cursor) : null;
      if (args.cursor && !cursor) return cursorMalo();
      const { filas, siguiente } = await repo.listarEnvios(tx, args, cursor);
      return exito({ items: filas.map(repo.comoEnvio), siguiente });
    },
  });

  const reintentar = definirHerramienta('webhook_envio_reintentar', {
    modulo: 'core',
    permiso: 'conexiones:gestionar',
    criticidad: 'normal',
    ayuda: AYUDAS.envioReintentar,
    auditar: (a) => ({ entidadTipo: 'webhook_envio', entidadId: a.id }),
    async ejecutar(args, ctx, tx) {
      const envio = await repo.buscarEnvio(tx, args.id, true);
      if (!envio) return rechazo('no_encontrado', 'No existe ese envío.');
      if (envio.estado === 'enviado') return rechazo('conflicto', 'Ese envío ya se realizó: no se repite.');
      const s = await repo.buscarSaliente(tx, envio.webhook_id);
      const evento = await repo.cargaDeEvento(tx, envio.evento_id);
      if (!s) return noExiste();
      if (!evento) return rechazo('conflicto', 'El evento original ya no está disponible: no se puede reintentar.');
      await repo.reiniciarEnvio(tx, envio.id);
      const r = await entrega.enviar(s, ctx.empresaId, { id: envio.id, eventoId: envio.evento_id, tipo: envio.tipo, carga: evento.carga, creadoEn: evento.creadoEn });
      return exito(repo.comoEnvio(await repo.registrarIntento(tx, { id: envio.id, webhookId: s.id }, r, MAX_INTENTOS)));
    },
  });

  return [listar, crear, editar, archivar, envios, reintentar];
}

@Injectable()
export class HerramientasDeWebhooks implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EntregaDeWebhooks) private readonly entrega: EntregaDeWebhooks,
    @Optional() @Inject(CIFRADOR) private readonly cifrador: Cifrador | null,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeWebhooks(this.entrega, this.cifrador ?? null));
  }
}
