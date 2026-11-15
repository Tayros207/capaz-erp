import { exito, rechazo, type Respuesta } from '@capaz/shared';
import { hashCanonico } from '../../herramientas/confirmacion.js';
import { definirHerramienta, type ResultadoDeResumen } from '../../herramientas/tipos.js';
import type { ContextoDeHerramienta } from '../../herramientas/tipos.js';
import { esRol, puedeCambiarRol, type Rol, type Veredicto } from '../reglas.js';
import type { ServicioDeMiembros } from '../miembros.service.js';
import { actorDe, bloquearMiembros, miembrosDeLaVista } from './comunes.js';

type Cambio = { objetivo: { id: string; rol: string; nombre: string }; propietarios: number };

/** Lee a quien se cambia y valida la regla; lo usan el resumen y la ejecución (esta última ya con el cierre puesto). */
async function evaluar(
  servicio: ServicioDeMiembros,
  ctx: ContextoDeHerramienta,
  personaId: string,
  rol: Rol,
  nombreDe: (id: string) => Promise<string>,
): Promise<{ veredicto: Veredicto; cambio?: Cambio }> {
  const objetivo = await servicio.miembroDe(ctx.empresaId, personaId);
  if (!objetivo) return { veredicto: { ok: false, codigo: 'no_encontrado', mensaje: 'Esa persona no es miembro de la empresa.' } };
  const propietarios = await servicio.propietarios(ctx.empresaId);
  const veredicto = puedeCambiarRol({ actor: actorDe(ctx), objetivo: { usuarioId: personaId, rol: objetivo.role }, nuevoRol: rol, propietarios });
  return { veredicto, cambio: { objetivo: { id: objetivo.id, rol: objetivo.role, nombre: await nombreDe(personaId) }, propietarios } };
}

export const crearMiembroCambiarRol = (servicio: ServicioDeMiembros) =>
  definirHerramienta('miembro_cambiar_rol', {
    modulo: 'core',
    permiso: 'miembros:gestionar',
    criticidad: 'critica',
    ayuda: {
      titulo: 'Cambiar el rol de una persona',
      paraQueSirve: 'Convierte a una persona en propietario, administrador o miembro de la empresa.',
      cuandoUsarla: 'Cuando alguien asume más responsabilidad o deja de administrar.',
      campos: [
        { nombre: 'personaId', queSeAnota: 'La persona (la sacas de la lista de miembros).', ejemplo: 'a1b2c3' },
        { nombre: 'rol', queSeAnota: 'owner, admin o member.', ejemplo: 'admin' },
      ],
      ejemploTecleado: 'hacer administradora a Ana',
      ejemploHablado: 'que Ana sea administradora',
      erroresComunes: [
        'No se puede degradar al último propietario.',
        'Un administrador no puede cambiar el rol de un propietario.',
      ],
      relacionadas: ['miembros_listar', 'miembro_quitar'],
    },
    async resumir(args, ctx, tx): Promise<ResultadoDeResumen> {
      const nombreDe = async (id: string) => (await miembrosDeLaVista(tx)).find((m) => m.usuario_id === id)?.nombre ?? 'la persona';
      const { veredicto, cambio } = await evaluar(servicio, ctx, args.personaId, args.rol, nombreDe);
      if (!veredicto.ok || !cambio) {
        const v = veredicto.ok ? { codigo: 'no_encontrado' as const, mensaje: 'No existe esa persona.' } : veredicto;
        return { ok: false, error: { codigo: v.codigo, mensaje: v.mensaje } };
      }
      return {
        ok: true,
        resumen: {
          resumen: `Cambiarás el rol de «${cambio.objetivo.nombre}» de ${cambio.objetivo.rol} a ${args.rol}.`,
          huella: hashCanonico({ rol: cambio.objetivo.rol, propietarios: cambio.propietarios }),
        },
      };
    },
    auditar: (args) => ({ entidadTipo: 'miembro', entidadId: args.personaId, resumen: { rolNuevo: args.rol } }),
    async ejecutar(args, ctx, tx): Promise<Respuesta<{ personaId: string; rol: string }>> {
      await bloquearMiembros(tx, ctx.empresaId);
      const { veredicto, cambio } = await evaluar(servicio, ctx, args.personaId, args.rol, async () => '');
      if (!veredicto.ok) return rechazo(veredicto.codigo, veredicto.mensaje);
      if (!cambio || !esRol(args.rol)) return rechazo('no_encontrado', 'No existe esa persona.');
      const r = await servicio.cambiarRol(ctx.empresaId, cambio.objetivo.id, args.rol);
      return r.ok ? exito({ personaId: args.personaId, rol: args.rol }) : r;
    },
  });
