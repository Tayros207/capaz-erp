import { useRef, useState } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router';
import { IGV_POR_DEFECTO } from '@capaz/shared';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { crearYConfirmar, type DependenciasDeAlta, type ResultadoDeAlta } from './alta-de-pedido.ts';
import { refrescarPedidos } from './acciones.ts';
import { confirmarPedido, crearPedido } from './api.ts';
import { normalizar } from './flujo-adelanto.ts';
import { ejecutarPago } from './flujo-pago.ts';
import { FORMULARIO_VACIO, argumentosDeCreacion, diaEnZona, lineaVacia, totalesDe, validarParaConfirmar, validarPedido, type ErroresDePedido, type FormularioDePedido } from './logica.ts';
import { usePagoDeHoja } from './use-pago-de-hoja.ts';

const hojaVacia = (): FormularioDePedido => ({ ...FORMULARIO_VACIO, lineas: [lineaVacia(crypto.randomUUID())] });

const DEPENDENCIAS: DependenciasDeAlta = {
  crear: async (args) => normalizar(await crearPedido(args), (p) => ({ id: p.id })),
  confirmar: async (id) => normalizar(await confirmarPedido(id), (p) => ({ id: p.id, codigo: p.codigo })),
  confirmarYCobrar: ejecutarPago,
};

export type Confirmado = Extract<ResultadoDeAlta, { estado: 'confirmado' }>;

/** Un envío a la vez: el estado no basta contra el doble clic (dos clics seguidos ven el mismo render), la bandera sí. */
function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();
  const bloqueo = useRef(false);
  async function enviar(fn: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEnviando(true);
    setAviso(undefined);
    try {
      await fn();
    } finally {
      bloqueo.current = false;
      setEnviando(false);
    }
  }
  return { enviando, aviso, setAviso, enviar };
}

/** El borrador quedó guardado: se avisa y se abre su ficha. */
async function abrirBorrador(id: string, navegar: NavigateFunction) {
  await refrescarPedidos();
  notificar('Borrador guardado. Revísalo y confírmalo para darle número.', 'exito');
  void navegar(`/m/ordenes/${id}`, { replace: true });
}

/** Lo que sigue a «Confirmar»: avisa el desenlace y, si quedó en borrador, abre su ficha; si se confirmó, muestra el resultado en la hoja. */
async function cerrarConfirmacion(r: Exclude<ResultadoDeAlta, { estado: 'sin_crear' }>, navegar: NavigateFunction, alConfirmar: (c: Confirmado) => void) {
  await refrescarPedidos();
  if (r.estado === 'borrador') {
    notificar(r.mensaje, 'aviso');
    return void navegar(`/m/ordenes/${r.id}`, { replace: true });
  }
  alConfirmar(r);
  const parcial = r.cobro !== null && r.cobro.estado !== 'completo';
  notificar(r.cobro?.mensaje ?? `Pedido ${r.codigo} confirmado.`, parcial ? 'aviso' : 'exito');
}

/** El estado de la hoja única «Nuevo pedido»: formulario, pago y los dos caminos de guardado. */
export function useHojaDePedido() {
  const navegar = useNavigate();
  const yo = useYo();
  const [form, setForm] = useState<FormularioDePedido>(hojaVacia);
  const [errores, setErrores] = useState<ErroresDePedido>({});
  const [confirmado, setConfirmado] = useState<Confirmado | null>(null);
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));
  const { enviando, aviso, setAviso, enviar } = useEnvio();
  const totalCentimos = totalesDe(form.lineas, IGV_POR_DEFECTO)?.totalCentimos ?? 0;
  const pago = usePagoDeHoja({ visible: !!yo && puedeEscribirEn(yo, 'registro'), clienteId: form.cliente?.id, totalCentimos, hoy });

  /** Comportamiento de siempre: guarda el borrador y abre su ficha. El pago no se toca: solo se define al confirmar. */
  const guardarBorrador = () => {
    const e = validarPedido(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return Promise.resolve();
    return enviar(async () => {
      const r = await DEPENDENCIAS.crear(argumentosDeCreacion(form));
      if (!r.ok) return setAviso(r.mensaje);
      await abrirBorrador(r.datos.id, navegar);
    });
  };

  /** Crea y confirma (con el pago elegido: deuda y cobro) sin salir de la hoja. */
  const confirmar = () => {
    const e = validarParaConfirmar(form, hoy);
    setErrores(e);
    const pagoOk = pago.comprobar();
    if (Object.keys(e).length > 0 || !pagoOk) return Promise.resolve();
    return enviar(async () => {
      const r = await crearYConfirmar(DEPENDENCIAS, argumentosDeCreacion(form), pago.alConfirmar());
      if (r.estado === 'sin_crear') return setAviso(r.mensaje);
      await cerrarConfirmacion(r, navegar, setConfirmado);
    });
  };

  /** Vuelve a una hoja en blanco (tras confirmar). */
  const nuevaHoja = () => { setForm(hojaVacia()); setErrores({}); setAviso(undefined); pago.reiniciar(); setConfirmado(null); };

  return {
    form, errores, aviso, pago, enviando, confirmado, hoy, totalCentimos,
    cambiar: (c: Partial<FormularioDePedido>) => setForm((f) => ({ ...f, ...c })),
    guardarBorrador, confirmar, nuevaHoja,
  };
}
