import { CARACTERES_MINIMOS_DE_EXPLICACION, formatearSoles, semanaDe, type Centimos, type MovimientoDeSemanaDto, type SemanaRevisadaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { formatearDia } from './logica.ts';
import {
  avisoDeMovimientosPosteriores, diferenciaDeConteo, etiquetaDeConteo, faltanParaExplicar, largoDeExplicacion, MAXIMO_DE_EXPLICACION, MAXIMO_DE_NOTAS, motivoParaNoContar,
  moverSemana, resumenDeDiferencias, TEXTO_DE_ESTADO_DE_SEMANA, textoDeAjusteAnterior, textoDeCambioDesdeElCierre, textoDeDiferencia, textoDeSemana, TONO_DE_ESTADO_DE_SEMANA,
  type Conteos, type ErroresDeConteo, type Explicaciones,
} from './logica-cierre.ts';

// Los cuatro pasos del cierre semanal. Solo dibujan: el estado y las llamadas viven en `pantalla-cierre.tsx`.

const AVISO = 'rounded-control border border-aviso/40 bg-aviso/10 px-3 py-2 text-sm text-texto';
const TARJETA = 'flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta';

/** Color y texto de una diferencia: el texto siempre acompaña al color. */
const claseDeDiferencia = (dif: number): string => (dif === 0 ? 'text-exito' : dif < 0 ? 'text-peligro' : 'text-aviso');

// ---- Paso 1: Semana ----

type PropsDeSemana = { desde: string; hoy: string; semana: SemanaRevisadaDto | undefined; alMover: (desde: string) => void };

export function PasoSemana({ desde, hoy, semana, alMover }: PropsDeSemana) {
  const { hasta } = semanaDe(desde);
  const hayOtraDespues = moverSemana(desde, 1) <= hoy;
  const motivo = semana ? motivoParaNoContar(semana.estado, semana.hasta) : null;
  return (
    <section aria-label="Elegir la semana" className={TARJETA}>
      <p className="text-sm text-texto-suave">Elige la semana que vas a cerrar. Va de lunes a sábado; lo del domingo cuenta en la semana siguiente.</p>
      <div className="flex items-center justify-between gap-2">
        <Boton aria-label="Semana anterior" onClick={() => alMover(moverSemana(desde, -1))}>‹</Boton>
        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
          <span className="font-titulo text-lg font-semibold text-texto tabular-nums">{textoDeSemana(desde, hasta)}</span>
          {semana ? <Insignia tono={TONO_DE_ESTADO_DE_SEMANA[semana.estado]}>{TEXTO_DE_ESTADO_DE_SEMANA[semana.estado]}</Insignia> : null}
        </div>
        <Boton aria-label="Semana siguiente" disabled={!hayOtraDespues} onClick={() => alMover(moverSemana(desde, 1))}>›</Boton>
      </div>
      {motivo ? <p role="status" className={AVISO}>{motivo}</p> : null}
    </section>
  );
}

// ---- Paso 2: Revisar ----

function FilaDeMovimiento({ m }: { m: MovimientoDeSemanaDto }) {
  const ingreso = m.tipo === 'ingreso';
  return (
    <li className="flex items-start justify-between gap-3 border-t border-borde py-2 first:border-t-0">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-texto">{m.descripcion ?? m.contactoNombre ?? m.codigo}</p>
        <p className="text-xs text-texto-suave">{m.codigo} · {formatearDia(m.fecha)} · {m.cuentaNombre}{m.contactoNombre && m.descripcion ? ` · ${m.contactoNombre}` : ''}</p>
      </div>
      <span className={unir('shrink-0 text-sm font-medium tabular-nums', ingreso ? 'text-exito' : 'text-peligro')}>
        {ingreso ? '+' : '−'}{formatearSoles(m.montoCentimos)}
        <span className="sr-only">{ingreso ? ' (ingreso)' : ' (egreso)'}</span>
      </span>
    </li>
  );
}

function AvisoConMovimientos({ titulo, ayuda, total, items }: { titulo: string; ayuda: string; total: number; items: readonly MovimientoDeSemanaDto[] }) {
  if (total === 0) return null;
  return (
    <section role="status" aria-label={titulo} className={AVISO}>
      <p className="font-medium">{titulo}: {total}</p>
      <p className="text-texto-suave">{ayuda}</p>
      <ul className="mt-2">{items.map((m) => <FilaDeMovimiento key={m.id} m={m} />)}</ul>
      {total > items.length ? <p className="mt-1 text-xs text-texto-suave">Mostrando {items.length} de {total}.</p> : null}
    </section>
  );
}

function AvisoDeAjustesAnteriores({ ajustes }: { ajustes: SemanaRevisadaDto['ajustesPosterioresACierre'] }) {
  if (ajustes.length === 0) return null;
  const total = ajustes.reduce((suma, a) => suma + a.diferenciaCentimos, 0);
  return (
    <section role="status" aria-label="Movimientos después de un cierre anterior" className={AVISO}>
      <p className="font-medium"><span aria-hidden="true">⚠ </span>Hay movimientos anotados después del cierre de una semana anterior: la caja de esa cuenta ya no coincide con lo que contaste entonces (diferencia {total < 0 ? '−' : '+'}{formatearSoles(Math.abs(total))}).</p>
      <ul className="mt-1 list-disc pl-5">{ajustes.map((a) => <li key={a.cuentaId}>{textoDeAjusteAnterior(a)}</li>)}</ul>
    </section>
  );
}

export function PasoRevisar({ semana }: { semana: SemanaRevisadaDto }) {
  return (
    <div className="flex flex-col gap-4">
      {semana.cierre && semana.cambiosDesdeElCierre.length > 0 ? (
        <section role="status" aria-label="Cambios desde el cierre" className={AVISO}>
          <p className="font-medium">Cambió algo después de cerrar esta semana</p>
          <ul className="mt-1 list-disc pl-5">{semana.cambiosDesdeElCierre.map((c) => <li key={c.cuentaId}>{textoDeCambioDesdeElCierre(c)}</li>)}</ul>
          <p className="mt-1 text-texto-suave">El cierre ya hecho no se modifica; revisa qué movimiento se anotó o corrigió después.</p>
        </section>
      ) : null}
      <AvisoDeAjustesAnteriores ajustes={semana.ajustesPosterioresACierre} />
      {semana.cuentas.map((c) => (
        <section key={c.cuentaId} aria-label={`Cuenta ${c.nombre}`} className="flex flex-col gap-2">
          <h2 className="font-titulo font-semibold text-texto">{c.nombre} <span className="text-sm font-normal text-texto-suave">· {c.movimientos} {c.movimientos === 1 ? 'movimiento' : 'movimientos'}</span></h2>
          <GrupoDeCifras etiqueta={`Cifras de ${c.nombre}`}>
            <Cifra etiqueta="Al empezar" valor={formatearSoles(c.saldoInicialCentimos)} />
            <Cifra etiqueta="Ingresos" valor={formatearSoles(c.ingresosCentimos)} tono="exito" />
            <Cifra etiqueta="Egresos" valor={formatearSoles(c.egresosCentimos)} tono="peligro" />
            <Cifra etiqueta="Debería haber" valor={formatearSoles(c.sistemaCentimos)} ayuda="Según el sistema, al sábado" />
          </GrupoDeCifras>
        </section>
      ))}
      <AvisoConMovimientos titulo="Ingresos sin cliente" ayuda="Se anotaron sin decir quién pagó. Si puedes, corrígelos antes de cerrar." total={semana.ingresosSinClienteTotal} items={semana.ingresosSinCliente} />
      <AvisoConMovimientos titulo="Cobros en cuenta dudosa" ayuda="Parece que el cobro entró en otra cuenta (por ejemplo, un Yape anotado en la caja). Revisa que la cuenta sea la correcta." total={semana.cobrosEnCuentaDudosaTotal} items={semana.cobrosEnCuentaDudosa} />
      <details className={TARJETA}>
        <summary className="cursor-pointer font-medium text-texto">Ver los movimientos de la semana ({semana.movimientosTotal})</summary>
        <ul>{semana.movimientos.map((m) => <FilaDeMovimiento key={m.id} m={m} />)}</ul>
        {semana.movimientosTotal > semana.movimientos.length ? <p className="text-xs text-texto-suave">Mostrando {semana.movimientos.length} de {semana.movimientosTotal}.</p> : null}
      </details>
    </div>
  );
}

// ---- Paso 3: Contar ----

type PropsDeConteo = {
  semana: SemanaRevisadaDto;
  conteos: Conteos;
  explicaciones: Explicaciones;
  errores: ErroresDeConteo;
  alContar: (cuentaId: string, valor: Centimos | null) => void;
  alExplicar: (cuentaId: string, texto: string) => void;
};

function TarjetaDeConteo({ cuenta, hasta, conteo, explicacion, error, alContar, alExplicar }: {
  cuenta: SemanaRevisadaDto['cuentas'][number]; hasta: string; conteo: Centimos | null; explicacion: string; error: { conteo?: string; explicacion?: string } | undefined;
  alContar: (v: Centimos | null) => void; alExplicar: (t: string) => void;
}) {
  const dif = diferenciaDeConteo(cuenta.sistemaCentimos, conteo);
  const posteriores = avisoDeMovimientosPosteriores(cuenta.movimientosPosterioresCentimos);
  return (
    <section aria-label={`Contar ${cuenta.nombre}`} className={TARJETA}>
      <h2 className="font-titulo font-semibold text-texto">{cuenta.nombre}</h2>
      {posteriores ? <p role="note" className={AVISO}><span aria-hidden="true">⚠ </span>{posteriores}</p> : null}
      <CampoMonto etiqueta={etiquetaDeConteo(hasta)} valor={conteo} alCambiar={alContar} error={error?.conteo} ayuda="Cuéntalo ahora, sin mirar lo que dice el sistema." />
      <p aria-live="polite" className={unir('min-h-6 font-medium tabular-nums', dif === null ? 'text-texto-suave' : claseDeDiferencia(dif))}>
        {dif === null ? 'Escribe lo que contaste para ver la diferencia.' : `Diferencia: ${textoDeDiferencia(dif)}`}
      </p>
      {dif ? (
        <CampoTextarea
          etiqueta="¿Por qué no cuadra?" filas={3} maxLength={MAXIMO_DE_EXPLICACION} value={explicacion} onChange={(e) => alExplicar(e.target.value)} error={error?.explicacion}
          ayuda={`${largoDeExplicacion(explicacion)} de ${CARACTERES_MINIMOS_DE_EXPLICACION} caracteres como mínimo${faltanParaExplicar(explicacion) > 0 ? '' : ' (listo)'}. Esta explicación queda guardada en el movimiento «Diferencia de caja».`}
        />
      ) : null}
    </section>
  );
}

export function PasoContar({ semana, conteos, explicaciones, errores, alContar, alExplicar }: PropsDeConteo) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">Cuenta el dinero que hay de verdad en cada cuenta. Si algo no cuadra, el sistema lo anotará como «Diferencia de caja».</p>
      {semana.cuentas.map((c) => (
        <TarjetaDeConteo
          key={c.cuentaId} cuenta={c} hasta={semana.hasta} conteo={conteos[c.cuentaId] ?? null} explicacion={explicaciones[c.cuentaId] ?? ''} error={errores[c.cuentaId]}
          alContar={(v) => alContar(c.cuentaId, v)} alExplicar={(t) => alExplicar(c.cuentaId, t)}
        />
      ))}
    </div>
  );
}

