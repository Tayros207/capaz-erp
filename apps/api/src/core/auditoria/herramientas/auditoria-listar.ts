import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { exito, rechazo, type EventoDeAuditoria } from '@capaz/shared';
import { auditoria } from '../../../db/esquema/core-herramientas.js';
import { definirHerramienta } from '../../herramientas/tipos.js';

const FORMA_DE_CURSOR = /^(.+)\|([0-9a-f-]{36})$/;

const codificar = (instante: string, id: string) => Buffer.from(`${instante}|${id}`).toString('base64url');

function decodificar(cursor: string): { instante: string; id: string } | null {
  const m = FORMA_DE_CURSOR.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

export const auditoriaListar = definirHerramienta('auditoria_listar', {
  modulo: 'core',
  permiso: 'auditoria:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver el registro de actividad',
    paraQueSirve: 'Lista lo que se hizo en tu empresa: quién, cuándo, con qué herramienta y si se pudo.',
    cuandoUsarla: 'Cuando quieras saber quién cambió algo o por qué una operación fue rechazada.',
    campos: [
      { nombre: 'herramienta', queSeAnota: 'Solo las de una herramienta (opcional).', ejemplo: 'empresa_actualizar_configuracion' },
      { nombre: 'resultado', queSeAnota: 'ok, rechazada o pendiente_confirmacion (opcional).', ejemplo: 'rechazada' },
      { nombre: 'limite', queSeAnota: 'Cuántos registros por página, hasta 100.', ejemplo: '25' },
    ],
    ejemploTecleado: 'ver la actividad de hoy',
    ejemploHablado: 'qué se hizo hoy en la empresa',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: [],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificar(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const filtros: (SQL | undefined)[] = [
      eq(auditoria.tenantId, ctx.empresaId),
      args.herramienta ? eq(auditoria.herramienta, args.herramienta) : undefined,
      args.entidadTipo ? eq(auditoria.entidadTipo, args.entidadTipo) : undefined,
      args.entidadId ? eq(auditoria.entidadId, args.entidadId) : undefined,
      args.resultado ? eq(auditoria.resultado, args.resultado) : undefined,
      cursor
        ? sql`(${auditoria.creadoEn}, ${auditoria.id}) < (${cursor.instante}::timestamptz, ${cursor.id}::uuid)`
        : undefined,
    ];
    const filas = await tx
      .select({ fila: auditoria, instante: sql<string>`${auditoria.creadoEn}::text` })
      .from(auditoria)
      .where(and(...filtros))
      .orderBy(desc(auditoria.creadoEn), desc(auditoria.id))
      .limit(args.limite + 1);
    const pagina = filas.slice(0, args.limite);
    const ultima = pagina.at(-1);
    return exito({
      items: pagina.map(({ fila: f }): EventoDeAuditoria => ({
        id: f.id,
        usuarioId: f.usuarioId,
        modulo: f.modulo,
        herramienta: f.herramienta,
        canal: f.canal,
        resultado: f.resultado as EventoDeAuditoria['resultado'],
        codigo: f.codigo,
        entidadTipo: f.entidadTipo,
        entidadId: f.entidadId,
        resumen: (f.resumen ?? {}) as Record<string, unknown>,
        requestId: f.requestId,
        duracionMs: f.duracionMs,
        creadoEn: f.creadoEn.toISOString(),
      })),
      siguiente: filas.length > args.limite && ultima ? codificar(ultima.instante, ultima.fila.id) : null,
    });
  },
});
