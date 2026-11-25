import type { ReactNode } from 'react';
import { bloquesDe, type Tramo } from './logica-markdown.ts';

/** Los tramos con formato como elementos de React: negrita, cursiva y código. Nada de HTML del modelo, nada de enlaces ni de imágenes. */
function Tramos({ tramos }: { tramos: readonly Tramo[] }): ReactNode {
  return tramos.map((t, i) => {
    if (t.tipo === 'negrita') return <strong key={i} className="font-semibold text-texto">{t.texto}</strong>;
    if (t.tipo === 'cursiva') return <em key={i}>{t.texto}</em>;
    if (t.tipo === 'codigo') return <code key={i} className="rounded-chip bg-superficie-alta px-1 py-0.5 font-mono text-[0.85em]">{t.texto}</code>;
    return <span key={i}>{t.texto}</span>;
  });
}

/** Lo que escribe el asistente, con párrafos, listas y negritas legibles, y un cursor que parpadea mientras sigue escribiendo. */
export function TextoDelAgente({ texto, escribiendo }: { texto: string; escribiendo: boolean }): ReactNode {
  const bloques = bloquesDe(texto);
  const ultimo = bloques.length - 1;
  const cursor = escribiendo ? <span aria-hidden="true" className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-[0.15em] rounded-full bg-asistente-2 motion-safe:animate-[asistente-cursor_0.9s_steps(1)_infinite]" /> : null;
  return (
    <div className="flex flex-col gap-2 break-words">
      {bloques.map((b, i) => {
        if (b.tipo === 'lista') {
          const Lista = b.ordenada ? 'ol' : 'ul';
          return (
            <Lista key={i} className={b.ordenada ? 'ml-5 list-decimal space-y-1 marker:text-texto-suave' : 'ml-5 list-disc space-y-1 marker:text-asistente-2'}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Tramos tramos={item} />
                  {i === ultimo && j === b.items.length - 1 ? cursor : null}
                </li>
              ))}
            </Lista>
          );
        }
        return (
          <p key={i}>
            {b.lineas.map((linea, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <Tramos tramos={linea} />
              </span>
            ))}
            {i === ultimo ? cursor : null}
          </p>
        );
      })}
    </div>
  );
}