// ---- Paso 4: Cerrar ----

type PropsDeCierre = { semana: SemanaRevisadaDto; conteos: Conteos; explicaciones: Explicaciones; notas: string; alNotas: (t: string) => void };

function CierreHecho({ semana }: { semana: SemanaRevisadaDto }) {
  const cierre = semana.cierre;
  if (!cierre) return null;
  return (
    <section aria-label="Semana cerrada" className={TARJETA}>
      <p className="font-medium text-exito">Semana cerrada el {formatearDia(cierre.cerradoEn.slice(0, 10))}.</p>
      <ul className="flex flex-col gap-2">
        {cierre.saldos.map((s) => (
          <li key={s.cuentaId} className="flex flex-col gap-0.5 border-t border-borde pt-2 first:border-t-0 first:pt-0">
            <span className="flex justify-between gap-3"><span className="font-medium text-texto">{s.nombre}</span><span className="tabular-nums text-texto">{formatearSoles(s.contadoCentimos)}</span></span>
            <span className={unir('text-sm', claseDeDiferencia(s.diferenciaCentimos))}>{textoDeDiferencia(s.diferenciaCentimos)}</span>
            {s.explicacion ? <span className="text-sm text-texto-suave">{s.explicacion}</span> : null}
          </li>
        ))}
      </ul>
      {cierre.notas ? <p className="text-sm text-texto-suave">Notas: {cierre.notas}</p> : null}
    </section>
  );
}

