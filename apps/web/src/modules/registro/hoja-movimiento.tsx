import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { formatearSoles, type Aviso, type CuentaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarContactos, crearDeudaConAdelanto, listarCategorias, registrarMovimiento } from './api.ts';
import { BarraDeTotal } from './barra-de-total.tsx';
import { CLAVE_REGISTRO } from './claves.ts';
import {
  argumentosDeAdelanto, argumentosDeMovimiento, categoriasDe, conAdelantoActivado, diaEnZona, faltaCancelar, mensajeDeRechazo, montoDelFormulario, validarMovimiento,
  type FormularioDeMovimiento, type TipoDeMovimiento,
} from './logica.ts';
import {
  CAMPOS_DE_MAS_DATOS, formularioParaCaptura, masDatosNaceAbierto, preguntasDe, primeraPista, recordarCategoria, resumenDeMasDatos, siguienteParaCaptura, textoDelBoton, ultimaCategoriaUsada,
} from './logica-hoja.ts';
import { MasDatos, type DatosDeMas } from './mas-datos.tsx';
import { SeccionDeHoja } from './seccion-de-hoja.tsx';
import { SeccionDeProductos } from './seccion-de-productos.tsx';
import { enfocarCampo, enterAvanza } from './use-enter-avanza.ts';

type Props = { tipo: TipoDeMovimiento | null; cuentas: readonly CuentaDto[]; alCerrar: () => void };

