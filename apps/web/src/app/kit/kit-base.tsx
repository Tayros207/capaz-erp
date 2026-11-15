import { useState, type ReactNode } from 'react';
import type { Centimos } from '@capaz/shared';
import { PREFERENCIAS_DE_TEMA } from '../../shared/estilos/tema.ts';
import { useTema } from '../../shared/estilos/use-tema.ts';
import { Boton, type VarianteDeBoton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { Dialogo } from '../../shared/ui/dialogo.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { ICONOS, type NombreDeIcono } from '../../shared/ui/iconos.tsx';
import { Insignia, type TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import { notificar, type TipoDeAviso } from '../../shared/ui/notificar.ts';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-borde pb-1 font-titulo text-xl font-semibold">{titulo}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function Tema() {
  const { preferencia, tema, fijar } = useTema();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <CampoSelect
        etiqueta="Tema"
        value={preferencia}
        onChange={(e) => fijar(e.target.value as (typeof PREFERENCIAS_DE_TEMA)[number])}
        ayuda={`Tema activo: ${tema}`}
      >
        {PREFERENCIAS_DE_TEMA.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </CampoSelect>
    </div>
  );
}

const VARIANTES: VarianteDeBoton[] = ['primario', 'secundario', 'fantasma', 'peligro'];

function Botones() {
  return (
    <Seccion titulo="Boton">
      {VARIANTES.map((v) => (
        <div key={v} className="flex flex-col gap-2">
          <Boton variante={v}>{v}</Boton>
          <Boton variante={v} icono="mas">Con icono</Boton>
          <Boton variante={v} cargando>Cargando</Boton>
          <Boton variante={v} disabled>Deshabilitado</Boton>
          <Boton variante={v} tamano="grande">Grande</Boton>
          <Boton variante={v} icono="buscar" aria-label={`Buscar (${v})`} />
        </div>
      ))}
    </Seccion>
  );
}

function Campos() {
  const [monto, setMonto] = useState<Centimos | null>(null);
  return (
    <Seccion titulo="Campo, CampoMonto y CampoSelect">
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" placeholder="Escribe un nombre" />
        <Campo etiqueta="Con ayuda" ayuda="Texto que orienta a quien escribe." />
        <Campo etiqueta="Con error" defaultValue="abc" error="Este dato no es válido." />
        <Campo etiqueta="Deshabilitado" defaultValue="No editable" disabled />
        <CampoMonto etiqueta="Monto" valor={monto} alCambiar={setMonto} ayuda={`En céntimos: ${monto ?? 'vacío'}`} />
        <CampoMonto etiqueta="Monto con error" valor={null} alCambiar={() => {}} error="El monto es obligatorio." />
        <CampoSelect etiqueta="Selector">
          <option>Primera opción</option>
          <option>Segunda opción</option>
        </CampoSelect>
        <CampoSelect etiqueta="Selector con error" error="Elige una opción.">
          <option value="">Elige…</option>
        </CampoSelect>
      </div>
    </Seccion>
  );
}

function Capas() {
  const [dialogo, setDialogo] = useState(false);
  const [hoja, setHoja] = useState(false);
  return (
    <Seccion titulo="Dialogo, HojaInferior y confirmar()">
      <Boton onClick={() => setDialogo(true)}>Abrir diálogo</Boton>
      <Boton onClick={() => setHoja(true)}>Abrir hoja inferior</Boton>
      <Boton onClick={() => void confirmar('¿Continuar?', 'Esta acción se puede deshacer.').then((r) => notificar(r ? 'Aceptado' : 'Cancelado'))}>
        confirmar()
      </Boton>
      <Boton
        variante="peligro"
        onClick={() => void confirmar('¿Eliminar?', 'Esta acción no se puede deshacer.', { textoConfirmar: 'Eliminar', peligroso: true }).then((r) => notificar(r ? 'Eliminado' : 'Cancelado', r ? 'exito' : 'info'))}
      >
        confirmar() peligroso
      </Boton>
      <Dialogo abierto={dialogo} alCerrar={() => setDialogo(false)} titulo="Título del diálogo" acciones={<Boton variante="primario" onClick={() => setDialogo(false)}>Entendido</Boton>}>
        <p>Contenido del diálogo. Escape y el botón de cerrar lo cierran; el foco queda dentro.</p>
      </Dialogo>
      <HojaInferior abierto={hoja} alCerrar={() => setHoja(false)} titulo="Título de la hoja">
        <p>Contenido de la hoja inferior. En móvil sube desde abajo.</p>
        <div className="mt-3"><Campo etiqueta="Un campo dentro" /></div>
      </HojaInferior>
    </Seccion>
  );
}

const TONOS: TonoDeInsignia[] = ['neutro', 'exito', 'aviso', 'peligro', 'info'];
const AVISOS: TipoDeAviso[] = ['exito', 'info', 'aviso', 'error'];

function Etiquetas() {
  return (
    <>
      <Seccion titulo="Insignia">
        {TONOS.map((t) => <Insignia key={t} tono={t}>{t}</Insignia>)}
      </Seccion>
      <Seccion titulo="notificar()">
        {AVISOS.map((t) => <Boton key={t} onClick={() => notificar(`Aviso de tipo ${t}`, t)}>{t}</Boton>)}
      </Seccion>
    </>
  );
}

function Estados() {
  return (
    <>
      <Seccion titulo="EstadoVacio">
        <div className="w-full rounded-tarjeta border border-borde bg-superficie">
          <EstadoVacio titulo="Aún no hay clientes" descripcion="Crea el primero para empezar." icono="usuario" accion={<Boton variante="primario" icono="mas">Nuevo cliente</Boton>} />
        </div>
        <div className="w-full rounded-tarjeta border border-borde bg-superficie">
          <EstadoVacio titulo="Con marca de ejemplo" descripcion="Datos de muestra." ejemplo />
        </div>
      </Seccion>
      <Seccion titulo="Esqueleto">
        <div className="flex w-full flex-col gap-2" aria-busy="true">
          <Esqueleto className="w-1/3" />
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="w-2/3" />
        </div>
      </Seccion>
    </>
  );
}

function Iconos() {
  return (
    <Seccion titulo="Icono">
      {(Object.keys(ICONOS) as NombreDeIcono[]).map((n) => (
        <div key={n} className="flex w-24 flex-col items-center gap-1 rounded-control border border-borde bg-superficie p-2 text-center text-xs">
          <Icono nombre={n} className="size-6" />
          {n}
        </div>
      ))}
    </Seccion>
  );
}

const PALETA = ['fondo', 'superficie', 'superficie-alta', 'accion', 'peligro', 'aviso', 'exito', 'info', 'menu', 'acento-esmeralda', 'acento-cian', 'acento-ambar', 'acento-rosa', 'acento-gris'];

function Colores() {
  return (
    <Seccion titulo="Tokens de color">
      {PALETA.map((c) => (
        <div key={c} className="flex w-28 flex-col gap-1 text-xs">
          <div className="h-10 rounded-control border border-borde-fuerte" style={{ background: `var(--color-${c})` }} />
          {c}
        </div>
      ))}
    </Seccion>
  );
}

/** Kit base de la fase 6a-1, cada pieza en todos sus estados. Lo revisa una persona a 390 y 1280 px. */
export function KitBase() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-titulo text-3xl font-semibold">Kit de interfaz</h1>
        <p className="text-texto-suave">Solo en desarrollo. Cambia el tema y revisa cada pieza.</p>
        <Tema />
      </header>
      <Botones />
      <Campos />
      <Capas />
      <Etiquetas />
      <Estados />
      <Iconos />
      <Colores />
    </div>
  );
}
