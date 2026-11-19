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
 * Teléfono listo para `wa.me` (solo dígitos, con 51): 9 dígitos se toman como celular peruano y se les antepone 51; con 51
 * o con `+`/`00` delante se respeta; cualquier otra cosa (fijos cortos, basura) devuelve `null` y queda el texto para copiar.
 */
export function telefonoParaWhatsapp(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '').replace(/^00/, '');
  if (/^9\d{8}$/.test(digitos)) return `51${digitos}`;
  if (/^51\d{9}$/.test(digitos)) return digitos;
  if (/^[1-9]\d{9,14}$/.test(digitos) && !/^9\d{8}$/.test(digitos)) return digitos;
  return null;
}

export type DatosDeMensajeDeCobro = {
  cliente: string;
  /** Nombre de la empresa que cobra; sin él, el texto sigue siendo cordial. */
  empresa: string | null;
  montoCentimos: number;
  diasMasAntiguo: number;
  telefono: string | null;
};



export function mensajeDeCobro(d: DatosDeMensajeDeCobro): MensajeDeCobro {
  const monto = formatearSoles(d.montoCentimos);
  const de = d.empresa ? ` de ${d.empresa}` : '';
  const saludo = `Hola ${d.cliente}, buenos días. Te escribimos${de}.`;
  const cuerpo = {
    amable: `Te recordamos con mucho gusto que tienes un saldo pendiente de ${monto}. Cuando puedas, avísanos para coordinar el pago. ¡Gracias por tu preferencia!`,
    insistente: `Revisando nuestras cuentas vemos que sigue pendiente un saldo de ${monto}, con ${d.diasMasAntiguo} días de vencido. ¿Nos confirmas por favor cuándo podrías cancelarlo? Quedamos atentos.`,
    firme: `Tu cuenta tiene un saldo de ${monto} vencido hace ${d.diasMasAntiguo} días. Te pedimos regularizarlo a la brevedad, o escribirnos para acordar una fecha de pago. Agradecemos tu comprensión.`,
  }[tonoDeCobro(d.diasMasAntiguo)];
  const texto = `${saludo} ${cuerpo}`;
  const tel = telefonoParaWhatsapp(d.telefono);
  return { texto, enlaceWhatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null };
}
