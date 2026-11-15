import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import type { FilaDeCampo } from './logica.ts';

type Props = {
  filas: FilaDeCampo[];
  alCambiar: (filas: FilaDeCampo[]) => void;
  /** Los valores se escriben como contraseña (credenciales). */
  secreto?: boolean;
  etiquetaDeAgregar: string;
};

/** Pares «nombre y valor» editables: configuración de una conexión sin escribir JSON. */
export function FilasDeCampos({ filas, alCambiar, secreto, etiquetaDeAgregar }: Props) {
  const poner = (i: number, parte: Partial<FilaDeCampo>) => alCambiar(filas.map((f, j) => (j === i ? { ...f, ...parte } : f)));
  return (
    <div className="flex flex-col gap-3">
      {filas.map((f, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Campo etiqueta="Nombre del campo" autoComplete="off" value={f.nombre} onChange={(e) => poner(i, { nombre: e.target.value })} />
          <Boton className="sm:order-last" variante="fantasma" icono="cerrar" aria-label={`Quitar el campo ${f.nombre || i + 1}`} onClick={() => alCambiar(filas.filter((_, j) => j !== i))} />
          <div className="col-span-2 sm:col-span-1">
            <Campo etiqueta="Valor" type={secreto ? 'password' : 'text'} autoComplete="off" value={f.valor} onChange={(e) => poner(i, { valor: e.target.value })} />
          </div>
        </div>
      ))}
      <div>
        <Boton icono="mas" onClick={() => alCambiar([...filas, { nombre: '', valor: '' }])}>{etiquetaDeAgregar}</Boton>
      </div>
    </div>
  );
}
