import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AjusteDeClienteDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { resolverAccion } from './acciones.ts';
import { fijarAjuste, listarAjustes } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { HojaDeAjusteDeCliente } from './hoja-ajuste-cliente.tsx';
import { argumentosDeAjuste, textoDeAjuste } from './logica.ts';

/** Precio especial por cliente: un porcentaje fijo sobre la lista (descuento o recargo). */
export function PanelDeAjustesDeCliente({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const consulta = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'ajustes-cliente'], queryFn: async () => datosOError(await listarAjustes()) });
  const [hoja, setHoja] = useState<{ ajuste: AjusteDeClienteDto | null } | null>(null);

  const columnas: Array<Columna<AjusteDeClienteDto>> = [
    { id: 'cliente', titulo: 'Cliente', principal: true, celda: (a) => a.clienteNombre },
    { id: 'ajuste', titulo: 'Ajuste', celda: (a) => textoDeAjuste(a.porcentaje) },
    { id: 'nota', titulo: 'Nota', celda: (a) => a.nota ?? '—' },
    ...(puedeConfigurar
      ? [{
          id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const,
          celda: (a: AjusteDeClienteDto) => (
            <span className="inline-flex gap-1">
              <Boton variante="fantasma" onClick={() => setHoja({ ajuste: a })}>Editar</Boton>
              <Boton variante="fantasma" onClick={() => void resolverAccion(fijarAjuste(argumentosDeAjuste(a.clienteId, '', '')), 'Ajuste quitado.')}>Quitar</Boton>
            </span>
          ),
        }]
      : []),
  ];

  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando precios por cliente" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar los precios por cliente" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return (
    <div className="flex flex-col gap-3">
      {puedeConfigurar ? <div className="flex justify-end"><Boton variante="primario" icono="mas" onClick={() => setHoja({ ajuste: null })}>Nuevo ajuste</Boton></div> : null}
      <Lista etiqueta="Precios por cliente" columnas={columnas} filas={consulta.data.items} clave={(a) => a.clienteId} vacio={<EstadoVacio titulo="Ningún cliente tiene precio especial" descripcion="Cuando des un descuento fijo a un cliente, aparecerá aquí." icono="caja" />} />
      <HojaDeAjusteDeCliente abierto={hoja !== null} ajuste={hoja?.ajuste ?? null} alCerrar={() => setHoja(null)} />
    </div>
  );
}
