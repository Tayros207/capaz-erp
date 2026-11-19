import { formatearSoles, type MensajeDeCobro } from '@capaz/shared';

// Mensaje de cobro: puro, sin base ni framework. Redacta un texto cordial en español peruano y arma el enlace de WhatsApp
// que se abre a mano: el sistema nunca lo envía. El tono sube con la antigüedad de la deuda más vieja.

export type TonoDeCobro = 'amable' | 'insistente' | 'firme';

/** Hasta 30 días vencida, recordatorio amable; de 31 a 60, se insiste; de 61 en adelante, firme y cordial. */
export function tonoDeCobro(diasMasAntiguo: number): TonoDeCobro {
  if (diasMasAntiguo <= 30) return 'amable';
  return diasMasAntiguo <= 60 ? 'insistente' : 'firme';
}

/**
 * Teléfono listo para `wa.me` (solo dígitos, con 51). Se aceptan celulares peruanos: 9 dígitos que empiezan con 9, con o
 * sin 51 delante (o +51, 0051). Un número de otro país solo si viene escrito con `+` o `00`. Lo demás (fijos, números
 * incompletos o con un dígito de más) devuelve `null` y queda el texto para copiar: mejor eso que abrir el chat de otra persona.
 */
export function telefonoParaWhatsapp(telefono: string | null | undefined): string | null {
  const crudo = (telefono ?? '').trim();
  const internacional = /^(\+|00)/.test(crudo);
  const digitos = crudo.replace(/\D/g, '').replace(/^00/, '');
  if (/^9\d{8}$/.test(digitos)) return `51${digitos}`;
  if (/^519\d{8}$/.test(digitos)) return digitos;
  if (internacional && !digitos.startsWith('51') && /^[1-9]\d{7,14}$/.test(digitos)) return digitos;
  return null;
}

export type DatosDeMensajeDeCobro = {
  cliente: string;
  /** Nombre de la empresa que cobra; sin él, el saludo sigue siendo cordial (y el panel avisa que falta la razón social). */
  empresa: string | null;
  montoCentimos: number;
  diasMasAntiguo: number;
  telefono: string | null;
};

/** Sirve a cualquier hora (sin «buenos días») y dice de parte de quién se escribe si se conoce. */
const saludoDe = (cliente: string, empresa: string | null): string => (empresa ? `Hola ${cliente}, te saluda ${empresa}.` : `Hola ${cliente}, un saludo cordial.`);

export function mensajeDeCobro(d: DatosDeMensajeDeCobro): MensajeDeCobro {
  const monto = formatearSoles(d.montoCentimos);
  const cuerpo = {
    amable: `Te escribimos para recordarte que tienes un saldo pendiente de ${monto}. Cuando puedas, avísanos para coordinar el pago. ¡Gracias por tu preferencia!`,
    insistente: `Revisando nuestras cuentas vemos que sigue pendiente un saldo de ${monto}, con ${d.diasMasAntiguo} días de vencido. ¿Nos confirmas por favor cuándo podrías cancelarlo? Quedamos atentos.`,
    firme: `Tu cuenta tiene un saldo de ${monto} vencido hace ${d.diasMasAntiguo} días. Te pedimos regularizarlo a la brevedad, o escribirnos para acordar una fecha de pago. Agradecemos tu comprensión.`,
  }[tonoDeCobro(d.diasMasAntiguo)];
  const texto = `${saludoDe(d.cliente.trim(), d.empresa)} ${cuerpo}`;
  const tel = telefonoParaWhatsapp(d.telefono);
  return { texto, enlaceWhatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null };
}
