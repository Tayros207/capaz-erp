import { describe, expect, it } from 'vitest';
import { mensajeDeCobro, telefonoParaWhatsapp, tonoDeCobro } from './mensaje-de-cobro.js';

const base = { cliente: 'Imprenta Sol SAC', empresa: 'Gráfica Andina', montoCentimos: 420_050, diasMasAntiguo: 10, telefono: '987654321' };

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

describe('tonoDeCobro', () => {
  it('sube con la antigüedad', () => {
    expect([1, 30, 31, 60, 61, 200].map(tonoDeCobro)).toEqual(['amable', 'amable', 'insistente', 'insistente', 'firme', 'firme']);
  });
});

describe('mensajeDeCobro', () => {
  it('nombra la empresa y el monto y arma el enlace con el texto codificado', () => {
    const m = mensajeDeCobro(base);
    expect(m.texto).toContain('Hola Imprenta Sol SAC, te saluda Gráfica Andina.');
    expect(m.texto).not.toMatch(/buenos días|buenas tardes/i);
    expect(m.texto).toContain('S/ 4,200.50');
    expect(m.enlaceWhatsapp).toBe(`https://wa.me/51987654321?text=${encodeURIComponent(m.texto)}`);
  });
  it('sin teléfono entrega solo el texto', () => {
    const m = mensajeDeCobro({ ...base, telefono: null });
    expect(m.enlaceWhatsapp).toBeNull();
    expect(m.texto).toContain('S/ 4,200.50');
  });
  it('sin nombre de empresa sigue siendo cordial y no queda una frase trunca', () => {
    const texto = mensajeDeCobro({ ...base, empresa: null }).texto;
    expect(texto.startsWith('Hola Imprenta Sol SAC, un saludo cordial. Te escribimos para recordarte')).toBe(true);
    expect(texto).not.toContain('Te escribimos.');
  });
  it('el enlace codifica todo el texto: acentos, signos y «&» no rompen la URL', () => {
    const m = mensajeDeCobro({ ...base, cliente: 'Pérez & Hijos ¿SAC?' });
    const [base_, consulta] = m.enlaceWhatsapp!.split('?text=');
    expect(base_).toBe('https://wa.me/51987654321');
    expect(consulta).not.toMatch(/[ &?¿#]/);
    expect(decodeURIComponent(consulta!)).toBe(m.texto);
  });
  it('el tono cambia: amable, insistente y firme sin perder la cortesía', () => {
    const amable = mensajeDeCobro(base).texto;
    const insistente = mensajeDeCobro({ ...base, diasMasAntiguo: 45 }).texto;
    const firme = mensajeDeCobro({ ...base, diasMasAntiguo: 90 }).texto;
    expect(amable).toContain('recordarte que tienes un saldo pendiente de S/ 4,200.50');
    expect(insistente).toContain('45 días de vencido');
    expect(firme).toContain('vencido hace 90 días');
    expect(firme).toContain('Agradecemos');
    expect(new Set([amable, insistente, firme]).size).toBe(3);
  });
});
