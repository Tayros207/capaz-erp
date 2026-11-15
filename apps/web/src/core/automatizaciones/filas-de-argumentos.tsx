import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { ETIQUETA_DE_TIPO, type FilaDeArgumento, type TipoDeValor } from './logica.ts';

type Props = { filas: FilaDeArgumento[]; alCambiar: (filas: FilaDeArgumento[]) => void; etiquetaDeAgregar: string; nombreDelCampo?: string };

/** Pares «nombre, tipo y valor»: los argumentos de una acción o los datos de prueba, sin escribir JSON. */
export function FilasDeArgumentos({ filas, alCambiar, etiquetaDeAgregar, nombreDelCampo = 'Campo' }: Props) {
  const poner = (i: number, parte: Partial<FilaDeArgumento>) => alCambiar(filas.map((f, j) => (j === i ? { ...f, ...parte } : f)));
  return (
    <div className="flex flex-col gap-3">
      {filas.map((f, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_9rem_1fr_auto]">
          <Campo etiqueta={nombreDelCampo} autoComplete="off" value={f.nombre} onChange={(e) => poner(i, { nombre: e.target.value })} />
          <Boton className="sm:order-last" variante="fantasma" icono="cerrar" aria-label={`Quitar ${f.nombre || `el campo ${i + 1}`}`} onClick={() => alCambiar(filas.filter((_, j) => j !== i))} />
          <CampoSelect etiqueta="Tipo" value={f.tipo} onChange={(e) => poner(i, { tipo: e.target.value as TipoDeValor })}>
            {(Object.keys(ETIQUETA_DE_TIPO) as TipoDeValor[]).map((t) => <option key={t} value={t}>{ETIQUETA_DE_TIPO[t]}</option>)}
          </CampoSelect>
          <div className="col-span-2 sm:col-span-1">
            <Campo etiqueta="Valor" autoComplete="off" value={f.valor} onChange={(e) => poner(i, { valor: e.target.value })} />
          </div>
        </div>
      ))}
      <div><Boton icono="mas" onClick={() => alCambiar([...filas, { nombre: '', valor: '', tipo: 'texto' }])}>{etiquetaDeAgregar}</Boton></div>
    </div>
  );
}
