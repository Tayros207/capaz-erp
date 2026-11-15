/** Une clases omitiendo lo falso. */
export function unir(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(' ');
}
