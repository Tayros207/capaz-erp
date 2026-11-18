import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CapturaPropuesta } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_BANDEJA } from '../bandeja/claves.ts';
import { CLAVE_CAPTURA, medirDictados, proponerCaptura } from './api.ts';
import { decidirOrigen, destinoSiEsPreguntaDePrecio, hayTexto, instanteDeInicio, lineaDeMedicion, mensajeDeErrorDeCaptura, rangoDelMes, transcurridoMs } from './logica.ts';
import { recortarTexto, unirConBase } from './logica-reconocedor.ts';
import { TarjetaDeBorrador, type Resolucion } from './tarjeta-de-borrador.tsx';
import { useReconocedorWebSpeech } from './use-reconocedor-web-speech.ts';
import { MAXIMO_DE_TEXTO_DE_CAPTURA, type OrigenDeCaptura } from '@capaz/shared';

type Modo = 'ingreso' | 'egreso';

function diaDeHoy(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}

export function LineaDeMedicion({ alineacion = 'centro' }: { alineacion?: 'centro' | 'izquierda' } = {}) {
  const [rango] = useState(() => rangoDelMes(diaDeHoy()));
  const m = useQuery({ queryKey: [...CLAVE_CAPTURA, 'metricas', rango.desde, rango.hasta], queryFn: async () => datosOError(await medirDictados(rango.desde, rango.hasta)), staleTime: 30_000 });
  if (!m.data) return null;
  return <p className={alineacion === 'centro' ? 'text-center text-sm text-texto-suave' : 'text-sm text-texto-suave'}>{lineaDeMedicion(m.data)}</p>;
}

