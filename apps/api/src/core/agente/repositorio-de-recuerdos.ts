import { sql } from 'drizzle-orm';
import type { CoincidenciaDeConversacion } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// Buscar en los chats anteriores de ESTA persona. La privacidad la hace la base (política «solo_propias» de las conversaciones y los
// mensajes): aquí no se filtra por persona porque ni siquiera se puede ver lo de otra. Solo mensajes que terminaron.

const FRAGMENTOS_POR_CONVERSACION = 3;
const LARGO_DEL_FRAGMENTO = 260;
const FILAS_A_REVISAR = 80;

type Fila = { conversacion_id: string; titulo: string; rol: string; contenido: string; creado_en: string | Date };

/** Escapa lo que significa algo en un `like` (% _ \) para que lo que la persona escribió se busque tal cual. */
export const comoPatron = (texto: string): string => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Un trozo del mensaje alrededor de lo buscado (o el principio, si no se busca nada). */
export function fragmentoDe(contenido: string, texto: string | null): string {
  const limpio = contenido.replace(/\s+/g, ' ').trim();
  if (limpio.length <= LARGO_DEL_FRAGMENTO) return limpio;
  const i = texto ? limpio.toLowerCase().indexOf(texto.toLowerCase()) : -1;
  const desde = i < 0 ? 0 : Math.max(0, i - Math.floor(LARGO_DEL_FRAGMENTO / 3));
  const trozo = limpio.slice(desde, desde + LARGO_DEL_FRAGMENTO);
  return `${desde > 0 ? '…' : ''}${trozo}${desde + LARGO_DEL_FRAGMENTO < limpio.length ? '…' : ''}`;
}

const aTexto = (f: string | Date): string => (f instanceof Date ? f.toISOString() : new Date(f).toISOString());

export async function buscarEnConversaciones(tx: Transaccion, p: { texto: string | null; limite: number }): Promise<CoincidenciaDeConversacion[]> {
  const filtro = p.texto ? sql`and m.contenido ilike ${comoPatron(p.texto)} escape '\\'` : sql``;
  const r = await tx.execute<Fila>(sql`
    select m.conversacion_id, c.titulo, m.rol, m.contenido, m.creado_en
    from core.agente_mensajes m
    join core.agente_conversaciones c on c.tenant_id = m.tenant_id and c.usuario_id = m.usuario_id and c.id = m.conversacion_id
    where m.estado in ('completo', 'interrumpido') and m.contenido <> '' ${filtro}
    order by m.creado_en desc
    limit ${FILAS_A_REVISAR}`);
  const porConversacion = new Map<string, CoincidenciaDeConversacion>();
  for (const f of r.rows) {
    let c = porConversacion.get(f.conversacion_id);
    if (!c) {
      if (porConversacion.size >= p.limite) continue;
      c = { conversacionId: f.conversacion_id, titulo: f.titulo, fecha: aTexto(f.creado_en), fragmentos: [] };
      porConversacion.set(f.conversacion_id, c);
    }
    // Sin búsqueda («¿qué hablamos últimamente?») basta lo más reciente de cada chat.
    const maximo = p.texto ? FRAGMENTOS_POR_CONVERSACION : 1;
    if (c.fragmentos.length < maximo) c.fragmentos.push({ rol: f.rol === 'persona' ? 'persona' : 'agente', fecha: aTexto(f.creado_en), texto: fragmentoDe(f.contenido, p.texto) });
  }
  return [...porConversacion.values()];
}
