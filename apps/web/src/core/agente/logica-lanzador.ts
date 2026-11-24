// El atajo de teclado del asistente. Aparte del componente para poder probarlo sin navegador.

type TeclaPulsada = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

/** Ctrl+J (o Cmd+J en Mac), sin Alt. Ctrl+K ya es la paleta de comandos. */
export function esAtajoDelAgente(e: TeclaPulsada): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'j';
}
