import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../../shared/api/consultas.ts';
import { notificar } from '../../../shared/ui/notificar.ts';
import { refrescarCotizador } from '../acciones.ts';
import { emitirCotizacion } from '../api-cotizaciones.ts';
import { crearCotizacion, verConfiguracion } from '../api.ts';
import { CLAVE_COTIZADOR } from '../claves.ts';
import { mensajeDeRechazo } from '../logica.ts';
import { argumentosDeEmision, rutaDeFicha } from '../logica-cotizaciones.ts';
import { argumentosDeHojaDirecta, condicionesIniciales, filaVacia, IGV_POR_DEFECTO, validarHoja, type HojaDirecta } from './logica-directa.ts';

/** El estado de la hoja Directa: lo escrito, las condiciones de Ajustes (una sola vez) y el camino crear → emitir. */
export function useHojaDirecta() {
  const navegar = useNavigate();
  const contador = useRef(0);
  const nuevaClave = () => `f${(contador.current += 1)}`;
  const config = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'configuracion'], queryFn: async () => datosOError(await verConfiguracion()), retry: false });
  const [hoja, setHoja] = useState<HojaDirecta>(() => ({ cliente: null, referencia: '', filas: [filaVacia(nuevaClave())], incluyeIgv: false, ...condicionesIniciales(undefined) }));
  const [verErrores, setVerErrores] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [emitida, setEmitida] = useState<CotizacionCompletaDto | null>(null);
  // Las condiciones de Ajustes se copian una sola vez y solo si la persona no las tocó antes de que llegaran.
  const condicionesTocadas = useRef(false);
  const condicionesCopiadas = useRef(false);
  const igv = config.data?.igvPorcentaje ?? IGV_POR_DEFECTO;

  useEffect(() => {
    if (!config.data || condicionesCopiadas.current) return;
    condicionesCopiadas.current = true;
    if (!condicionesTocadas.current) setHoja((h) => ({ ...h, ...condicionesIniciales(config.data) }));
  }, [config.data]);

  function cambiar(cambio: Partial<HojaDirecta>) {
    if ('validezDias' in cambio || 'plazoEntrega' in cambio || 'formaPago' in cambio) condicionesTocadas.current = true;
    setHoja((h) => ({ ...h, ...cambio }));
  }
  const validacion = validarHoja(hoja, igv);

  async function emitir() {
    setVerErrores(true);
    if (!validacion.ok || emitiendo || emitida) return;
    setEmitiendo(true);
    try {
      const r = await crearCotizacion(argumentosDeHojaDirecta(hoja, igv));
      if (!r.ok || !('datos' in r)) {
        if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
        return;
      }
      const id = r.datos.id;
      const e = await emitirCotizacion(argumentosDeEmision(id));
      await refrescarCotizador();
      if ('datos' in e && e.ok) {
        setEmitida(e.datos);
        notificar('Cotización emitida.', 'exito');
        return;
      }
      // Cancelada o rechazada: la cotización quedó como borrador y la ficha lo explica.
      if ('error' in e) notificar(`Se guardó como borrador, pero no se pudo emitir: ${mensajeDeRechazo(e.error.codigo, e.error.mensaje)}`, 'error');
      else notificar('Se guardó como borrador. Puedes emitirla desde su ficha.', 'aviso');
      void navegar(rutaDeFicha(id));
    } finally {
      setEmitiendo(false);
    }
  }

  function nuevaHoja() {
    condicionesTocadas.current = false;
    setHoja({ cliente: null, referencia: '', filas: [filaVacia(nuevaClave())], incluyeIgv: false, ...condicionesIniciales(config.data) });
    setVerErrores(false);
    setEmitida(null);
  }

  return { hoja, cambiar, config: config.data, igv, errores: verErrores ? validacion.errores : { porFila: {} }, emitiendo, emitida, emitir, nuevaHoja, nuevaClave };
}
