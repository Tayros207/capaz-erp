import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { WebhookSaliente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { archivarWebhook, crearWebhook, editarWebhook } from './api.ts';
import { CLAVE_WEBHOOKS } from './claves.ts';
import { EnviosDeWebhook } from './envios-de-webhook.tsx';
import type { SecretoMostrado } from './hoja-secreto.tsx';
import { eventosDeTexto, validarNombre, validarUrlDeWebhook } from './logica.ts';

/** `null` = cerrada, `'nuevo'` = alta, o el webhook que se edita. */
export type WebhookElegido = WebhookSaliente | 'nuevo' | null;
type Props = { elegido: WebhookElegido; puedeGestionar: boolean; alCerrar: () => void; alMostrarSecreto: (s: SecretoMostrado) => void };

function Contenido({ webhook, puedeGestionar, alCerrar, alMostrarSecreto }: Omit<Props, 'elegido'> & { webhook: WebhookSaliente | null }) {
  const consultas = useQueryClient();
  const [nombre, setNombre] = useState(webhook?.nombre ?? '');
  const [url, setUrl] = useState(webhook?.url ?? '');
  const [eventos, setEventos] = useState(webhook?.eventos.join(', ') ?? '');
  const [activo, setActivo] = useState(webhook?.activo ?? true);
  const [errores, setErrores] = useState<{ nombre?: string; url?: string; eventos?: string }>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const editable = puedeGestionar;

  const terminar = async (mensaje: string) => {
    await consultas.invalidateQueries({ queryKey: CLAVE_WEBHOOKS });
    notificar(mensaje, 'exito');
  };

  async function guardar() {
    const ev = eventosDeTexto(eventos);
    const e = { nombre: validarNombre(nombre, 'al webhook'), url: validarUrlDeWebhook(url), eventos: ev.ok ? undefined : ev.error };
    setErrores(e);
    if (e.nombre || e.url || !ev.ok) return;
    setOcupado(true);
    setAviso(undefined);
    const datos = { nombre: nombre.trim(), url: url.trim(), eventos: ev.eventos };
    const r = webhook ? await editarWebhook({ id: webhook.id, ...datos, activo }) : await crearWebhook(datos);
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      await terminar(webhook ? 'Webhook actualizado.' : 'Webhook creado.');
      alCerrar();
      if (r.datos.secreto) alMostrarSecreto({ titulo: 'Secreto de firma', explicacion: `Con este secreto tu sistema verifica que cada envío de «${r.datos.nombre}» viene de Capaz.`, etiqueta: 'Secreto de firma', valor: r.datos.secreto });
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  async function rotar() {
    if (!webhook) return;
    if (!(await confirmar('Rotar el secreto', 'El secreto actual deja de valer: tendrás que poner el nuevo en tu sistema.', { textoConfirmar: 'Rotar secreto', peligroso: true }))) return;
    setOcupado(true);
    const r = await editarWebhook({ id: webhook.id, rotarSecreto: true });
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      await terminar('Secreto rotado.');
      alCerrar();
      if (r.datos.secreto) alMostrarSecreto({ titulo: 'Secreto de firma nuevo', explicacion: 'El secreto anterior ya no sirve.', etiqueta: 'Secreto de firma', valor: r.datos.secreto });
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  async function archivar() {
    if (!webhook) return;
    if (!(await confirmar('Archivar el webhook', `«${webhook.nombre}» dejará de recibir envíos.`, { textoConfirmar: 'Archivar', peligroso: true }))) return;
    setOcupado(true);
    const r = await archivarWebhook(webhook.id);
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      await terminar('Webhook archivado.');
      alCerrar();
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  return (
    <div className="flex flex-col gap-4">
      <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
        <fieldset disabled={ocupado || !editable} className="grid min-w-0 gap-3">
          <Campo etiqueta="Nombre" value={nombre} error={errores.nombre} autoComplete="off" onChange={(e) => setNombre(e.target.value)} />
          <Campo etiqueta="Dirección que recibe los envíos" type="url" inputMode="url" placeholder="https://" value={url} error={errores.url} autoComplete="off" onChange={(e) => setUrl(e.target.value)} />
          <Campo etiqueta="Eventos" ayuda="Separados por coma: «cliente.creado», una familia «cliente.*» o «*» para todo." value={eventos} error={errores.eventos} autoComplete="off" onChange={(e) => setEventos(e.target.value)} />
          {webhook ? (
            <CampoSelect etiqueta="Estado" value={activo ? 'si' : 'no'} onChange={(e) => setActivo(e.target.value === 'si')}>
              <option value="si">Activo</option>
              <option value="no">En pausa</option>
            </CampoSelect>
          ) : null}
        </fieldset>
        {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {webhook && editable ? <Boton variante="peligro" disabled={ocupado} onClick={() => void archivar()}>Archivar</Boton> : null}
          {webhook && editable ? <Boton disabled={ocupado} onClick={() => void rotar()}>Rotar secreto</Boton> : null}
          <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
          {editable ? <Boton type="submit" variante="primario" cargando={ocupado}>{webhook ? 'Guardar' : 'Crear webhook'}</Boton> : null}
        </div>
      </form>
      {webhook ? (
        <section className="flex flex-col gap-2 border-t border-borde pt-3">
          <h3 className="font-titulo font-semibold">Historial de envíos</h3>
          <EnviosDeWebhook webhookId={webhook.id} puedeGestionar={puedeGestionar} />
        </section>
      ) : null}
    </div>
  );
}

export function HojaWebhook({ elegido, ...resto }: Props) {
  const webhook = elegido && elegido !== 'nuevo' ? elegido : null;
  return (
    <HojaInferior abierto={elegido !== null} alCerrar={resto.alCerrar} titulo={webhook ? `Webhook · ${webhook.nombre}` : 'Nuevo webhook'}>
      {elegido !== null ? <Contenido key={webhook?.id ?? 'nuevo'} webhook={webhook} {...resto} /> : null}
    </HojaInferior>
  );
}
