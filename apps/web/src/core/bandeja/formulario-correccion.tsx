import { Campo } from '../../shared/ui/campo.tsx';
import { etiquetaDeArgumento, medidaDeArgumento, tipoDeCampo } from './logica.ts';

const AYUDA = { numero: 'Un número.', booleano: 'Escribe Sí o No.', json: 'Formato estructurado: edítalo con cuidado.', texto: undefined } as const;

type Props = {
  original: Record<string, unknown>;
  valores: Record<string, string>;
  errores: Record<string, string>;
  alCambiar: (clave: string, valor: string) => void;
};

/** Un campo por cada argumento del borrador; el texto vuelve a su tipo original al guardar. */
export function FormularioCorreccion({ original, valores, errores, alCambiar }: Props) {
  const claves = Object.keys(valores);
  if (claves.length === 0) return <p className="text-texto-suave">Este borrador no trae datos para corregir.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {claves.map((k) => (
        <Campo
          key={k}
          etiqueta={medidaDeArgumento(k) === 'centimos' ? `${etiquetaDeArgumento(k)} (S/)` : etiquetaDeArgumento(k)}
          value={valores[k] ?? ''}
          error={errores[k]}
          ayuda={medidaDeArgumento(k) === 'centimos' ? 'En soles, con hasta dos decimales.' : medidaDeArgumento(k) === 'milesimas' ? 'Hasta tres decimales.' : AYUDA[tipoDeCampo(original[k])]}
          inputMode={tipoDeCampo(original[k]) === 'numero' ? 'decimal' : undefined}
          onChange={(e) => alCambiar(k, e.target.value)}
        />
      ))}
    </div>
  );
}
