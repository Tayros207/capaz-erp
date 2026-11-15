import { exito, rechazo } from '@capaz/shared';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { hayCupo, limiteDeUsuarios, puedeInvitarCon } from '../reglas.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { actorDe, aIso, bloquearMiembros, contratosDeLaEmpresa, miembrosDeLaVista } from './comunes.js';
import type { ContextoDeHerramienta } from '../../herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';

export const rutaDeInvitacion = (id: string) => `/invitacion/${id}`;

type Revision = { ok: true; correo: string } | { ok: false; codigo: 'sin_permiso' | 'conflicto' | 'argumentos_invalidos'; mensaje: string };

async function revisar(servicio: ServicioDeMiembros, ctx: ContextoDeHerramienta, tx: Transaccion, correoCrudo: string, rol: string): Promise<Revision> {
  const permitido = puedeInvitarCon({ actor: actorDe(ctx), rol });
  if (!permitido.ok) return { ok: false, codigo: permitido.codigo as 'sin_permiso', mensaje: permitido.mensaje };
  const correo = correoCrudo.trim().toLowerCase();
  if (await servicio.correoYaEsMiembro(ctx.empresaId, correo)) return { ok: false, codigo: 'conflicto', mensaje: 'Esa persona ya es miembro de la empresa.' };
  const ahora = Date.now();
  const pendientes = (await servicio.invitaciones(ctx.empresaId, true)).filter((i) => i.expiresAt.getTime() > ahora);
  if (pendientes.some((i) => i.email.toLowerCase() === correo)) return { ok: false, codigo: 'conflicto', mensaje: 'Esa persona ya tiene una invitación pendiente.' };
  const cupo = hayCupo({
    limite: limiteDeUsuarios(await contratosDeLaEmpresa(tx, ctx.empresaId)),
    miembros: (await miembrosDeLaVista(tx)).length,
    invitacionesPendientes: pendientes.length,
  });
  if (!cupo.ok) return { ok: false, codigo: cupo.codigo as 'conflicto', mensaje: cupo.mensaje };
  return { ok: true, correo };
}

export const crearInvitacionCrear = (servicio: ServicioDeMiembros) =>
  definirHerramienta('invitacion_crear', {
    modulo: 'core',
    permiso: 'miembros:gestionar',
    criticidad: 'critica',
    ayuda: {
      titulo: 'Invitar a una persona',
      paraQueSirve: 'Crea una invitación y su enlace. No se envía ningún correo: copias el enlace y se lo mandas tú.',
      cuandoUsarla: 'Cuando alguien nuevo va a trabajar en tu empresa.',
      campos: [
        { nombre: 'correo', queSeAnota: 'El correo con el que esa persona entrará.', ejemplo: 'ana@miempresa.pe' },
        { nombre: 'rol', queSeAnota: 'admin o member.', ejemplo: 'member' },
      ],
      ejemploTecleado: 'invitar a ana@miempresa.pe como miembro',
      ejemploHablado: 'invita a Ana a la empresa',
      erroresComunes: [
        'Esa persona ya es miembro o ya tiene una invitación pendiente.',
        'Tu contratación ya no tiene lugares libres.',
      ],
      relacionadas: ['invitaciones_listar', 'invitacion_anular'],
    },
    async resumir(args, ctx, tx) {
      const r = await revisar(servicio, ctx, tx, args.correo, args.rol);
      if (!r.ok) return { ok: false, error: { codigo: r.codigo, mensaje: r.mensaje } };
      return {
        ok: true,
        resumen: { resumen: `Invitarás a «${r.correo}» como ${args.rol}. Recibirás un enlace para enviárselo.`, huella: hashCanonico({ correo: r.correo, rol: args.rol }) },
      };
    },
    auditar: (args, datos) => ({ entidadTipo: 'invitacion', entidadId: datos?.id, resumen: { rol: args.rol } }),
    async ejecutar(args, ctx, tx) {
      await bloquearMiembros(tx, ctx.empresaId);
      const r = await revisar(servicio, ctx, tx, args.correo, args.rol);
      if (!r.ok) return rechazo(r.codigo, r.mensaje);
      const creada = await servicio.invitar(ctx.empresaId, r.correo, args.rol);
      if (!creada.ok) return creada;
      const { id, expiresAt, createdAt } = creada.datos;
      return exito({ id, correo: r.correo, rol: args.rol, estado: 'pending', expiraEn: aIso(expiresAt), creadaEn: aIso(createdAt), vencida: false, ruta: rutaDeInvitacion(id) });
    },
  });
