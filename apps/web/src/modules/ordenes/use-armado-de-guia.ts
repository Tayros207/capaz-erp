import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { useDatosDeEmpresaParaImprimir } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { prepararGuia } from './api.ts';
import { seleccionInicial, type LineaLibre, type SeleccionDeLinea } from './armado-de-guia.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { trasladoInicial, type DatosDeTraslado } from './guias.ts';
import { diaEnZona } from './logica.ts';

type Origen = { pedidoIds: readonly string[]; clienteId: string | null };

/**
 * Prepara la guía (`guia_preparar`) y guarda lo que la persona va armando: líneas marcadas, líneas libres y traslado.
 * Al agregar o quitar un pedido se vuelve a preparar y se conserva lo ya elegido.
 */
export function useArmadoDeGuia(origen: Origen) {
  const [ids, setIds] = useState<string[]>([...origen.pedidoIds]);
  // Se fija al quitar el último pedido: así se puede seguir con el mismo cliente.
  const [clienteFijo, setClienteFijo] = useState<string | null>(origen.clienteId);
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));
  const preparacion = useQuery({
    queryKey: [...CLAVE_PEDIDOS, 'guias', 'preparar', ids.join(','), clienteFijo],
    queryFn: async () => datosOError(await prepararGuia({ pedidoIds: ids, ...(clienteFijo && { clienteId: clienteFijo }) })),
    enabled: ids.length > 0 || clienteFijo !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const prep = preparacion.data;
  const agregar = (id: string) => setIds((actuales) => (actuales.includes(id) ? actuales : [...actuales, id]));
  const quitar = (id: string) => {
    if (prep && ids.length <= 1) setClienteFijo(prep.cliente.id);
    setIds((actuales) => actuales.filter((x) => x !== id));
  };

  const [previa, setPrevia] = useState<Record<string, SeleccionDeLinea>>({});
  const selecciones = useMemo(() => (prep ? seleccionInicial(prep, previa) : {}), [prep, previa]);
  const marcar = (lineaId: string, s: SeleccionDeLinea) => setPrevia({ ...selecciones, [lineaId]: s });

  const [libres, setLibres] = useState<LineaLibre[]>([]);
  const contador = useRef(0);
  const agregarLibre = () => setLibres((l) => [...l, { clave: `libre-${++contador.current}`, descripcion: '', unidad: 'unidad', cantidadMilesimas: null }]);
  const cambiarLibre = (clave: string, c: Partial<LineaLibre>) => setLibres((l) => l.map((x) => (x.clave === clave ? { ...x, ...c } : x)));
  const quitarLibre = (clave: string) => setLibres((l) => l.filter((x) => x.clave !== clave));

  const { datos: empresa, cargando: cargandoEmpresa } = useDatosDeEmpresaParaImprimir();
  // Hasta que la persona escribe, el traslado parte de la empresa y del cliente; después manda lo que escriba.
  const [escrito, setTraslado] = useState<DatosDeTraslado | null>(null);
  const traslado = escrito ?? trasladoInicial(hoy, cargandoEmpresa ? null : empresa, prep?.cliente);

  return { preparacion, prep, hoy, pedidos: { ids, agregar, quitar }, selecciones, marcar, libres, agregarLibre, cambiarLibre, quitarLibre, traslado, setTraslado, empresa };
}
