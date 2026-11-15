// Reglas puras de normalización (sin base ni framework). Las usan clientes y productos.

/** Nombre para comparar y buscar: sin tildes, en minúsculas y con espacios simples. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Teléfono: solo dígitos, con un `+` inicial si lo traía. Vacío es `null`; menos de 6 o más de 15 dígitos es `undefined` (inválido). */
export function normalizarTelefono(telefono: string | null | undefined): string | null | undefined {
  if (telefono == null) return null;
  const limpio = telefono.trim();
  if (!limpio) return null;
  const digitos = limpio.replace(/\D/g, '');
  if (digitos.length < 6 || digitos.length > 15 || /[^\d\s()+.\-]/.test(limpio)) return undefined;
  return limpio.startsWith('+') ? `+${digitos}` : digitos;
}

/** Texto libre opcional: recortado; vacío es `null`. */
export function textoOpcional(valor: string | null | undefined): string | null {
  const t = valor?.trim();
  return t ? t : null;
}
