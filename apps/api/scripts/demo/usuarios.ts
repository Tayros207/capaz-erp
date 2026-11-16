import { CLAVE_DEMO, CORREO_DEMO, soltarLimiteDeAcceso, type Entorno } from './entorno.ts';
import { Sesion } from './http.ts';
import type { Ctx } from './contexto.ts';
import { seccion } from './contexto.ts';

export const correoDe = (clave: string, sector: string): string => `${clave}.${sector}${CORREO_DEMO}`;

const lista = (r: any): any[] => (Array.isArray(r) ? r : (r?.invitaciones ?? r?.items ?? []));

/** Usuarios de la empresa con roles y módulos distintos, por el flujo real: invitación + aceptación + asignación. */
export async function sembrarUsuarios(c: Ctx, env: Entorno): Promise<void> {
  await seccion(c, 'usuarios', async () => {
    for (const u of c.sec.usuarios.filter((x) => x.rol !== 'owner')) {
      const correo = correoDe(u.clave, c.sec.clave);
      let { miembros } = await c.s.herramienta('miembros_listar');
      if (!miembros.some((m: any) => m.correo === correo)) {
        const sesion = new Sesion(env.api, env.origen, () => soltarLimiteDeAcceso(env));
        await sesion.entrar(u.nombre, correo, CLAVE_DEMO);
        await c.s.herramienta('invitacion_crear', { correo, rol: u.rol === 'admin' ? 'admin' : 'member' });
        const inv = lista(await c.s.herramienta('invitaciones_listar')).find((i: any) => i.correo === correo && i.estado === 'pending');
        if (!inv) throw new Error(`No aparece la invitación de ${correo}.`);
        const r = await sesion.auth('/organization/accept-invitation', { invitationId: inv.id });
        if (r.estado !== 200) throw new Error(`La invitación de ${correo} no se aceptó: ${r.estado} ${JSON.stringify(r.json).slice(0, 160)}`);
        ({ miembros } = await c.s.herramienta('miembros_listar'));
      }
      const persona = miembros.find((m: any) => m.correo === correo);
      if (u.rol === 'admin') continue; // los administradores ya entran a todo lo contratado
      for (const [modulo, nivel] of Object.entries(u.modulos)) {
        if (!['activo', 'prueba'].includes(c.estados.get(modulo) ?? '')) continue;
        await c.s.herramienta('miembro_asignar_modulo', { personaId: persona.personaId, modulo, nivel, alcance: 'todos' });
      }
    }
  });
}
