// Lógica pura de «Aceptar invitación». Better Auth responde con su propio JSON, así que se lee
// con cuidado: lo que no sea del tipo esperado se ignora.

export type DetalleDeInvitacion = {
  id: string;
  correo: string;
  rol: string;
  estado: string;
  empresa: string;
  empresaId: string | null;
  expiraEn: string | null;
};

const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function interpretarInvitacion(cuerpo: unknown, id: string): DetalleDeInvitacion | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;
  const c = cuerpo as Record<string, unknown>;
  const correo = texto(c.email);
  if (!correo) return null;
  return {
    id: texto(c.id) ?? id,
    correo,
    rol: texto(c.role) ?? 'member',
    estado: texto(c.status) ?? 'pending',
    empresa: texto(c.organizationName) ?? 'la empresa',
    empresaId: texto(c.organizationId),
    expiraEn: texto(c.expiresAt),
  };
}

export type Veredicto = { puede: true } | { puede: false; motivo: string };

/** ¿Se puede aceptar ahora? Estado, vencimiento y que la sesión sea del correo invitado. */
export function veredictoDeAceptar(d: DetalleDeInvitacion, correoDeSesion: string | null, ahora: Date): Veredicto {
  if (d.estado === 'accepted') return { puede: false, motivo: 'Esta invitación ya fue aceptada.' };
  if (d.estado !== 'pending') return { puede: false, motivo: 'Esta invitación fue anulada o ya no sirve. Pide una nueva a tu administrador.' };
  if (d.expiraEn && new Date(d.expiraEn).getTime() < ahora.getTime()) return { puede: false, motivo: 'Esta invitación venció. Pide una nueva a tu administrador.' };
  if (correoDeSesion && correoDeSesion.trim().toLowerCase() !== d.correo.trim().toLowerCase()) {
    return { puede: false, motivo: `Esta invitación es para ${d.correo}. Cierra la sesión e ingresa con ese correo.` };
  }
  return { puede: true };
}

export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_conexion') return 'No hay conexión con el servidor. Inténtalo de nuevo.';
  if (codigo === 'no_autenticado') return 'Inicia sesión con el correo invitado para continuar.';
  if (codigo === 'no_encontrado') return 'La invitación no existe o ya no está disponible.';
  if (codigo === 'sin_permiso') return 'Esta invitación no corresponde a tu cuenta. Ingresa con el correo al que se envió.';
  if (codigo === 'conflicto') return mensaje || 'No se pudo aceptar: la empresa ya no tiene lugares libres o ya eres parte de ella.';
  return mensaje || 'No se pudo aceptar la invitación.';
}
