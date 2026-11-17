import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { AjusteDePrecio, ProductoCotizableDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { refrescarCotizador } from './acciones.ts';
import { emitirCotizacion, verClienteParaWhatsApp } from './api-cotizaciones.ts';
import { consultarPrecio, crearCotizacion, verConfiguracion } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { argumentosDeEmision } from './logica-cotizaciones.ts';
import { argumentosDeCotizacionRapida, mensajeDeRechazo, rutaDeCotizacion, validarCantidadRapida } from './logica.ts';
import { validarCantidadDeCatalogo } from './logica-catalogo.ts';
import { ajusteParaEnviar, SIN_AJUSTE, validarAjuste, type AjusteDeFormulario } from './logica-precio.ts';

type Cliente = { id: string; nombre: string };

/** El estado de la cotización rápida: qué se cotiza, para quién, cuánto, con qué ajuste; el precio lo da el servidor. */
export function useCotizacionRapida() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [elegido, setElegido] = useState<ProductoCotizableDto | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [ajuste, setAjuste] = useState<AjusteDeFormulario>(SIN_AJUSTE);
  const [creando, setCreando] = useState(false);

  // Desde una ficha de cliente se llega con `?cliente=<id>`: el cliente ya viene puesto.
  const clienteDeRuta = parametros.get('cliente');
  useEffect(() => {
    if (!clienteDeRuta) return;
    let vigente = true;
    void verClienteParaWhatsApp(clienteDeRuta).then((r) => {
      if (vigente && r.ok && 'datos' in r) setCliente({ id: r.datos.id, nombre: r.datos.nombre });
    });
    return () => { vigente = false; };
  }, [clienteDeRuta]);

  const esLista = elegido?.origen === 'lista';
  const esCatalogo = elegido?.origen === 'catalogo';
  const cantidadConsultada = useRetardo(cantidad);
  // Se espera a que deje de teclear: la clave del ajuste es texto para que el retardo compare por valor.
  const ajusteConsultado = JSON.parse(useRetardo(JSON.stringify(ajusteParaEnviar(ajuste)))) as AjusteDePrecio;
  const errorDeCantidad = cantidad === null || !elegido ? undefined : esLista ? validarCantidadRapida(cantidad) : validarCantidadDeCatalogo(cantidad);
  const consultable = esLista && cantidadConsultada !== null && cantidadConsultada === cantidad && validarCantidadRapida(cantidadConsultada) === undefined;
  const precio = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'precio', elegido?.listaId, cliente?.id ?? null, cantidadConsultada, ajusteConsultado],
    queryFn: async () => datosOError(await consultarPrecio({ listaId: elegido?.listaId ?? '', cantidadMilesimas: cantidadConsultada ?? 0, ...(cliente && { clienteId: cliente.id }), ajuste: ajusteConsultado })),
    enabled: consultable,
    retry: false,
    placeholderData: (anterior) => anterior,
  });
  const configuracion = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'configuracion'], queryFn: async () => datosOError(await verConfiguracion()), enabled: esCatalogo });

  const errorDeAjuste = ajuste.centimos === null ? undefined : validarAjuste(ajuste, precio.data?.precioListaCentimos ?? null);
  const puedeCrear = elegido !== null && errorDeAjuste === undefined && (esLista ? consultable && !!precio.data && !precio.isFetching : esCatalogo && errorDeCantidad === undefined && cantidad !== null);

  async function crear(emitir: boolean) {
    if (!elegido || cantidad === null || !puedeCrear) return;
    setCreando(true);
    const r = await crearCotizacion(argumentosDeCotizacionRapida(elegido, cantidad, cliente, esLista ? ajusteParaEnviar(ajuste) : undefined));
    setCreando(false);
    if (!r.ok || !('datos' in r)) return void ('error' in r && notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error'));
    const id = r.datos.id;
    // Crear y emitir: si se cancela la confirmación o pide motivo de margen, queda como borrador y la ficha lo explica.
    const emitida = emitir ? await emitirCotizacion(argumentosDeEmision(id)) : null;
    await refrescarCotizador();
    if (emitida && 'datos' in emitida) notificar('Cotización creada y emitida.', 'exito');
    else if (emitida && 'error' in emitida) notificar(`Se creó como borrador, pero no se pudo emitir: ${mensajeDeRechazo(emitida.error.codigo, emitida.error.mensaje)}`, 'error');
    else notificar('Cotización creada como borrador.', 'exito');
    void navegar(rutaDeCotizacion(id));
  }
  const elegirProducto = (p: ProductoCotizableDto | null) => { setElegido(p); setCantidad(null); setAjuste(SIN_AJUSTE); };

  return { elegido, setElegido, elegirProducto, cliente, setCliente, cantidad, setCantidad, ajuste, setAjuste, creando, esLista, esCatalogo, consultable, precio, configuracion, errorDeCantidad, errorDeAjuste, puedeCrear, crear };
}
