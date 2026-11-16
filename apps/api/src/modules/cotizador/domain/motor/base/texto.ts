/** Minúsculas, sin tildes y con los espacios en uno: para comparar o buscar texto sin que estorben. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
