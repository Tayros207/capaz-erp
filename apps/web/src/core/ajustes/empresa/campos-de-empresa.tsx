import type { ConfiguracionDeEmpresa } from '@capaz/shared';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoTextarea } from '../../../shared/ui/campo-textarea.tsx';
import { MAXIMOS, type CampoDeTexto, type ErroresDeEmpresa, type FormularioDeEmpresa } from './logica-datos.ts';
import { EdicionDeLogo, LecturaDeLogo } from './seccion-logo.tsx';

export function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium whitespace-pre-line text-texto">{valor || <span className="font-normal text-texto-suave">Sin dato</span>}</dd>
    </div>
  );
}

export function LecturaDeIdentidad({ config }: { config: ConfiguracionDeEmpresa }) {
  return (
    <div className="flex flex-col gap-4">
      <LecturaDeLogo valor={config.logoDataUrl} />
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Razón social" valor={config.razonSocial} />
        <Dato etiqueta="RUC" valor={config.ruc} />
        <Dato etiqueta="Dirección fiscal" valor={config.direccionFiscal} />
        <Dato etiqueta="Teléfono" valor={config.telefono} />
        <Dato etiqueta="Correo" valor={config.correo} />
      </dl>
    </div>
  );
}

export function LecturaDePie({ config }: { config: ConfiguracionDeEmpresa }) {
  return (
    <dl>
      <Dato etiqueta="Pie de documento" valor={config.pieDeDocumento} />
    </dl>
  );
}

type PropsEdicion = {
  form: FormularioDeEmpresa;
  errores: ErroresDeEmpresa;
  cambiar: (parcial: Partial<FormularioDeEmpresa>) => void;
};

export function EdicionDeIdentidad({ form, errores, cambiar }: PropsEdicion) {
  const texto = (k: CampoDeTexto, etiqueta: string, extra: { type?: string; inputMode?: 'numeric' | 'tel' | 'email'; autoComplete?: string } = {}) => (
    <Campo etiqueta={etiqueta} value={form[k]} error={errores[k]} maxLength={MAXIMOS[k]} onChange={(e) => cambiar({ [k]: e.target.value })} {...extra} />
  );
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto">Logo</span>
        <EdicionDeLogo valor={form.logoDataUrl} onCambio={(logoDataUrl) => cambiar({ logoDataUrl })} />
      </div>
      {texto('razonSocial', 'Razón social')}
      {texto('ruc', 'RUC', { inputMode: 'numeric' })}
      {texto('direccionFiscal', 'Dirección fiscal')}
      {texto('telefono', 'Teléfono', { type: 'tel', inputMode: 'tel' })}
      {texto('correo', 'Correo', { type: 'email', inputMode: 'email' })}
    </div>
  );
}

export function EdicionDePie({ form, errores, cambiar }: PropsEdicion) {
  return (
    <div className="max-w-xl">
      <CampoTextarea
        etiqueta="Pie de documento"
        ayuda="Sale al pie de tus proformas y recibos: cuentas bancarias, Yape o Plin."
        filas={4}
        maxLength={MAXIMOS.pieDeDocumento}
        value={form.pieDeDocumento}
        error={errores.pieDeDocumento}
        onChange={(e) => cambiar({ pieDeDocumento: e.target.value })}
      />
    </div>
  );
}
