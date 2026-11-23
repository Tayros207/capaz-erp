import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { listarCuentasParaCobrar } from './api.ts';
import { PAGO_INICIAL, erroresEnVivo, pagoAlConfirmar, puedeDefinirPago, textoDeConfirmar, validarPago, type CuentaParaCobrar, type PagoDeHoja } from './pago.ts';

type Entrada = {
  /** Solo quien escribe en Registro ve el bloque. */
  visible: boolean;
  clienteId: string | undefined;
  totalCentimos: number;
  hoy: string;
};

/** El estado del bloque «Pago» de la hoja: lo elegido, las cuentas, los errores y lo que se envía al confirmar. */
export function usePagoDeHoja({ visible, clienteId, totalCentimos, hoy }: Entrada) {
  const [pago, setPago] = useState<PagoDeHoja>(PAGO_INICIAL);
  const [intentado, setIntentado] = useState(false);
  const consulta = useQuery({
    queryKey: ['ordenes', 'cuentas-para-cobrar'],
    queryFn: async (): Promise<CuentaParaCobrar[]> => datosOError(await listarCuentasParaCobrar()).items.map((c) => ({ id: c.id, nombre: c.nombre, esPrincipal: c.esPrincipal })),
    enabled: visible,
    retry: false,
    staleTime: 60_000,
  });
  const cuentas = consulta.data ?? null;
  const habilitado = puedeDefinirPago({ clienteId, totalCentimos });
  // Sin cliente o sin total el bloque se ve apagado y no cuenta: confirmar sigue como siempre.
  const activo = visible && habilitado;
  const todos = activo ? validarPago(pago, { totalCentimos, hoy, cuentas }) : {};

  return {
    visible,
    habilitado,
    pago,
    cuentas,
    cargandoCuentas: visible && consulta.isPending,
    cuentasFallaron: consulta.isError,
    errores: intentado ? todos : erroresEnVivo(todos),
    textoDeConfirmar: textoDeConfirmar(activo ? pago.modo : null),
    cambiar: setPago,
    /** Al pulsar Confirmar: deja ver todos los errores y dice si se puede seguir. */
    comprobar: (): boolean => {
      setIntentado(true);
      return Object.keys(todos).length === 0;
    },
    /** Lo que se hace al confirmar; `null` si no hay pago que definir (se confirma sin deuda). */
    alConfirmar: () => (activo ? pagoAlConfirmar(pago, totalCentimos, cuentas) : null),
    reiniciar: () => {
      setPago(PAGO_INICIAL);
      setIntentado(false);
    },
  };
}

export type PagoDeHojaEnUso = ReturnType<typeof usePagoDeHoja>;
