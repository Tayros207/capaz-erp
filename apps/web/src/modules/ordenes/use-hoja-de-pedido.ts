import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { IGV_POR_DEFECTO, type Respuesta } from '@capaz/shared';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { ZONA_POR_DEFECTO } from '../../shared/formato/fechas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { ADELANTO_INICIAL, montoDeAdelanto, sePuedeCobrarAdelanto, validarAdelanto, type AdelantoDeHoja, type Res } from './adelanto.ts';
import { crearYConfirmar, type DependenciasDeAlta, type ResultadoDeAlta } from './alta-de-pedido.ts';
import { refrescarPedidos } from './acciones.ts';
import { confirmarPedido, crearPedido } from './api.ts';
import { ejecutarAdelanto } from './flujo-adelanto.ts';
import { FORMULARIO_VACIO, argumentosDeCreacion, diaEnZona, lineaVacia, mensajeDeRechazo, totalesDe, validarParaConfirmar, validarPedido, type ErroresDePedido, type FormularioDePedido } from './logica.ts';

const hojaVacia = (): FormularioDePedido => ({ ...FORMULARIO_VACIO, lineas: [lineaVacia(crypto.randomUUID())] });

function aRes<T, U>(r: Respuesta<T>, mapa: (d: T) => U): Res<U> {
  if (r.ok && 'datos' in r) return { ok: true, datos: mapa(r.datos) };
  if ('error' in r) return { ok: false, codigo: r.error.codigo, mensaje: mensajeDeRechazo(r.error.codigo, r.error.mensaje) };
  return { ok: false, codigo: 'requiere_confirmacion', mensaje: 'Esta operación pide una confirmación que aquí no está disponible.' };
}

const DEPENDENCIAS: DependenciasDeAlta = {
  crear: async (args) => aRes(await crearPedido(args), (p) => ({ id: p.id })),
  confirmar: async (id) => aRes(await confirmarPedido(id), (p) => ({ id: p.id, codigo: p.codigo })),
  confirmarYCobrar: ejecutarAdelanto,
};

export type Confirmado = Extract<ResultadoDeAlta, { estado: 'confirmado' }>;

/** El estado de la hoja única «Nuevo pedido»: formulario, adelanto y los dos caminos de guardado. */
export function useHojaDePedido() {
  const navegar = useNavigate();
  const yo = useYo();
  const [form, setForm] = useState<FormularioDePedido>(hojaVacia);
  const [errores, setErrores] = useState<ErroresDePedido>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [adelanto, setAdelanto] = useState<AdelantoDeHoja>(ADELANTO_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<Confirmado | null>(null);
  const [hoy] = useState(() => diaEnZona(new Date(), ZONA_POR_DEFECTO));
  // El estado no basta contra el doble clic: dos clics seguidos ven el mismo render. La bandera sí.
  const bloqueo = useRef(false);

  const totalCentimos = totalesDe(form.lineas, IGV_POR_DEFECTO)?.totalCentimos ?? 0;
  const ofreceAdelanto = sePuedeCobrarAdelanto({ puedeEscribirEnRegistro: !!yo && puedeEscribirEn(yo, 'registro'), clienteId: form.cliente?.id, totalCentimos });

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

  /** Comportamiento de siempre: guarda el borrador y abre su ficha. */
  const guardarBorrador = () => {
    const e = validarPedido(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return Promise.resolve();
    return enviar(async () => {
      const r = await DEPENDENCIAS.crear(argumentosDeCreacion(form));
      if (!r.ok) return setAviso(r.mensaje);
      await refrescarPedidos();
      notificar('Borrador guardado. Revísalo y confírmalo para darle número.', 'exito');
      void navegar(`/m/ordenes/${r.datos.id}`, { replace: true });
    });
  };

  /** Crea y confirma (con adelanto si se marcó) sin salir de la hoja. */
  const confirmar = () => {
    const e = validarParaConfirmar(form, hoy);
    setErrores(e);
    const conAdelanto = ofreceAdelanto && adelanto.cobrar;
    const monto = montoDeAdelanto(adelanto, totalCentimos);
    const errorMonto = conAdelanto ? validarAdelanto(monto, totalCentimos) : null;
    if (Object.keys(e).length > 0 || errorMonto) return Promise.resolve();
    return enviar(async () => {
      const r = await crearYConfirmar(DEPENDENCIAS, argumentosDeCreacion(form), conAdelanto && monto !== null ? { montoCentimos: monto, medio: adelanto.medio } : null);
      if (r.estado === 'sin_crear') return setAviso(r.mensaje);
      await refrescarPedidos();
      if (r.estado === 'borrador') {
        notificar(r.mensaje, 'aviso');
        return void navegar(`/m/ordenes/${r.id}`, { replace: true });
      }
      setConfirmado(r);
      const parcial = r.adelanto !== null && r.adelanto.estado !== 'completo';
      notificar(r.adelanto?.mensaje ?? `Pedido ${r.codigo} confirmado.`, parcial ? 'aviso' : 'exito');
    });
  };

  /** Vuelve a una hoja en blanco (tras confirmar). */
  const nuevaHoja = () => {
    setForm(hojaVacia());
    setErrores({});
    setAviso(undefined);
    setAdelanto(ADELANTO_INICIAL);
    setConfirmado(null);
  };

  return {
    form, errores, aviso, adelanto, enviando, confirmado, hoy, totalCentimos, ofreceAdelanto,
    cambiar: (c: Partial<FormularioDePedido>) => setForm((f) => ({ ...f, ...c })),
    cambiarAdelanto: setAdelanto,
    guardarBorrador, confirmar, nuevaHoja, refrescarPedidos,
  };
}