export function PasoCerrar({ semana, conteos, explicaciones, notas, alNotas }: PropsDeCierre) {
  if (semana.cierre) return <CierreHecho semana={semana} />;
  const { sinCuadrar, totalCentimos } = resumenDeDiferencias(semana.cuentas, conteos);
  return (
    <section aria-label="Resumen del cierre" className={TARJETA}>
      <p className="text-sm text-texto-suave">Revisa y cierra la semana del {textoDeSemana(semana.desde, semana.hasta)}. Al cerrar, cada diferencia queda anotada como un movimiento y el cierre no se puede deshacer.</p>
      <ul className="flex flex-col gap-2">
        {semana.cuentas.map((c) => {
          const dif = diferenciaDeConteo(c.sistemaCentimos, conteos[c.cuentaId]);
          return (
            <li key={c.cuentaId} className="flex flex-col gap-0.5 border-t border-borde pt-2 first:border-t-0 first:pt-0">
              <span className="flex justify-between gap-3"><span className="font-medium text-texto">{c.nombre}</span><span className="tabular-nums text-texto">{dif === null ? '—' : formatearSoles(c.sistemaCentimos + dif)}</span></span>
              <span className={unir('text-sm', dif === null ? 'text-texto-suave' : claseDeDiferencia(dif))}>{dif === null ? 'Sin contar' : textoDeDiferencia(dif)}</span>
              {dif && explicaciones[c.cuentaId]?.trim() ? <span className="text-sm text-texto-suave">{explicaciones[c.cuentaId]?.trim()}</span> : null}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="font-medium text-texto">
        {sinCuadrar === 0 ? 'Todo cuadra.' : `${sinCuadrar} ${sinCuadrar === 1 ? 'cuenta no cuadra' : 'cuentas no cuadran'}: ${textoDeDiferencia(totalCentimos)} en total.`}
      </p>
      <CampoTextarea etiqueta="Notas (opcional)" filas={2} maxLength={MAXIMO_DE_NOTAS} value={notas} onChange={(e) => alNotas(e.target.value)} />
    </section>
  );
}
