import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { formatearSoles, type CuentaDto, type EntradaDe, type MovimientoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarContactos, listarCategorias } from './api.ts';
import { BarraDeTotal } from './barra-de-total.tsx';
import { CLAVE_REGISTRO } from './claves.ts';
import { categoriasDe, diaEnZona } from './logica.ts';
import { argumentosDeCorreccion, formularioDeCorreccion, montoDeLaCorreccion, validarCorreccion, type FormularioDeCorreccion } from './logica-correccion.ts';
import { masDatosNaceAbierto, preguntasDe, resumenDeMasDatos } from './logica-hoja.ts';
import { MasDatos, type DatosDeMas } from './mas-datos.tsx';
import { SeccionDeHoja } from './seccion-de-hoja.tsx';
import { SeccionDeProductos } from './seccion-de-productos.tsx';
import { enfocarCampo, enterAvanza } from './use-enter-avanza.ts';

type Props = {
  abierto: boolean;
  movimiento: MovimientoDto;
  cuentas: readonly CuentaDto[];
  /** Devuelve si se aplicó (la confirmación de dos pasos va dentro): solo entonces se cierra la hoja. */
  alEnviar: (args: EntradaDe<'movimiento_corregir'>) => Promise<boolean>;
  alCerrar: () => void;
};

/** Lo que falta primero, en el orden en que se lee la hoja, y el bloque al que llevar el foco. */
function primeraFalta(e: ReturnType<typeof validarCorreccion>): { campo: string; texto: string } | null {
  for (const campo of ['productos', 'monto', 'fecha', 'cuentaId', 'descripcion', 'motivo'] as const) {
    const texto = e[campo];
    if (texto) return { campo: campo === 'motivo' ? 'motivo' : campo, texto };
  }
  return null;
}

function Contenido({ movimiento: m, cuentas, alEnviar, alCerrar }: Omit<Props, 'abierto'>) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeCorreccion>(() => formularioDeCorreccion(m));
  const [verErrores, setVerErrores] = useState(false);
  const [masAbierto, setMasAbierto] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const raiz = useRef<HTMLFormElement>(null);
  const categorias = useQuery({ queryKey: [...CLAVE_REGISTRO, 'categorias'], queryFn: async () => datosOError(await listarCategorias()) });
  const lista = categoriasDe(m.tipo, categorias.data?.items ?? []);
  const cambiar = (c: Partial<FormularioDeCorreccion>) => setForm((f) => ({ ...f, ...c }));
  const errores = validarCorreccion(form, hoy);
  const falta = primeraFalta(errores);
  const q = preguntasDe(m.tipo);
  const abiertoPorDefecto = masDatosNaceAbierto(form, hoy, verErrores ? { fecha: errores.fecha, descripcion: errores.descripcion, cuentaId: errores.cuentaId } : {});

  function alTocarPista() {
    if (!falta) return;
    setVerErrores(true);
    if (['fecha', 'cuentaId', 'descripcion', 'motivo'].includes(falta.campo)) setMasAbierto(true);
    window.setTimeout(() => enfocarCampo(raiz.current, falta.campo), 60);
  }

  async function enviar() {
    if (falta) return alTocarPista();
    const args = argumentosDeCorreccion(m, form);
    if (!args) {
      setAviso('No cambiaste nada: modifica al menos un dato.');
      return;
    }
    setAviso(undefined);
    setEnviando(true);
    const hecho = await alEnviar(args);
    setEnviando(false);
    if (hecho) alCerrar();
  }

  const mostrar = (k: keyof typeof errores) => (verErrores ? errores[k] : undefined);
  const datos: DatosDeMas = { fecha: form.fecha, cuentaId: form.cuentaId, medioDePago: form.medioDePago, categoriaId: form.categoriaId, descripcion: form.descripcion };
  const cuenta = cuentas.find((c) => c.id === form.cuentaId);
  const categoria = lista.find((c) => c.id === form.categoriaId);

  return (
    <HojaInferior
      abierto
      alta
      alCerrar={alCerrar}
      titulo={`Editar ${m.codigo}`}
      pie={
        <BarraDeTotal
          total={montoDeLaCorreccion(form)} textoBoton="Revisar cambios" textoCerrar="Volver" pista={falta?.texto ?? null} alTocarPista={alTocarPista}
          guardando={enviando} alCerrar={alCerrar} formularioId="formulario-correccion"
        />
      }
    >
      <form ref={raiz} id="formulario-correccion" noValidate className="flex flex-col gap-5" onKeyDown={enterAvanza} onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
        <p className="text-sm text-texto-suave">
          {m.codigo} · {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de {formatearSoles(m.montoCentimos)}. Al guardar, el anterior queda en la papelera y se registra uno nuevo ya corregido, con otro número.
        </p>
        <SeccionDeHoja numero={1} titulo={q.persona} campo="contacto">
          <SelectorDeRegistro
            etiqueta={m.tipo === 'ingreso' ? 'Cliente (opcional)' : 'Proveedor (opcional)'} valor={form.contacto} alCambiar={(contacto) => cambiar({ contacto })} buscar={buscarContactos}
            placeholder={q.personaPlaceholder} textoSinResultados="Ningún cliente o proveedor se parece a eso"
          />
        </SeccionDeHoja>
        <SeccionDeProductos
          numero={2} pregunta={q.productos} filas={form.productos} alCambiarFilas={(productos) => cambiar({ productos })} monto={form.monto} alCambiarMonto={(monto) => cambiar({ monto })}
          clienteId={form.contacto?.id} errorProductos={mostrar('productos')} errorMonto={mostrar('monto')}
        />
        <MasDatos
          abierto={masAbierto ?? abiertoPorDefecto} alAlternar={setMasAbierto} resumen={resumenDeMasDatos(form, hoy, cuenta?.nombre ?? null, categoria?.nombre ?? null)} valores={datos}
          alCambiar={(c) => cambiar(c)} cuentas={cuentas} categorias={lista} pregunta={q.categoria} hoy={hoy}
          errores={{ fecha: mostrar('fecha'), cuentaId: mostrar('cuentaId'), descripcion: mostrar('descripcion') }}
        />
        <div data-campo="motivo">
          <CampoTextarea etiqueta="¿Por qué lo cambias? (opcional)" placeholder="Ej: me equivoqué al tipear" filas={2} maxLength={300} value={form.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} error={mostrar('motivo')} />
        </div>
        {aviso ? <p role="alert" className="text-sm font-medium text-aviso">{aviso}</p> : null}
      </form>
    </HojaInferior>
  );
}

/** Edita un movimiento: la misma hoja que «Nuevo», precargada. El servidor pide confirmar con el detalle de lo que cambia. */
export function HojaDeCorreccion({ abierto, ...resto }: Props) {
  return abierto ? <Contenido {...resto} /> : null;
}
