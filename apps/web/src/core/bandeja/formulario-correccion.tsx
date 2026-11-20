import { Campo } from '../../shared/ui/campo.tsx';
import { SelectorDeContacto } from '../captura/tarjetas/selector-de-contacto.tsx';
import { EditorDeLineas } from './editor-de-lineas.tsx';
import { esListaDeLineas } from './lineas-de-pedido.ts';
import { etiquetaDeArgumento, medidaDeArgumento, tipoDeCampo } from './logica.ts';

const AYUDA = { numero: 'Un número.', booleano: 'Escribe Sí o No.', json: 'Formato estructurado: edítalo con cuidado.', texto: undefined } as const;

type Props = {
  original: Record<string, unknown>;
  valores: Record<string, string>;
  errores: Record<string, string>;
  alCambiar: (clave: string, valor: string) => void;
};

function CampoDeArgumento({ k, original, valores, errores, alCambiar }: Props & { k: string }) {
  const valor = valores[k] ?? '';
  if (k === 'lineas' && esListaDeLineas(original.lineas)) {
    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <EditorDeLineas lineasIniciales={original.lineas} alCambiar={(ls) => alCambiar('lineas', JSON.stringify(ls, null, 2))} />
        {errores[k] ? <p className="text-sm font-medium text-peligro">{errores[k]}</p> : null}
      </div>
    );
  }
  if (k === 'clienteId') {
    return (
      <div className="sm:col-span-2">
        <SelectorDeContacto etiqueta="Cliente" contactoId={valor.trim() || null} sugerencia={undefined} alCambiar={(id) => alCambiar('clienteId', id ?? '')} />
      </div>
    );
  }
  const medida = medidaDeArgumento(k);
  return (
    <Campo
      etiqueta={medida === 'centimos' ? `${etiquetaDeArgumento(k)} (S/)` : etiquetaDeArgumento(k)}
      type={k === 'entregaEl' ? 'date' : undefined}
      value={valor}
      error={errores[k]}
      ayuda={medida === 'centimos' ? 'En soles, con hasta dos decimales.' : medida === 'milesimas' ? 'Hasta tres decimales.' : AYUDA[tipoDeCampo(original[k])]}
      inputMode={tipoDeCampo(original[k]) === 'numero' ? 'decimal' : undefined}
      onChange={(e) => alCambiar(k, e.target.value)}
    />
  );
}

/** Un campo por cada argumento del borrador; el texto vuelve a su tipo original al guardar. */
export function FormularioCorreccion(props: Props) {
  const claves = Object.keys(props.valores);
  if (claves.length === 0) return <p className="text-texto-suave">Este borrador no trae datos para corregir.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {claves.map((k) => (
        <CampoDeArgumento key={k} k={k} {...props} />
      ))}
    </div>
  );
}
