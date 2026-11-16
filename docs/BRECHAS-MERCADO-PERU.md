# Brechas frente a lo que piden las empresas en Perú (insumo del usuario, 2026-11-16)

**Origen:** texto pegado por el usuario (resumen de requisitos de ERP en Perú: logística y kardex, planillas, ventas/cobranzas/POS, y sistemas por tamaño de empresa). Las afirmaciones legales y de mercado del texto **no están verificadas por nosotros**; las obligaciones concretas (qué régimen tributario exige kardex valorizado, PLE, PLAME, T-Registro) deben confirmarse con un contador antes de construir.

**Pregunta abierta del texto, que solo responde el usuario:** rubro del negocio (comercio, servicios, construcción, agroindustria, transporte) y tamaño de la empresa del cliente 2. Eso define el orden.

## Comparación con lo construido (verificado contra el código de `main`)

| Área del texto | Qué pide | Qué tiene Capaz hoy | Brecha |
|---|---|---|---|
| Kardex físico | Entradas y salidas exactas | `insumos`: movimientos de solo inserción, existencia por artículo y sucursal, nunca negativa, ajustes con confirmación | Cubierto en lo físico |
| Kardex **valorizado** | Promedio ponderado o PEPS | Solo «último costo» informativo (decisión P3-2) | **Falta** costeo y valorización |
| Multialmacén | Varios almacenes | Existencia por **sucursal** (un almacén por sucursal) | **Falta** varios almacenes por sucursal y traslados entre ellos |
| Lotes, vencimientos, series | Alimentos, farmacias, agroindustria | Nada (fuera de alcance explícito en FICHAS-OLA-3 §0) | **Falta** |
| Importaciones | Prorrateo de flete, seguro, DUA a costo unitario | Nada | **Falta** (solo si el cliente importa) |
| Planillas | Gratificación, CTS, vacaciones, utilidades, AFP/ONP | `personal`: colaboradores, asistencia, adelantos; sin planilla (decisión: se conecta, no se construye) | **Falta** por decisión; evaluar integración con un sistema de planillas |
| PLAME / T-Registro / pagos masivos | Archivos planos para SUNAT y bancos | Nada | **Falta** |
| Cotizaciones y pedidos | Ciclo comercial | `ordenes` (pedidos), CRM; proforma en la ronda 1 de mejoras | Parcial (proforma pendiente) |
| Listas de precios por canal | Mayorista/minorista | Un precio por producto | **Falta** |
| Líneas de crédito por cliente | Límite y control | No existe límite de crédito | **Falta** |
| Cuentas por cobrar | Vencimientos, adelantos, abonos | `registro`: deudas, abonos, vencidos, transferencias | Cubierto; **faltan** letras por cobrar y antigüedad de saldos |
| Conciliación bancaria | Cruce con extractos | Nada | **Falta** |
| POS / punto de venta | Venta rápida y caja | Nada (planeado como «Mostrador», ola 4) | **Falta** |
| Facturación electrónica y libros | SUNAT, PLE | Aplazado a «etapa final» (decisión del 14-nov); propuesta en `PROPUESTA-VENTA-A-TERCEROS.md` | Por decisión |

## Lectura para la estrategia (propuesta, no decisión)

- Lo construido encaja con **servicios y talleres** (gráfica) y con comercio muy pequeño. Para **comercio, distribución e importación** faltan, en este orden de peso: kardex valorizado, multialmacén con traslados, lotes/series, listas de precio y crédito por cliente, POS, y facturación electrónica.
- Para no inflar el núcleo, lo razonable es **paquetes por sector** (verticales activables por empresa, como ya funciona con los módulos): «Comercio y distribución», «Taller gráfico», «Servicios». Cada paquete se activa en la consola, y el núcleo no cambia.
- Planillas es un salto grande y regulado: la recomendación sigue siendo **integrar** (exportar a un sistema de planillas) y no construir.
- Referencias del texto (SAP, Odoo, Defontana, Softland, StarSoft, Concar, Contasis, iGEA, Rapifac) quedan como inspiración de ideas, nunca de copia (regla 12).

## Siguiente paso sugerido
Cuando el usuario diga el rubro del cliente 2, convertir la fila de brechas que corresponda en una ronda concreta (ficha congelada → carriles), empezando por la que más pese para ese rubro.
