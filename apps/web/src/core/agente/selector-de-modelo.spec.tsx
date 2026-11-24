import type { ConfiguracionDelAgente, ModeloDelCatalogo } from '@capaz/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { etiquetasDeModelo } from './logica-modelos.ts';
import { SelectorDeModelo } from './selector-de-modelo.tsx';

const FLASH = 'deepseek/deepseek-v4.1-flash-1017';
const modelo = (o: Partial<ModeloDelCatalogo> = {}): ModeloDelCatalogo => ({
  id: FLASH, nombre: 'DeepSeek V4.1 Flash', nivel: 'experimental', descripcion: 'El más barato.', privacidad: 'revisar', evaluado: false, disponible: true,
  entradaMicrousdPorMillon: 270_000, salidaMicrousdPorMillon: 1_100_000, ...o,
});
const configuracion = (o: Partial<ConfiguracionDelAgente> = {}): ConfiguracionDelAgente => ({
  modelo: null, modeloEfectivo: FLASH, topeMensualMicrousd: null, topeEfectivoMicrousd: 5_000_000, escrituraDirecta: true, dineroDirecto: true, topePorOperacionCentimos: 100_000, internet: false, gastoDelMesMicrousd: 1_230_000, ...o,
});
const catalogo = [modelo(), modelo({ id: 'anthropic/claude-sonnet-5.5', nombre: 'Claude Sonnet 5.5', nivel: 'recomendado', privacidad: 'estandar', entradaMicrousdPorMillon: null, salidaMicrousdPorMillon: null }), modelo({ id: 'x/no-hoy', nombre: 'Modelo caído', disponible: false })];
const html = (o: { configuracion?: ConfiguracionDelAgente; puedeConfigurar?: boolean; ocupado?: boolean; preciosDisponibles?: boolean } = {}) =>
  renderToStaticMarkup(<SelectorDeModelo configuracion={o.configuracion ?? configuracion()} catalogo={catalogo} preciosDisponibles={o.preciosDisponibles ?? true} puedeConfigurar={o.puedeConfigurar ?? true} ocupado={o.ocupado ?? false} alElegir={() => {}} />);

describe('etiquetasDeModelo', () => {
  it('dice la verdad: nivel, precios por millón, sin evaluar y la privacidad', () => {
    expect(etiquetasDeModelo(modelo())).toEqual(['Experimental', 'entrada US$ 0.27 por millón', 'salida US$ 1.10 por millón', 'Sin evaluar', 'Revisar privacidad']);
  });
  it('un modelo evaluado y de privacidad estándar no lleva avisos; sin precios no inventa ninguno', () => {
    expect(etiquetasDeModelo(modelo({ evaluado: true, privacidad: 'estandar', entradaMicrousdPorMillon: null, salidaMicrousdPorMillon: null }))).toEqual(['Experimental']);
  });
  it('un modelo que el proveedor ya no ofrece lo dice', () => {
    expect(etiquetasDeModelo(modelo({ disponible: false }))).toContain('No disponible hoy');
  });
});

describe('SelectorDeModelo', () => {
  it('muestra el gasto del mes frente al tope', () => {
    expect(html()).toContain('Gasto de este mes: US$ 1.23 de US$ 5.00');
  });

  it('marca el modelo activo y solo ofrece «Usar este modelo» en los demás', () => {
    const h = html();
    expect(h).toContain('Activo');
    expect(h).not.toContain('aria-label="Usar DeepSeek V4.1 Flash"');
    expect(h).toContain('aria-label="Usar Claude Sonnet 5.5"');
  });

  it('un modelo no disponible no se puede elegir', () => {
    expect(html()).toMatch(/aria-label="Usar Modelo caído"[^>]*disabled|disabled[^>]*aria-label="Usar Modelo caído"/);
  });

  it('quien no administra la empresa ve el catálogo pero con los botones bloqueados y una nota', () => {
    const h = html({ puedeConfigurar: false });
    expect(h).toContain('Solo quien administra la empresa puede cambiar el modelo.');
    expect(h).toMatch(/aria-label="Usar Claude Sonnet 5.5"[^>]*disabled|disabled[^>]*aria-label="Usar Claude Sonnet 5.5"/);
  });

  it('sin precios disponibles lo avisa en lugar de mostrar números inventados', () => {
    expect(html({ preciosDisponibles: false })).toContain('No se pudieron consultar los precios ahora mismo.');
  });

  it('solo ofrece volver al modelo del sistema cuando la empresa había elegido uno', () => {
    expect(html()).not.toContain('Volver al modelo del sistema');
    expect(html({ configuracion: configuracion({ modelo: 'anthropic/claude-sonnet-5.5', modeloEfectivo: 'anthropic/claude-sonnet-5.5' }) })).toContain('Volver al modelo del sistema');
  });

  it('con un cambio en curso todo queda bloqueado', () => {
    expect(html({ ocupado: true })).toMatch(/aria-label="Usar Claude Sonnet 5.5"[^>]*disabled|disabled[^>]*aria-label="Usar Claude Sonnet 5.5"/);
  });
});