function Contenido({ tipo, cuentas, alCerrar }: { tipo: TipoDeMovimiento; cuentas: readonly CuentaDto[]; alCerrar: () => void }) {
  const consultas = useQueryClient();
  // El día se fija al abrir la hoja; el servidor decide el día real de la empresa.
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeMovimiento>(() => formularioParaCaptura(tipo, hoy, cuentas));
  const [verErrores, setVerErrores] = useState(false);
  // `null`: «Más datos» se abre solo si hay algo distinto de lo habitual; si la persona lo abre o lo cierra, manda ella.
  const [masAbierto, setMasAbierto] = useState<boolean | null>(null);
  const [fallo, setFallo] = useState<string | undefined>();
  const [hecho, setHecho] = useState<{ codigo: string; avisos: Aviso[] } | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const raiz = useRef<HTMLFormElement>(null);
  const categoriaPuesta = useRef(false);
  const categorias = useQuery({ queryKey: [...CLAVE_REGISTRO, 'categorias'], queryFn: async () => datosOError(await listarCategorias()) });
  const lista = categoriasDe(form.tipo, categorias.data?.items ?? []);
  const cambiar = (c: Partial<FormularioDeMovimiento>) => setForm((f) => ({ ...f, ...c }));

  // La última categoría usada de este tipo viene ya elegida (una sola vez, cuando llega la lista).
  useEffect(() => {
    if (categoriaPuesta.current || !categorias.data) return;
    categoriaPuesta.current = true;
    const id = ultimaCategoriaUsada(tipo, categoriasDe(tipo, categorias.data.items));
    if (id) setForm((f) => (f.categoriaId === '' ? { ...f, categoriaId: id } : f));
  }, [categorias.data, tipo]);

  const errores = validarMovimiento(form, hoy);
  const pista = primeraPista(errores);
  const q = preguntasDe(tipo);
  const verError = <K extends keyof typeof errores>(k: K) => (verErrores ? errores[k] : undefined);

  function alTocarPista() {
    if (!pista) return;
    setVerErrores(true);
    if (CAMPOS_DE_MAS_DATOS.includes(pista.campo)) setMasAbierto(true);
    window.setTimeout(() => enfocarCampo(raiz.current, pista.campo), 60);
  }

  async function guardar() {
    if (pista) return alTocarPista();
    setGuardando(true);
    setFallo(undefined);
    // Con adelanto nace una deuda (por cobrar o por pagar) y, en el mismo gesto, el movimiento del adelanto.
    const r = form.conAdelanto ? await crearDeudaConAdelanto(argumentosDeAdelanto(form)) : await registrarMovimiento(argumentosDeMovimiento(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: CLAVE_REGISTRO });
      recordarCategoria(tipo, form.categoriaId);
      const d = r.datos;
      setHecho({ codigo: 'deuda' in d ? `${d.deuda.codigo} con adelanto ${d.movimiento.codigo} (falta ${formatearSoles(d.deuda.saldoCentimos)})` : d.codigo, avisos: r.avisos });
      // La hoja queda abierta para el siguiente; la clave reinicia el campo de monto y le devuelve el foco.
      setForm(siguienteParaCaptura(form));
      setVuelta((v) => v + 1);
      setVerErrores(false);
    } else if ('error' in r) {
      setHecho(undefined);
      setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  const cuenta = cuentas.find((c) => c.id === form.cuentaId);
  const categoria = lista.find((c) => c.id === form.categoriaId);
  const resumen = resumenDeMasDatos(form, hoy, cuenta?.nombre ?? null, categoria?.nombre ?? null);
  const abiertoPorDefecto = masDatosNaceAbierto(form, hoy, verErrores ? errores : {});
  const datos: DatosDeMas = { fecha: form.fecha, cuentaId: form.cuentaId, medioDePago: form.medioDePago, categoriaId: form.categoriaId, descripcion: form.descripcion };

  return (
    <HojaInferior
      abierto
      alta
      alCerrar={alCerrar}
      titulo={tipo === 'egreso' ? 'Nuevo egreso' : 'Nuevo ingreso'}
      pie={
        <BarraDeTotal
          total={montoDelFormulario(form)} adelanto={form.conAdelanto ? form.adelanto : null} falta={form.conAdelanto ? faltaCancelar(form) : undefined}
          textoBoton={textoDelBoton(form)} pista={pista?.texto ?? null} alTocarPista={alTocarPista} guardando={guardando} alCerrar={alCerrar} formularioId="formulario-movimiento"
        />
      }
    >
      <form ref={raiz} id="formulario-movimiento" noValidate className="flex flex-col gap-5" onKeyDown={enterAvanza} onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
        {hecho ? (
          <div role="status" className="flex flex-col gap-1 text-sm font-medium">
            <p className="text-exito">Registrado: {hecho.codigo}</p>
            {hecho.avisos.map((a) => <p key={a.codigo} className="text-aviso">{a.mensaje}</p>)}
          </div>
        ) : null}
        <SeccionDeHoja numero={1} titulo={q.persona} campo="contacto">
          <SelectorDeRegistro
            etiqueta={tipo === 'ingreso' ? 'Cliente' : 'Proveedor'} valor={form.contacto} alCambiar={(contacto) => cambiar({ contacto })} buscar={buscarContactos}
            placeholder={q.personaPlaceholder} error={verError('contacto')} textoSinResultados="Ningún cliente o proveedor se parece a eso"
          />
        </SeccionDeHoja>
        <SeccionDeProductos
          numero={2} pregunta={q.productos} filas={form.productos} alCambiarFilas={(productos) => cambiar({ productos })} monto={form.monto} alCambiarMonto={(monto) => cambiar({ monto })}
          clienteId={form.contacto?.id} errorProductos={verError('productos')} errorMonto={verError('monto')} vuelta={vuelta} sinProductos={form.conAdelanto}
        />
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-texto">
            <input type="checkbox" checked={form.conAdelanto} onChange={(e) => (e.target.checked ? setForm(conAdelantoActivado(form)) : cambiar({ conAdelanto: false }))} />
            ¿Hubo adelanto? <span className="font-normal text-texto-suave">El resto queda por {tipo === 'ingreso' ? 'cobrar' : 'pagar'}.</span>
          </label>
          {form.conAdelanto ? (
            <div className="flex flex-col gap-3 rounded-control border border-borde bg-superficie-alta p-3">
              <p className="text-sm text-texto-suave">Con adelanto el detalle de productos todavía no se guarda: escríbelo en la nota (en «Más datos»).</p>
              <div data-campo="adelanto">
                <CampoMonto key={`a${vuelta}`} etiqueta="Adelanto en soles" valor={form.adelanto} alCambiar={(adelanto) => cambiar({ adelanto })} error={verError('adelanto')} ayuda={tipo === 'ingreso' ? 'Lo que el cliente dejó hoy.' : 'Lo que le pagaste hoy al proveedor.'} />
              </div>
              <div className="flex items-baseline justify-between gap-2" aria-live="polite">
                <span className="text-sm text-texto-suave">Falta cancelar</span>
                <span className={`text-lg font-semibold tabular-nums ${faltaCancelar(form) > 0 ? 'text-aviso' : 'text-exito'}`}>{formatearSoles(faltaCancelar(form))}</span>
              </div>
              <div data-campo="venceEn"><Campo etiqueta="Lo esperas para el (opcional)" type="date" min={form.fecha} value={form.venceEn} onChange={(e) => cambiar({ venceEn: e.target.value })} error={verError('venceEn')} /></div>
            </div>
          ) : null}
        </div>
        <MasDatos
          abierto={masAbierto ?? abiertoPorDefecto} alAlternar={setMasAbierto} resumen={resumen} valores={datos} alCambiar={(c) => cambiar(c)} cuentas={cuentas} categorias={lista}
          pregunta={q.categoria} hoy={hoy} errores={{ fecha: verError('fecha'), cuentaId: verError('cuentaId'), descripcion: verError('descripcion') }}
        />
        {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      </form>
    </HojaInferior>
  );
}

/** Alta de un ingreso o un egreso: cliente, productos (o el importe) y, plegado, el resto. Tras guardar queda abierta para el siguiente. */
export function HojaDeMovimiento({ tipo, cuentas, alCerrar }: Props) {
  return tipo ? <Contenido key={tipo} tipo={tipo} cuentas={cuentas} alCerrar={alCerrar} /> : null;
}
