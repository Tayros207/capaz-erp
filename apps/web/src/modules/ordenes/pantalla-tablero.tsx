import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { PedidoDto } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { MenuDeAcciones } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { Tablero } from '../../shared/ui/tablero.tsx';
import { aplicarPaso, cargarAbiertos, usePermisosDePedidos } from './acciones.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { columnasDeTablero, formatearDia, pasosPermitidos, siguientePaso, type Paso } from './logica.ts';
import { Cargando, SeccionesDePedidos } from './marco.tsx';

function Tarjeta({ pedido, puedeEditar, alAbrir }: { pedido: PedidoDto; puedeEditar: boolean; alAbrir: () => void }) {
  const confirmar = siguientePaso(pedido.estado);
  const pasos: Paso[] = puedeEditar ? (confirmar?.tipo === 'confirmar' ? [confirmar] : pasosPermitidos(pedido.estado)) : [];
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium text-texto">{pedido.codigo}</span>
        <span className="break-words text-texto">{pedido.clienteNombre}</span>
        <span className="text-sm text-texto-suave">Entrega: {formatearDia(pedido.entregaEl)} · {formatearSoles(pedido.totalCentimos)}</span>
        {pedido.atrasado ? <span><Insignia tono="peligro">Atrasado</Insignia></span> : null}
      </div>
      <MenuDeAcciones
        etiqueta={`Acciones de ${pedido.codigo} de ${pedido.clienteNombre}`}
        acciones={[{ etiqueta: 'Abrir pedido', onSeleccionar: alAbrir }, ...pasos.map((p) => ({ etiqueta: p.texto, onSeleccionar: () => void aplicarPaso(pedido.id, p) }))]}
      />
    </div>
  );
}

/** Los pedidos abiertos, una columna por estado. Se mueven con «Pasar a…» del menú de cada tarjeta. */
export function PantallaTableroDePedidos() {
  const navegar = useNavigate();
  const { editar } = usePermisosDePedidos();
  const abiertos = useQuery({ queryKey: [...CLAVE_PEDIDOS, 'abiertos'], queryFn: () => cargarAbiertos() });

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Pedidos por estado" accionPrincipal={editar ? <Boton variante="primario" icono="mas" onClick={() => void navegar('/m/ordenes/nuevo')}>Nuevo pedido</Boton> : undefined} />
      <SeccionesDePedidos />
      {abiertos.isPending ? (
        <Cargando etiqueta="Cargando pedidos" />
      ) : abiertos.isError ? (
        <EstadoVacio titulo="No pudimos cargar los pedidos" descripcion={abiertos.error.message} icono="caja" accion={<Boton onClick={() => void abiertos.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          {abiertos.data.hayMas ? <p role="status" className="text-sm text-texto-suave">Hay más de 500 pedidos abiertos: aquí se ven los más recientes.</p> : null}
          <Tablero
            etiqueta="Pedidos abiertos por estado"
            columnas={columnasDeTablero(abiertos.data.items)}
            clave={(p: PedidoDto) => p.id}
            tarjeta={(p) => <Tarjeta pedido={p} puedeEditar={editar} alAbrir={() => void navegar(`/m/ordenes/${p.id}`)} />}
            vacio="Ningún pedido en este estado"
          />
        </>
      )}
    </div>
  );
}
