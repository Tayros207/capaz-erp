import { useRef, useState } from 'react';
import type { Centimos } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { FichaDeMaquina } from '../../shared/ui/ficha-de-maquina.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import {
  cuadraFila,
  erroresDeFila,
  filaConCantidad,
  filaConPrecio,
  filaConSubtotal,
  filasDeLineas,
  filaVacia,
  lineasDeFilas,
  MAXIMO_DE_LINEAS_DE_PEDIDO,
  subtotalDeFila,
  totalDeFilas,
  type FilaDeLinea,
} from './lineas-de-pedido.ts';

type Props = {
  lineasIniciales: unknown;
  alCambiar: (lineas: Record<string, unknown>[]) => void;
  deshabilitado?: boolean;
};

function FilaEditable({ f, n, alCambiarFila, alQuitar, puedeQuitar }: { f: FilaDeLinea; n: number; alCambiarFila: (f: FilaDeLinea) => void; alQuitar: () => void; puedeQuitar: boolean }) {
  const errores = erroresDeFila(f);
  const sub = subtotalDeFila(f);
  return (
    <div role="group" aria-label={`Línea ${n}`} className="flex flex-col gap-3 rounded-control border border-borde p-3">
      <Campo etiqueta="Descripción" maxLength={300} value={f.descripcion} error={errores.descripcion} onChange={(e) => alCambiarFila({ ...f, descripcion: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoUnidad valor={f.unidad} alCambiar={(u) => alCambiarFila({ ...f, unidad: u })} />
        <CampoCantidad etiqueta="Cantidad" unidad={f.unidad} valor={f.cantidadMilesimas} error={errores.cantidad} alCambiar={(c) => alCambiarFila(filaConCantidad(f, c))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoPrecio etiqueta="Precio unitario (con IGV)" valor={f.precioUnitarioMilesimas} error={errores.precio} alCambiar={(p) => alCambiarFila(filaConPrecio(f, p))} />
        <CampoMonto
          etiqueta="Subtotal"
          valor={sub as Centimos | null}
          ayuda={cuadraFila(f) ? undefined : 'El precio unitario se guarda con 3 decimales y no da exacto este subtotal.'}
          alCambiar={(c) => alCambiarFila(filaConSubtotal(f, c))}
        />
      </div>
      <FichaDeMaquina n={n} valores={f} alCambiar={(campo, valor) => alCambiarFila({ ...f, [campo]: valor })} />
      <Boton variante="fantasma" disabled={!puedeQuitar} onClick={alQuitar}>Quitar línea</Boton>
    </div>
  );
}

/** Las líneas de un pedido: cantidad y precio unitario o subtotal (lo último escrito manda). Lo usan la tarjeta y la bandeja. */
export function EditorDeLineas({ lineasIniciales, alCambiar, deshabilitado }: Props) {
  const [filas, setFilas] = useState<FilaDeLinea[]>(() => {
    const iniciales = filasDeLineas(lineasIniciales);
    return iniciales.length > 0 ? iniciales : [filaVacia('l0')];
  });
  const siguiente = useRef(filas.length);

  function poner(nuevas: FilaDeLinea[]) {
    setFilas(nuevas);
    alCambiar(lineasDeFilas(nuevas));
  }
  const total = totalDeFilas(filas);

  return (
    <fieldset disabled={deshabilitado} className="flex flex-col gap-3">
      {filas.map((f, i) => (
        <FilaEditable
          key={f.clave}
          f={f}
          n={i + 1}
          puedeQuitar={filas.length > 1}
          alCambiarFila={(nueva) => poner(filas.map((x) => (x.clave === f.clave ? nueva : x)))}
          alQuitar={() => poner(filas.filter((x) => x.clave !== f.clave))}
        />
      ))}
      <Boton disabled={filas.length >= MAXIMO_DE_LINEAS_DE_PEDIDO} onClick={() => poner([...filas, filaVacia(`l${siguiente.current++}`)])}>Agregar línea</Boton>
      <p className="text-right font-medium tabular-nums">{total === null ? 'Completa los precios para ver el total.' : `Total (con IGV): ${formatearSoles(total as Centimos)}`}</p>
    </fieldset>
  );
}
