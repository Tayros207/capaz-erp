export const CLASES_DE_CONTROL =
  'min-h-(--alto-control) w-full rounded-control border bg-superficie px-3 text-texto ' +
  'placeholder:text-texto-suave disabled:cursor-not-allowed disabled:opacity-60';

export function descritoPor(id: string, error?: string, ayuda?: string): string | undefined {
  return error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
}
