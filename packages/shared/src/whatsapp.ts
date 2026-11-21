// Ayudas de WhatsApp compartidas: puras. El sistema nunca envía el mensaje; solo arma el enlace que la persona abre a mano.

/**
 * Teléfono listo para `wa.me` (solo dígitos, con 51). Se aceptan celulares peruanos: 9 dígitos que empiezan con 9, con o
 * sin 51 delante (o +51, 0051). Un número de otro país solo si viene escrito con `+` o `00`. Lo demás (fijos, números
 * incompletos o con un dígito de más) devuelve `null`: mejor eso que abrir el chat de otra persona.
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

/** `https://wa.me/51…?text=…`, o `null` si el teléfono no sirve para WhatsApp. */
export function enlaceDeWhatsapp(telefono: string | null | undefined, texto: string): string | null {
  const tel = telefonoParaWhatsapp(telefono);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null;
}
