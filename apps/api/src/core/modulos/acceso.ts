import type { AccesoDeModulo, EstadoDeContratacion, ManifiestoDeModulo } from '@capaz/shared';

// Regla pura de acceso a un módulo (portada de `navegacion.ts` de Cotizín, adaptada a ADR-011):
// cruza lo que la EMPRESA contrató con lo que su administrador ASIGNÓ a la persona.
//  - `owner` y `admin` entran a todo módulo contratado con nivel completo.
//  - `member` solo entra a lo que tiene asignado, con el nivel y el alcance asignados.
//  - Baja, prueba vencida y suspensión dejan el módulo en solo lectura; nunca se borra nada.
//  - `core` está siempre activo y no se contrata.

export type Contratacion = { modulo: string; estado: EstadoDeContratacion; pruebaHasta: Date | null };
export type Asignacion = { modulo: string; nivel: 'completo' | 'lectura'; alcance: 'todos' | 'propios' };

const MS_POR_DIA = 86_400_000;
const esAdministrador = (rol: string | null) => rol === 'owner' || rol === 'admin';

type Vigencia = { motivo: AccesoDeModulo['motivo']; escribe: boolean; entra: boolean; dias: number | null };

function vigenciaDe(c: Contratacion | undefined, ahora: Date): Vigencia {
  if (!c) return { motivo: 'no_contratado', escribe: false, entra: false, dias: null };
  switch (c.estado) {
    case 'activo':
      return { motivo: 'activo', escribe: true, entra: true, dias: null };
    case 'suspendido':
      return { motivo: 'suspendido', escribe: false, entra: true, dias: null };
    case 'baja':
      return { motivo: 'baja_solo_lectura', escribe: false, entra: true, dias: null };
    case 'prueba': {
      // Igual que `core.modulo_activo`: la prueba vale solo mientras `prueba_hasta` sea futura.
      if (c.pruebaHasta && c.pruebaHasta.getTime() > ahora.getTime()) {
        return { motivo: 'prueba', escribe: true, entra: true, dias: Math.ceil((c.pruebaHasta.getTime() - ahora.getTime()) / MS_POR_DIA) };
      }
      return { motivo: 'baja_solo_lectura', escribe: false, entra: true, dias: null };
    }
  }
}

export function accesoAModulo(entrada: {
  manifiesto: Pick<ManifiestoDeModulo, 'codigo'>;
  rol: string | null;
  contratacion: Contratacion | undefined;
  asignacion: Asignacion | undefined;
  ahora?: Date;
}): AccesoDeModulo {
  const { manifiesto, rol, contratacion, asignacion } = entrada;
  const ahora = entrada.ahora ?? new Date();
  const base = { codigo: manifiesto.codigo, visible: true };

  if (manifiesto.codigo === 'core') {
    const completo = esAdministrador(rol);
    return { ...base, motivo: 'activo', puedeEntrar: true, puedeEscribir: completo, nivel: completo ? 'completo' : 'lectura', alcance: 'todos', diasDePrueba: null };
  }

  const v = vigenciaDe(contratacion, ahora);
  if (!v.entra) {
    return { ...base, motivo: v.motivo, puedeEntrar: false, puedeEscribir: false, nivel: null, alcance: 'todos', diasDePrueba: null };
  }
  const admin = esAdministrador(rol);
  if (!admin && !asignacion) {
    // La empresa lo contrató pero a esta persona no se le asignó: la tarjeta se ve, no se entra.
    return { ...base, motivo: 'sin_asignar', puedeEntrar: false, puedeEscribir: false, nivel: null, alcance: 'todos', diasDePrueba: v.dias };
  }
  const nivel = admin ? 'completo' : asignacion!.nivel;
  return {
    ...base,
    motivo: v.motivo,
    puedeEntrar: true,
    // Escribir exige módulo vigente Y nivel completo.
    puedeEscribir: v.escribe && nivel === 'completo',
    nivel,
    alcance: admin ? 'todos' : asignacion!.alcance,
    diasDePrueba: v.dias,
  };
}

/** Permisos efectivos: unión de los de cada módulo según su nivel, más los de núcleo. */
export function permisosEfectivos(manifiestos: readonly ManifiestoDeModulo[], accesos: readonly AccesoDeModulo[]): string[] {
  const permisos = new Set<string>();
  for (const a of accesos) {
    if (!a.puedeEntrar || !a.nivel) continue;
    const m = manifiestos.find((x) => x.codigo === a.codigo);
    if (!m) continue;
    // Sin escritura (baja, suspensión, prueba vencida) solo queda lo de lectura.
    const lista = a.nivel === 'completo' && a.puedeEscribir ? m.permisosPorNivel.completo : m.permisosPorNivel.lectura;
    for (const p of lista) permisos.add(p);
  }
  // Un `member` con escritura en algún módulo puede crear y editar clientes (núcleo compartido).
  if (accesos.some((a) => a.codigo !== 'core' && a.puedeEscribir)) permisos.add('clientes:editar');
  return [...permisos].sort();
}
