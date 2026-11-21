import { describe, expect, it } from 'vitest';
import { enlaceDeWhatsapp, telefonoParaWhatsapp } from './whatsapp.js';

describe('telefonoParaWhatsapp', () => {
  it('un celular de 9 dígitos recibe el 51', () => {
    expect(telefonoParaWhatsapp('987 654 321')).toBe('51987654321');
    expect(telefonoParaWhatsapp('987-654-321')).toBe('51987654321');
  });
  it('respeta un número que ya trae el 51, con + o 00', () => {
    expect(telefonoParaWhatsapp('+51 987 654 321')).toBe('51987654321');
    expect(telefonoParaWhatsapp('0051987654321')).toBe('51987654321');
  });
  it('sin teléfono, o con algo que no sirve, devuelve null', () => {
    expect(telefonoParaWhatsapp(null)).toBeNull();
    expect(telefonoParaWhatsapp('')).toBeNull();
    expect(telefonoParaWhatsapp('4567')).toBeNull();
    expect(telefonoParaWhatsapp('sin celular')).toBeNull();
  });
  it('no adivina: un fijo, un celular con un dígito de más o de menos y un 51 sin celular no abren WhatsApp', () => {
    expect(telefonoParaWhatsapp('(01) 456-7890')).toBeNull();
    expect(telefonoParaWhatsapp('01 4567890')).toBeNull();
    expect(telefonoParaWhatsapp('9876543210')).toBeNull();
    expect(telefonoParaWhatsapp('98765432')).toBeNull();
    expect(telefonoParaWhatsapp('+51 1 4567890')).toBeNull();
    expect(telefonoParaWhatsapp('5114567890')).toBeNull();
  });
  it('un número de otro país solo si viene con + o 00', () => {
    expect(telefonoParaWhatsapp('+1 305 555 0100')).toBe('13055550100');
    expect(telefonoParaWhatsapp('0034 612 345 678')).toBe('34612345678');
    expect(telefonoParaWhatsapp('13055550100')).toBeNull();
  });
});

describe('enlaceDeWhatsapp', () => {
  it('arma el enlace con el texto codificado', () => {
    expect(enlaceDeWhatsapp('987654321', 'Hola, ¿qué tal?')).toBe(`https://wa.me/51987654321?text=${encodeURIComponent('Hola, ¿qué tal?')}`);
  });
  it('un teléfono fijo o ausente no da enlace', () => {
    expect(enlaceDeWhatsapp('(01) 456-7890', 'Hola')).toBeNull();
    expect(enlaceDeWhatsapp(null, 'Hola')).toBeNull();
  });
});
