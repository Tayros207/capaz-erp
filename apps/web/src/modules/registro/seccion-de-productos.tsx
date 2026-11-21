import type { Centimos } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { EditorDeProductos } from './editor-de-productos.tsx';
import { filaDeProductoVacia, type FilaDeProducto } from './logica-lineas.ts';
import { SeccionDeHoja } from './seccion-de-hoja.tsx';

type Props = {
  numero: number;
  pregunta: string;
  filas: FilaDeProducto[];
  alCambiarFilas: (filas: FilaDeProducto[]) => void;
  monto: Centimos | null;
  alCambiarMonto: (monto: Centimos | null) => void;
  clienteId?: string | undefined;
  errorProductos?: string | undefined;
  errorMonto?: string | undefined;
  /** Cambia al guardar para devolver el foco y vaciar el campo de importe. */
  vuelta?: number;
  /** Con adelanto los productos todavía no se guardan: solo el importe. */
  sinProductos?: boolean;
};

/** «¿Qué le vendiste?»: productos con cantidad y precio, o solo un importe si no quiere detallarlos. */
export function SeccionDeProductos({ numero, pregunta, filas, alCambiarFilas, monto, alCambiarMonto, clienteId, errorProductos, errorMonto, vuelta = 0, sinProductos = false }: Props) {
  const conProductos = filas.length > 0;
  return (
    <SeccionDeHoja numero={numero} titulo={pregunta} campo={conProductos ? 'productos' : 'monto'}>
      {conProductos ? (
        <>
          <EditorDeProductos filas={filas} alCambiar={alCambiarFilas} clienteId={clienteId} error={errorProductos} />
          <Boton variante="fantasma" onClick={() => alCambiarFilas([])}>Solo el importe, sin productos</Boton>
        </>
      ) : (
        <>
          <CampoMonto key={vuelta} autoFocus etiqueta="Importe total" valor={monto} alCambiar={alCambiarMonto} error={errorMonto} />
          {sinProductos ? null : <Boton variante="fantasma" onClick={() => alCambiarFilas([filaDeProductoVacia('n1')])}>Agregar productos con cantidad y precio</Boton>}
        </>
      )}
    </SeccionDeHoja>
  );
}
