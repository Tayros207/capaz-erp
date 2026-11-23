import { useQuery } from '@tanstack/react-query';
import { SelectorDeCliente } from '../../core/clientes/selector-de-cliente.tsx';
import { datosOError } from '../../shared/api/consultas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { listarMiembros } from './api.ts';
import { FilasDePedido } from './filas-de-pedido.tsx';
import { igvDeLaHoja, type ErroresDePedido, type FormularioDePedido } from './logica.ts';

type Props = {
  valor: FormularioDePedido;
  errores: ErroresDePedido;
  /** Día del pedido: la entrega no puede ser anterior. */
  fecha: string;
  alCambiar: (cambio: Partial<FormularioDePedido>) => void;
};

/** Los datos editables de un pedido en borrador: cliente, entrega, responsable, notas y líneas. */
export function FormularioPedido({ valor, errores, fecha, alCambiar }: Props) {
  // La lista de miembros exige su propio permiso: quien no lo tiene simplemente no ve el campo.
  const miembros = useQuery({ queryKey: ['miembros', 'para-responsable'], queryFn: async () => datosOError(await listarMiembros()).miembros, retry: false });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Si el cliente no existe se crea aquí mismo y queda elegido. */}
        <SelectorDeCliente valor={valor.cliente} alCambiar={(o) => alCambiar({ cliente: o ? { id: o.id, nombre: o.nombre } : null })} error={errores.cliente} />
        <Campo etiqueta="Fecha de entrega" type="date" min={fecha} value={valor.entregaEl} error={errores.entregaEl} ayuda="Opcional." onChange={(e) => alCambiar({ entregaEl: e.target.value })} />
        {miembros.data ? (
          <CampoSelect etiqueta="Responsable" value={valor.responsableId} onChange={(e) => alCambiar({ responsableId: e.target.value })}>
            <option value="">Sin responsable</option>
            {miembros.data.map((m) => (
              <option key={m.personaId} value={m.personaId}>{m.nombre}</option>
            ))}
          </CampoSelect>
        ) : null}
        <div className="sm:col-span-2">
          <CampoTextarea etiqueta="Notas" filas={3} maxLength={4000} value={valor.notas} error={errores.notas} onChange={(e) => alCambiar({ notas: e.target.value })} />
        </div>
      </div>
      <label className="flex w-fit min-h-(--alto-control) cursor-pointer items-center gap-2">
        <input type="checkbox" checked={valor.conIgv} onChange={(e) => alCambiar({ conIgv: e.target.checked })} className="size-5 cursor-pointer accent-accion" />
        <span className="flex flex-col">
          <span className="font-medium text-texto">Con IGV (se factura)</span>
          <span className="text-sm text-texto-suave">Actívalo solo si vas a emitir factura: los precios ya incluyen el IGV de 18 %. Apagado, el IGV no se muestra.</span>
        </span>
      </label>
      <FilasDePedido lineas={valor.lineas} igvPorcentaje={igvDeLaHoja(valor)} clienteId={valor.cliente?.id} errores={errores.porLinea} error={errores.lineas} alCambiar={(lineas) => alCambiar({ lineas })} />
    </div>
  );
}
