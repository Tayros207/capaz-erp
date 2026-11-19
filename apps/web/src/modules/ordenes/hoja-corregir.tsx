import { useQuery } from '@tanstack/react-query';
import type { PedidoCompletoDto, VentaCorregidaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { CLAVE_PEDIDOS } from './claves.ts';
import { verSaldoDelPedido } from './deuda-del-pedido.ts';
import { EditorDeCorreccion } from './editor-de-correccion.tsx';
import { RevisionDeCorreccion } from './revision-de-correccion.tsx';
import { useCorreccion } from './use-correccion.ts';

type Props = { abierto: boolean; pedido: PedidoCompletoDto; alGuardar: (r: VentaCorregidaDto) => void; alCerrar: () => void };

function Contenido({ pedido, alGuardar, alCerrar }: Omit<Props, 'abierto'>) {
  const c = useCorreccion(pedido, alGuardar);
  // Lo pagado sale de Finanzas; quien no lo ve simplemente no ve esa línea.
  const saldo = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'saldo', pedido.id], queryFn: () => verSaldoDelPedido(pedido.id, pedido.clienteId), retry: false });
  if (c.fase === 'editar') {
    return (
      <form noValidate className="flex flex-col gap-5" onSubmit={(ev) => { ev.preventDefault(); void c.revisar(); }}>
        <EditorDeCorreccion pedido={pedido} form={c.form} errores={c.errores} alCambiar={c.cambiar} />
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario">Revisar cambios</Boton>
        </div>
      </form>
    );
  }
  return <RevisionDeCorreccion pedido={pedido} form={c.form} saldo={saldo.data ?? null} fase={c.fase} resumen={c.resumen} error={c.error} alGuardar={c.guardar} alVolver={c.volver} />;
}

/** «Corregir pedido»: editar, ver «Qué cambia» y guardar la versión siguiente. */
export function HojaCorregir({ abierto, alCerrar, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={`Corregir pedido ${resto.pedido.codigo}`} ancha>
      {abierto ? <Contenido {...resto} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