/** Dictado por voz o texto: el texto es siempre el respaldo. Interpreta, propone borradores y la persona los aprueba. */
export function PantallaDictado() {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const voz = useReconocedorWebSpeech();
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<Modo | null>(null);
  const [propuesta, setPropuesta] = useState<CapturaPropuesta | null>(null);
  const [pendientes, setPendientes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [hecho, setHecho] = useState(false);
  const inicio = useRef<number | null>(null);
  const vinoDeVoz = useRef(false);
  const base = useRef('');
  const escuchando = voz.estado === 'escuchando';
  const hayVoz = voz.estado === 'listo' || escuchando || voz.estado === 'error';

  // Lo que reconoce la voz se suma a lo que ya estaba escrito, y se puede retocar a mano.
  useEffect(() => {
    if (voz.texto) {
      vinoDeVoz.current = true;
      setTexto(unirConBase(base.current, voz.texto));
    }
  }, [voz.texto]);

  function alternarMicrofono() {
    if (escuchando) {
      voz.detener();
      return;
    }
    base.current = texto;
    inicio.current = instanteDeInicio(inicio.current, performance.now());
    setHecho(false);
    voz.iniciar();
  }

  function alEscribir(valor: string) {
    inicio.current = instanteDeInicio(inicio.current, performance.now());
    setHecho(false);
    setTexto(recortarTexto(valor));
  }

  function reiniciar() {
    setTexto('');
    setModo(null);
    setPropuesta(null);
    setPendientes([]);
    setFallo('');
    inicio.current = null;
    vinoDeVoz.current = false;
    base.current = '';
    voz.limpiar();
  }

  async function enviar() {
    if (enviando || !hayTexto(texto)) return;
    if (escuchando) voz.detener();
    // «¿Cuánto le cobramos a X por Y?» es una pregunta, no un movimiento: se responde en /precios y no se crea ningún borrador.
    const destino = destinoSiEsPreguntaDePrecio(texto);
    if (destino) {
      void navegar(destino);
      return;
    }
    setEnviando(true);
    setFallo('');
    const origen: OrigenDeCaptura = decidirOrigen(vinoDeVoz.current);
    const r = await proponerCaptura({ texto, origen, transcurridoMs: transcurridoMs(inicio.current, performance.now()), modulo: 'registro', ...(modo ? { modo } : {}) });
    setEnviando(false);
    if (r.ok && 'datos' in r) {
      setPropuesta(r.datos);
      setPendientes(r.datos.borradores.map((b) => b.id));
      void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
    } else if ('error' in r) {
      setFallo(mensajeDeErrorDeCaptura(r.error.codigo, r.error.mensaje));
    }
  }

  function alResolver(id: string, resolucion: Resolucion) {
    const quedan = pendientes.filter((p) => p !== id);
    setPendientes(quedan);
    void cliente.invalidateQueries({ queryKey: [...CLAVE_CAPTURA, 'metricas'] });
    void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
    if (resolucion === 'aprobado') {
      notificar('Registrado', 'exito');
      void cliente.invalidateQueries({ queryKey: ['registro'] });
    } else if (resolucion === 'despues') {
      notificar('Queda en la bandeja', 'info');
    }
    if (quedan.length === 0) {
      reiniciar();
      setHecho(resolucion === 'aprobado');
    }
  }

  const sinBorradores = propuesta !== null && propuesta.borradores.length === 0;
  const conBorradores = propuesta !== null && propuesta.borradores.length > 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-8">
      <EncabezadoDePagina titulo="Dictar un movimiento" />

      {conBorradores ? (
        <section aria-label="Borradores propuestos" className="flex flex-col gap-4">
          {propuesta.faltan.length > 0 ? (
            <p role="status" className="rounded-control border border-aviso/40 bg-aviso/10 p-3 text-sm font-medium text-texto">Revisa: {propuesta.faltan.join('; ')}.</p>
          ) : null}
          {propuesta.borradores.filter((b) => pendientes.includes(b.id)).map((b) => (
            <TarjetaDeBorrador key={b.id} propuesta={b} alResolver={alResolver} />
          ))}
          <Boton variante="fantasma" onClick={reiniciar}>Dictar otro</Boton>
        </section>
      ) : (
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          {hecho ? <p role="status" className="text-center font-medium text-exito">Registrado. Puedes dictar el siguiente.</p> : null}
          <div className="flex flex-col items-center gap-2">
            <Boton
              variante={escuchando ? 'peligro' : 'primario'}
              tamano="grande"
              className="min-h-24 w-full max-w-sm text-lg"
              disabled={!hayVoz}
              aria-pressed={escuchando}
              onClick={alternarMicrofono}
            >
              {escuchando ? 'Escuchando… toca para detener' : 'Tocar para hablar'}
            </Boton>
            {voz.aviso ? <p role="status" className="text-center text-sm text-texto-suave">{voz.aviso}</p> : null}
          </div>
          <CampoTextarea
            etiqueta="Lo que dictaste o escribes"
            filas={4}
            maxLength={MAXIMO_DE_TEXTO_DE_CAPTURA}
            value={texto}
            placeholder="Ejemplo: Ingreso 500 soles, cliente Juan Pérez, flyers"
            ayuda={`${texto.length} de ${MAXIMO_DE_TEXTO_DE_CAPTURA} caracteres. Puedes corregir el texto antes de enviarlo.`}
            onChange={(e) => alEscribir(e.target.value)}
          />
          <div role="group" aria-label="Qué es" className="grid grid-cols-2 gap-2">
            {(['ingreso', 'egreso'] as const).map((m) => (
              <Boton key={m} variante={modo === m ? 'primario' : 'secundario'} aria-pressed={modo === m} onClick={() => setModo(modo === m ? null : m)}>
                {m === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </Boton>
            ))}
          </div>
          {sinBorradores ? (
            <div role="status" className="flex flex-col gap-1 rounded-control border border-aviso/40 bg-aviso/10 p-3 text-sm text-texto">
              <p className="font-medium">No pude armar un registro con eso.</p>
              {propuesta.faltan.length > 0 ? <p>Falta: {propuesta.faltan.join('; ')}.</p> : null}
              {propuesta.pista ? <p>{propuesta.pista}</p> : null}
              <p>Tu texto sigue arriba para que lo corrijas.</p>
            </div>
          ) : null}
          {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
          <Boton type="submit" variante="primario" tamano="grande" cargando={enviando} disabled={!hayTexto(texto)}>Enviar</Boton>
        </form>
      )}

      <LineaDeMedicion />
    </div>
  );
}
