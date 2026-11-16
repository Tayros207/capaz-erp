export const CLASES_DE_CONTROL =
  'min-h-(--alto-control) w-full rounded-control border bg-superficie px-3 text-sm text-texto shadow-sutil ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-borde-fuerte focus:border-foco ' +
  'placeholder:text-texto-suave/80 disabled:cursor-not-allowed disabled:bg-superficie-alta disabled:opacity-60';

export function descritoPor(id: string, error?: string, ayuda?: string): string | undefined {
  return error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
}
