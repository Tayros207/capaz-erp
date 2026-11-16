# Propuesta de mejoras · Auditoría de brechas de Capaz ERP

**Fecha:** 2026-11-16 · **Rama revisada:** `main` (commit `e8473e4`) · **Estado:** propuesta; no cambia código ni decisiones ya tomadas.
**Para:** Moisés (dueño) y Keny (técnico). Léase junto con `docs/RELEVO.md`.

**Cómo leer las tablas**

- **Prioridad:** **P1** imprescindible para el uso real en el taller · **P2** importante · **P3** deseable.
- **Esfuerzo:** **S** = una sesión de un agente (un carril pequeño) · **M** = dos o tres sesiones, o un carril de servidor más uno de pantallas · **L** = más de una ronda, o depende de un servicio externo o de una migración delicada.
- **Riesgo:** B bajo · M medio · A alto (dinero, seguridad o privacidad).
- **TD** (trabajador digital): **Sí** = el sistema propone y la persona aprueba · **Parcial** = el sistema ayuda o redacta, la persona actúa · **—** = pantalla o dato, sin propuesta automática.
- **Verificación:** todo lo que dice «no existe» se buscó en el código (archivo citado). Lo que no se pudo comprobar dice **«no verificado»**.

---

## 1. Resumen para el dueño

1. **La base está bien hecha.** El núcleo y los siete módulos funcionan. Lo que falta no son más módulos: falta **cerrar el circuito diario del taller**, que va de la proforma al pedido, el adelanto, la producción, la entrega y el cobro, con un papel o PDF que se pueda mandar por WhatsApp.
2. **Hoy no se puede imprimir ni sacar PDF de nada**: ni proforma, ni pedido, ni orden de trabajo, ni recibo, ni estado de cuenta. Además la empresa no tiene cargados su razón social, RUC, dirección ni logo para ponerlos en un documento. **Es la brecha número 1.**
3. **En Finanzas faltan dos cosas que se usan a diario.** No hay botón para anotar a mano una deuda (la función ya existe, solo falta el botón). Y no hay forma de pasar dinero de la caja al banco o de Yape al banco sin que ese paso cuente como un ingreso y un gasto más.
4. **La ficha del cliente solo muestra sus datos.** No muestra sus pedidos, lo que debe, lo que ha pagado ni sus oportunidades. Toda esa información ya está en los módulos y se puede juntar en una sola pantalla sin cambiar la base de datos.
5. **Falta un arranque guiado para el primer día de uso real.** Debería pedir los datos de la empresa, las cuentas con su saldo inicial y la importación de los clientes y de las deudas que ya existían.
6. **Administrar a las otras empresas:** la consola existe, pero **no aparece en el menú** y la ficha de cada empresa trae poca información. Recomiendo un **diseño mixto**: una consola con la ficha de cada cuenta y el uso que hace del sistema, y que **Datayros use su propio CRM y su propio módulo de Finanzas** para vender y cobrar Capaz. Es una sola pieza para los dos usos, como se decidió el 11 de noviembre.
7. **Hay que cerrar tres huecos de seguridad de la consola antes del segundo cliente:** el enlace para restablecer la contraseña lleva a una página que no existe; un operador puede tomar la cuenta de otro operador; y no hay segundo factor de acceso.
8. **Lo que Pedidos necesita para un taller gráfico**, por orden: proforma imprimible, adelanto al confirmar, descuento, etapas de producción (diseño, aprobación del arte, impresión, acabados), especificaciones por línea y, al final, archivos de arte.
9. **Inventario y Compras no convierten unidades.** Si se compra en millares o resmas y se guarda en pliegos, las existencias pueden quedar mal. Tampoco se descuenta el papel que gasta un pedido.
10. **Propuesta: cuatro rondas pequeñas.** La ronda 1 es la que da más valor por esfuerzo: imprimir, datos de la empresa, deuda a mano, transferencias, adelanto, y la consola visible y segura. **Casi todo se hace en pantallas, sin tablas nuevas.**

**Requisito previo (Keny, fuera de estas rondas):** nada de esto llega al taller sin el despliegue con HTTPS, las migraciones `0006` a `0020` aplicadas en Neon, el código en GitHub y los secretos de producción (`RELEVO.md`, pendientes 1 a 3).

### Ya existe, pero está escondido o a medias (no hay que construirlo de cero)

| Pieza | Qué hay | Qué falta para que se use | Dónde |
|---|---|---|---|
| Consola de plataforma | 4 pantallas y 13 herramientas | Entrada en el menú; `yo` no dice si la persona es operador | `apps/web/src/plataforma/`, `app/carcasa/menu.ts`, `packages/shared/src/yo.ts` |
| Alta de deuda | Herramienta `deuda_crear` | Botón y hoja en la pantalla | `contratos/registro.ts`; la web no la llama (`modules/registro/api.ts`) |
| Datos del cliente en otros módulos | `pedidos_listar.clienteId`, `deudas_listar.contactoId`, `movimientos_listar.contactoId`, `oportunidades_listar.clienteId`, `compras_listar.proveedorId` | La pantalla que los junta (vista 360) | `contratos/*.ts` |
| Fusión de clientes | Columna `fusionado_en` y búsqueda por parecido | La herramienta (decisión P3-9, aplazada) | `esquema/core-maestros.ts` |
| Campos libres | `datos_extra` (jsonb) en clientes, productos, pedidos, deudas y movimientos | No está en los contratos | `esquema/*.ts` |
| Gráfico en el tiempo | `GraficoDeLinea` y el campo `serie` en Reportes | Ningún `_resumen` entrega `serie`: el gráfico nunca aparece | `modules/reportes/bloque-de-modulo.tsx`, `apps/api/src/modules/*/herramientas/` |
| Puente por webhooks | Entrada de webhooks con clave de API; reglas con disparador `webhook`, modo `borrador` y textos con `{{dato}}` | Usarlo para conectar la plataforma con la empresa Datayros | `core/conectores/entrada.controller.ts`, `contratos/automatizaciones.ts` |
| Historial por registro | `auditoria_listar` filtra por `entidadTipo` y `entidadId` | Mostrarlo en cada ficha (Pedidos ya muestra el suyo) | `contratos/auditoria.ts` |

---

## 2. Frente A · Administración de las otras empresas (Datayros gestiona a sus clientes)

### 2.1 Qué hay hoy (verificado)

- **Consola `/plataforma`** con tres pestañas, Empresas, Planes y Solicitudes, más la ficha de cada empresa. Desde ella se puede:
  - crear una empresa indicando el correo de su dueño;
  - activar un módulo (con días de prueba o sin ellos), suspenderlo, darlo de baja o reactivarlo;
  - fijar el contrato de cada módulo: plan, precio acordado, vigencia y máximo de usuarios;
  - mantener el catálogo de planes;
  - atender o descartar solicitudes;
  - generar un enlace para restablecer una contraseña.

  Todo pasa por `/api/v1/plataforma/herramientas/:nombre` y queda registrado en `core.auditoria_plataforma`.
- **Ficha de empresa:** muestra el alta, los miembros, la última actividad, los módulos con su contrato y el historial de contratos. No guarda nada más.
- **La consola está escondida.** `menu.ts` no tiene una entrada para ella y `yoSchema` no trae ningún dato de operador, así que solo se llega escribiendo `/plataforma`.
- **La consola se ve dentro de la carcasa de la empresa activa:** la captura `u-plataforma.png` muestra la barra lateral y la cabecera de «Atlantisgraf (demo)». Así se confunde «estoy en mi empresa» con «estoy administrando Capaz».
- **La lista muestra códigos internos** («compras: En prueba», «insumos») en lugar de los nombres de los módulos. Además, no hay forma de archivar las empresas de prueba: en la captura aparecen tres «Imprenta Recorrido».
- **No existe:**
  - contacto ni datos de facturación de la empresa cliente;
  - notas, seguimiento ni estado comercial;
  - salud de uso, más allá de la «última actividad»;
  - el resumen de ingresos acordados (pantalla 5 de `PLATAFORMA-Y-PLANES.md` §5);
  - una vista de vencimientos;
  - **aplicar un plan**: los planes son solo un catálogo, el plan se anota módulo por módulo y al crear una empresa solo se activan los módulos por defecto;
  - convertir una solicitud en oportunidad del CRM (`eventosDePlataforma = {}`);
  - roles de operador: hay un solo nivel, `core.plataforma_admins`;
  - segundo factor de acceso: no hay complemento de dos factores en `core/auth`;
  - la pantalla `/restablecer-contrasena`.

### 2.2 Tres diseños posibles

**Diseño 1 · Consola autosuficiente (un pequeño CRM dentro de la consola).** Todo lo comercial vive en tablas de la plataforma: ficha de cuenta, contactos, notas, seguimientos, embudo de prospectos y cobros.
- *A favor:* todo está en un solo lugar y no depende de que Datayros sea una empresa dentro de Capaz.
- *En contra:* obliga a construir un segundo CRM. Contradice la decisión del 11-nov. Cada mejora del CRM (contactos, actividades) habría que hacerla dos veces. Y crece lo que maneja el rol `capaz_sistema`, que cruza empresas, así que hay más riesgo. **Esfuerzo L.**

**Diseño 2 · Datayros es una empresa más (un solo CRM y una consola mínima).** La consola se queda como está. Toda la relación comercial vive en la empresa «Datayros» dentro de Capaz: cada imprenta es un cliente de Datayros, los prospectos y las renovaciones son oportunidades de su CRM y las mensualidades son cuentas por cobrar de su módulo de Finanzas.
- *A favor:* no hay que construir piezas nuevas. Datayros usa su propio producto todos los días, que es la mejor prueba de calidad posible. Y lo que se mejore para los clientes (frente B) también le sirve a Datayros.
- *En contra:* al mirar una empresa en la consola no se ve ni su contacto ni sus notas. El vínculo entre el cliente del CRM y la empresa de la consola se lleva a mano. Y la salud de uso y el arranque guiado no tienen dónde vivir. **Esfuerzo S.**

**Diseño 3 · Consola de cuentas más un puente al CRM y a Finanzas de Datayros (RECOMENDADO).** Cada lado guarda lo suyo:
- la **consola** guarda lo **operativo** de cada cuenta: quién es, su contrato, cómo usa el sistema, en qué va su arranque y el soporte;
- la **empresa Datayros** guarda lo **comercial** en sus propios módulos: el embudo y el seguimiento en el CRM, y el cobro en Finanzas.

Un puente une ambos lados:

- **Ficha de cuenta en la consola:** razón social y RUC para facturar, contacto principal (nombre, teléfono y correo), estado comercial (prueba, cliente, en riesgo, suspendida, baja), responsable en Datayros, una nota interna corta y el enlace «Abrir en el CRM de Datayros».
- **Salud de la cuenta, solo con cifras:** última actividad, usuarios activos en los últimos 7 y 30 días, operaciones por módulo en 30 días (solo conteos, nunca contenido), pruebas por vencer y solicitudes pendientes. Con eso se arma un semáforo verde, ámbar o rojo.
- **Arranque de la cuenta:** una lista de pasos que se marcan solos (tiene sucursal, invitó usuarios, importó clientes, creó cuentas, registró su primer movimiento y su primer pedido). Para la plataforma son solo respuestas de sí o no.
- **Alta guiada:** crear la empresa y **aplicarle un plan** en un solo paso. El plan funciona como plantilla de módulos y activa los suyos con días de prueba.
- **Vencimientos:** pruebas y vigencias que vencen en los próximos 7 o 15 días, más el total de ingresos mensuales acordados.
- **Puente:** la plataforma avisa de ciertos hechos (una solicitud nueva, una prueba o una vigencia por vencer, una cuenta en riesgo). Lo hace por la **entrada de webhooks de la empresa Datayros**, con su propia clave de API. En Datayros, unas reglas con disparador `webhook` y modo `borrador` **proponen en la bandeja** cosas como:
  - «Oportunidad: ampliar a Inventario para Imprenta X»;
  - «Cuenta por cobrar: mensualidad de diciembre de Imprenta X»;
  - «Actividad: llamar a Imprenta X, su prueba vence el viernes».

  Una persona las aprueba. Todo esto ya existe (verificado en `contratos/automatizaciones.ts`); solo falta quien envíe los avisos desde la plataforma.
- **Cobro por fuera:** no hay pasarela de pago. El recordatorio llega como borrador a Finanzas de Datayros. La **suspensión por mora la decide siempre una persona** en la consola; el sistema solo la propone.

*A favor:* respeta la regla «la plataforma ve contratos y uso, no el negocio» (`PLATAFORMA-Y-PLANES.md` §7.3). Reutiliza el CRM, Finanzas, la bandeja y las automatizaciones. Encaja de lleno con el trabajador digital. Y se puede construir por partes.
*En contra:* son dos lugares que hay que mantener enlazados (con el id del cliente del CRM guardado en la cuenta). El operador tiene que ser miembro de la empresa Datayros. Y el puente depende de que los webhooks de salida lleguen a nombres de host: el `lookup` de `core/conectores/enviar.ts` ya atiende la opción `all`, lo que indica que el fallo de Node 24 (D22) está corregido, pero **no se ha probado contra un host real**. **Esfuerzo M, repartido en rondas.**

| Criterio | Diseño 1 | Diseño 2 | **Diseño 3** |
|---|---|---|---|
| Esfuerzo | L | S | M (por partes) |
| Cumple «CRM para los dos usos con la misma pieza» (11-nov) | No | Sí | Sí |
| Datos comerciales visibles en la consola | Sí | No | Lo mínimo |
| Salud de uso y arranque guiado | Sí | No | Sí |
| Riesgo de seguridad (lo que maneja `capaz_sistema`) | Alto | Bajo | Medio-bajo (solo conteos y una tabla) |
| Encaje con el trabajador digital | Bajo | Medio | **Alto** (propone, la persona aprueba) |

### 2.3 Modelo de datos mínimo (diseño 3)

Las tablas de plataforma van **sin `tenant_id`** y solo las usa `capaz_sistema`, igual que `core.auditoria_plataforma`. La seguridad se escribe a mano en la migración y cada tabla nueva se agrega a la lista `PERMITIDO` de `contratacion.int.spec.ts`.

| Tabla o vista | Columnas | Notas |
|---|---|---|
| `core.plataforma_cuentas` | `empresa_id` (clave = id de la organización), `razon_social`, `ruc`, `contacto_nombre`, `contacto_telefono`, `contacto_correo`, `estado_comercial` (`prueba`, `cliente`, `en_riesgo`, `suspendida`, `baja`), `responsable_usuario_id`, `nota` (máximo 500 caracteres), `cliente_crm_id` (id del cliente en la empresa Datayros, en texto y sin llave foránea), `archivada_en`, marcas de tiempo | Una fila por empresa. Archivar solo oculta la empresa de la lista; no borra nada |
| `core.v_salud_empresas` (vista) | `empresa_id`, `ultima_actividad`, `usuarios_activos_7d`, `usuarios_activos_30d`, `operaciones_30d` (jsonb: módulo → conteo), `arranque` (jsonb: paso → sí o no) | Se calcula con `core.auditoria`, que ya tiene `tenant_id`, `usuario_id`, `modulo` y `creado_en`, y con `exists` sobre los datos maestros. **Nunca devuelve contenido.** No está verificado si la auditoría registra también las lecturas; si solo registra escrituras, «usuarios activos» se completa con la última sesión (`auth.session`) |
| `core.plataforma_operadores` (reemplaza a `plataforma_admins`) | `usuario_id`, `rol` (`admin`, `comercial`, `soporte`), `creado_en` | La migración copia a los administradores actuales como `admin` |
| `core.accesos_de_soporte` (más adelante) | `id`, `tenant_id`, `operador_usuario_id`, `nivel` (`lectura` o `completo`), `otorgado_por`, `desde`, `hasta`, `revocado_en`, `motivo` | Sí lleva `tenant_id` y RLS: lo concede el administrador de la empresa (ver §2.5) |
| Configuración | `PLATAFORMA_EMPRESA_OPERADORA` (el id de Datayros) y la clave de API del puente | En `.env`; la clave va cifrada, como los secretos de las conexiones |

**Herramientas nuevas de plataforma:** `plataforma_cuenta_ver`, `plataforma_cuenta_guardar`, `plataforma_plan_aplicar`, `plataforma_empresa_archivar`, `plataforma_vencimientos_listar`, `plataforma_resumen` y `plataforma_salud_listar`. **Avisos del puente:** `capaz.solicitud_creada`, `capaz.prueba_por_vencer`, `capaz.vigencia_por_vencer` y `capaz.cuenta_en_riesgo`. Llevan el id y el nombre de la empresa, el módulo, la fecha y el `cliente_crm_id`; ningún dato del negocio de la empresa.

**Del lado web:** `yoSchema` gana `plataforma: { rol } | null` (el servidor ya consulta la tabla de operadores en la guardia). `menuDesdeYo` agrega «Consola de Capaz» solo cuando ese dato no es nulo. La consola tiene **marco propio**, sin la barra lateral de la empresa y con una franja que dice «Estás en la consola de Capaz».

### 2.4 Permisos de los operadores

| Acción | admin | comercial | soporte |
|---|---|---|---|
| Ver la lista, la ficha, la salud y los vencimientos | Sí | Sí | Sí |
| Editar la ficha de cuenta y la nota | Sí | Sí | No |
| Crear una empresa, aplicar un plan, activar una prueba | Sí | Sí | No |
| Fijar precios y contratos; suspender; dar de baja; archivar | Sí | No | No |
| Mantener el catálogo de planes | Sí | No | No |
| Restablecer la contraseña de un usuario (**nunca** la de otro operador) | Sí | No | No |
| Pedir acceso de soporte a una empresa | Sí | No | Sí |

Todo queda en `core.auditoria_plataforma`, que ya existe. **El segundo factor es obligatorio para todo operador.**

### 2.5 Soporte: entrar a la empresa del cliente

**No recomiendo ofrecer «entrar como el cliente» en esta versión.** Cuando haga falta, el operador **pide** acceso y el administrador de la empresa lo **concede** en Ajustes › Usuarios, con estas condiciones:
- dura un tiempo fijo, por ejemplo dos horas;
- es de **solo lectura** salvo que se pida otra cosa;
- la empresa ve una franja todo el tiempo: «Soporte de Capaz está viendo tu empresa hasta las 16:00»;
- se puede revocar en cualquier momento;
- queda auditado en los dos lados: en el historial de la empresa y en la auditoría de la plataforma;
- exige segundo factor al operador.

### 2.6 Hallazgos del frente A

| # | Qué falta | Por qué importa | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| A1 | Entrada «Consola de Capaz» en el menú; `yo` dice si la persona es operador; marco propio de la consola | Hoy hay que saber la dirección de memoria y la consola se confunde con la empresa activa | P1 | S | B | — |
| A2 | Pantalla `/restablecer-contrasena` (el enlace que genera la consola apunta ahí y no existe; búsqueda sin resultados en `apps/web/src`) | No hay «olvidé mi contraseña» ni se envían correos: quien pierde su clave **queda fuera** | P1 | S | B | — |
| A3 | Impedir que un operador restablezca la cuenta de otro operador; segundo factor para operadores | Hoy un operador puede tomar cualquier cuenta (`RELEVO.md`, punto de seguridad 4) | P1 (antes del 2.º cliente) | S + M | A | — |
| A4 | Ficha de cuenta (contacto, RUC, estado comercial, responsable, nota, enlace al CRM) | Para vender y renovar hay que saber a quién llamar | P2 | M | B | — |
| A5 | Nombres de módulos en lugar de códigos; archivar empresas de prueba | Orden y lectura rápida | P2 | S | B | — |
| A6 | Alta guiada: crear y **aplicar un plan** en un paso | Hoy se activan los módulos uno por uno | P2 | S–M | B | Parcial (sugiere el plan) |
| A7 | Vencimientos e ingresos mensuales acordados | Que no se pase ninguna prueba ni ninguna renovación | P2 | S | B | Sí (vía A9) |
| A8 | Salud de la cuenta (vista con cifras) | Detectar al cliente que dejó de usar el sistema antes de que lo cancele | P2 | M | M (privacidad: solo conteos) | Sí (marca «en riesgo» y propone una actividad) |
| A9 | Puente de la plataforma a la empresa Datayros (webhook y reglas que dejan borradores) | Las solicitudes y los vencimientos llegan solos al CRM y a Finanzas de Datayros | P2 | M | M | **Sí** |
| A10 | Roles de operador (admin, comercial, soporte) | Mientras sean solo Moisés y Keny, puede esperar | P3 | S | M | — |
| A11 | Acceso de soporte con consentimiento | Ayudar sin pedir la contraseña al cliente | P3 | M | A | — |
| A12 | Cobro automático y pasarela de pagos | Ola 5, ya decidido | P3 | L | A | — |

---

## 3. Frente B · Ficha de cliente y datos maestros

### 3.1 Qué hay hoy (verificado)

- **Cliente:**
  - tipo (cliente, proveedor o ambos) y clase (persona o empresa);
  - documento (DNI, RUC, CE, pasaporte u otro), que no se puede repetir;
  - teléfono, correo, dirección y notas;
  - se puede archivar y restaurar;
  - aviso de posibles duplicados al crear;
  - importación y exportación en CSV.

  La búsqueda compara **solo el nombre** (`core/clientes/repositories/clientes.repository.ts`, `buscarClientes`); no busca por RUC, DNI ni teléfono. `clientes_listar` solo filtra por activos, archivados o todos. La ficha solo muestra los datos (captura `u-ficha-cliente.png`; `core/clientes/api.ts` solo llama a herramientas de clientes).
- **Productos:** código, nombre, tipo (producto o servicio), **unidad en texto libre**, precio con IGV, afecto a IGV y descripción. No tienen costo, categoría, escalas de precio ni variantes.
- **Sucursales:** código, nombre, dirección, teléfono y cuál es la principal. Son suficientes para hoy.
- **Datos de la propia empresa:** solo zona horaria, moneda e idioma (`core.empresa_config`, `contratos/empresa.ts`). **No hay razón social, RUC, dirección fiscal ni logo.**

### 3.2 Hallazgos del frente B

| # | Qué falta | Por qué importa a un taller gráfico | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| B1 | **Vista 360 del cliente**, en pestañas: Resumen · Pedidos · Cuentas (deudas y abonos) · Oportunidades y actividades · Compras (si es proveedor). Arriba, la cifra «Debe S/ X · vencido S/ Y» | «¿Qué le hicimos a este cliente y cuánto nos debe?» es la pregunta más frecuente del mostrador | **P1** | M (web) + S (servidor: saldo por contacto) | B | Sí (resumen: «2 pedidos atrasados, S/ 450 vencidos») |
| B2 | **Datos de la propia empresa**: razón social, RUC, dirección fiscal, teléfono, correo, logo y un texto al pie (cuentas bancarias, Yape o Plin) | Sin esto no hay proforma ni recibo presentable | **P1** | S (logo pequeño guardado en la base; en R2 cuando exista) | B | — |
| B3 | Condiciones comerciales: plazo de pago en días (pone el vencimiento por defecto de la deuda), límite de crédito (solo aviso, nunca bloqueo), vendedor, etiquetas y origen («recomendado», «Facebook», «WhatsApp», «pasó por el local») | Cobrar a tiempo y saber de dónde vienen los clientes | P2 | S–M | B | Sí (avisa en el borrador si un pedido supera el crédito) |
| B4 | Varios contactos por cliente-empresa (la persona de compras, la de diseño, quien recoge) | Las agencias y empresas tienen varias personas de contacto | P2 | M | B | — |
| B5 | Búsqueda por RUC, DNI o teléfono; filtro por tipo (clientes o proveedores) y por etiqueta | Con WhatsApp se busca por número | P2 | S | B | — |
| B6 | **Fusionar duplicados** (P3-9, aplazada; el diseño ya está acordado: herramienta crítica del núcleo que marca `fusionado_en`) | Al importar de Excel o de WhatsApp aparecerán «Rosa Quispe» y «Rosa Quispe M.» | P2 | M | M | **Sí** (detecta los parecidos y propone la fusión; la persona aprueba) |
| B7 | Línea de tiempo del cliente (todo lo que pasó, en orden de fecha) | Contexto antes de llamar | P3 | M | B | Parcial |
| B8 | Archivos del cliente (manual de marca, logo en vector) | Depende del servicio de archivos (T4) | P3 | S tras T4 | M | — |
| B9 | Varias direcciones; para empezar, un «lugar de entrega» en el pedido | Entregas en el local del cliente | P3 | S | B | — |
| B10 | Consulta de RUC o DNI para autocompletar los datos | Solo como idea futura: es un servicio externo (regla 14) con costo y términos por revisar | P3 | M | M | Sí (completa los datos y la persona confirma) |
| B11 | Campos propios por empresa (usando el `datos_extra` que ya existe) | Cada taller anota cosas distintas | P3 | M | B | — |
| B12 | **Unidades del rubro con conversión**: unidad, ciento, millar, pliego, resma, m², metro lineal, hora, juego, talonario; y equivalencias como 1 resma = 500 pliegos o 1 millar = 1000 unidades | Hoy la unidad es texto libre y **al recibir una compra la cantidad entra al inventario tal cual** (`insumos/consumidores.ts`): comprar 2 millares puede sumar 2 pliegos | P2 (P1 si ya se usa Inventario) | M | M | — |
| B13 | Costo de referencia y margen por producto o servicio | Saber si un trabajo deja ganancia | P2 | S | B | — |
| B14 | Categorías de productos (offset, digital, gran formato, acabados, diseño) | Filtrar y reportar ventas por línea de negocio | P2 | S | B | — |
| B15 | Precio por cantidad (escalas para 100, 500 o 1000 unidades) | En gráfica el precio unitario depende de la cantidad | P2 o esperar al Cotizador | M | M | — |
| B16 | Listas de precios por cliente (agencia o público) | Las agencias piden precio de revendedor | P3 | M | M | — |
| B17 | Variantes (tamaño × papel × acabado) | **No recomendadas:** las especificaciones van en la línea del pedido (C-P6) y el cálculo, en el Cotizador | P3 / no hacer | L | M | — |

**Para Keny (B1):** se arma en la web con el mismo patrón que `core/inicio/pendientes.tsx`, que ya llama a los `_resumen` de los módulos. Cada pestaña se muestra solo si la persona puede entrar a ese módulo (`yo.modulos`). Para la cifra de saldo conviene una herramienta pequeña de `registro` (por ejemplo, el saldo por contacto) en lugar de sumar páginas en la pantalla.

---

## 4. Frente C · Módulo por módulo y piezas transversales

### 4.1 Finanzas ligeras (`registro`)

**Hoy:** cuentas (caja, banco, billetera), categorías, movimientos con medio de pago (efectivo, transferencia, Yape, Plin, tarjeta), anulación, cuentas por cobrar y por pagar con vencimiento, abonos, caja del día y resumen. Al confirmar un pedido se propone la cuenta por cobrar; al recibir una compra, la cuenta por pagar; y un adelanto al personal propone el egreso.

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-F1 | Anotar una deuda a mano en la pantalla (la herramienta ya existe) | «Juan me debe S/ 200 de unos volantes» sin tener que crear un pedido | **P1** | S | B | — |
| C-F2 | Transferencia entre cuentas (caja → banco, Yape → banco) | Hoy se anotaría como un egreso y un ingreso, que inflan los totales | **P1** | S–M | M | — |
| C-F3 | Recibo imprimible del abono (constancia, **no** comprobante SUNAT) y estado de cuenta del cliente | El cliente pide «mándame lo que te debo» | **P1** | S (tras T1) | B | Parcial (el sistema lo arma y la persona lo envía) |
| C-F4 | **Adelanto al confirmar el pedido**: «Confirmar y cobrar adelanto» crea la deuda del pedido y registra el abono en el mismo paso | En gráfica se cobra el 50 % por adelantado; hoy son tres pasos y uno de ellos pasa por la bandeja | **P1** | S–M | M | — (lo hace la persona) |
| C-F5 | Antigüedad de saldos (0–30, 31–60, 61–90 y más de 90 días), por cliente | Saber a quién cobrar primero | P2 | S | B | Sí («hoy conviene llamar a…») |
| C-F6 | Cierre o arqueo de caja: contar el efectivo y anotar la diferencia | Control diario del dinero | P2 | M | M | Sí (propone el cierre del día) |
| C-F7 | **Importar las deudas que ya existían** (CSV) | El primer día hay que cargar quién debe qué; hoy solo se importan clientes y productos (`ENTIDADES_DE_INTERCAMBIO`) | **P1** | S–M | M | Parcial (vista previa y luego aplicar) |
| C-F8 | Presupuesto mensual por categoría | Comparar el gasto previsto con el real | P3 | S–M | B | — |
| C-F9 | Conciliación simple con el extracto del banco | Ideal para un agente, pero es grande | P3 | L | M | Sí |
| C-F10 | Pagos en cuotas | Clientes grandes | P3 | M | M | — |
| C-F11 | Nombre visible «Caja y cuentas» (D20, recomendado y sin aplicar; el menú dice «Registro») | Que el nombre diga para qué sirve | P3 | S | B | — |

**Para Keny (C-F4):** no rompe la regla R5. La deuda la crea **la persona** desde la pantalla, justo después de `pedido_confirmar`: la web llama a `deuda_crear` con `origenTipo: 'pedido'` y luego a `deuda_abonar`. El índice único `uq_registro_deudas_origen` (migración 0014) y la comprobación de `deudas-escritura.ts` impiden que haya dos deudas para el mismo pedido. Si el consumidor ya había dejado su borrador, al aprobarlo responderá «ese documento ya tiene una deuda»: conviene que la bandeja lo descarte sola o lo marque como resuelto.
**Para Keny (C-F2):** una herramienta nueva crea dos movimientos enlazados (por ejemplo, con `origen_ref` común y una categoría reservada «Transferencia»). `registro_resumen` y `caja_del_dia` los excluyen de ingresos y egresos. Es **dinero**: lleva pruebas de referencia como las de §4.2 de la ficha.

### 4.2 CRM

**Hoy:** etapas configurables; oportunidades con cliente, monto, fecha esperada y responsable; ganar, perder con motivo y reabrir; actividades con vencimiento; tablero sin arrastre; resumen.

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-C1 | Actividades sobre el cliente **sin oportunidad** («llamar para cobrar», «visitar»); hoy `actividad_crear` exige `oportunidadId` | La cobranza y la posventa también son seguimiento | P2 | S–M | B | Sí (propone las actividades) |
| C-C2 | Oportunidad ganada → borrador de pedido (P3-10, aplazado) | No volver a teclear lo mismo | P2 | S | B | **Sí** |
| C-C3 | Prospecto sin tener que registrarlo como cliente completo | Los contactos de Facebook o WhatsApp todavía no son clientes | P2 | S | B | — |
| C-C4 | Origen o canal de la oportunidad y motivos de pérdida en una lista cerrada | Saber qué canal vende y por qué se pierde | P2 | S | B | — |
| C-C5 | Botón «Escribir por WhatsApp» con el mensaje ya redactado (enlace `wa.me`, sin servicio externo) | Así se habla con el cliente en Perú | P2 | S | B | Parcial (el sistema redacta y la persona envía) |
| C-C6 | Arrastrar tarjetas, probabilidad, varios embudos | Comodidad | P3 | M | B | — |

### 4.3 Pedidos (`ordenes`)

**Hoy:** el pedido va de borrador a confirmado, en proceso, listo y entregado, o se cancela (la cancelación es crítica). Sus líneas llevan producto o texto libre, con IGV incluido. Tiene número por sucursal, responsable y fecha de entrega; marca los atrasados; hay tablero por estado, vista de entregas, notas e historial. Al confirmar se propone la deuda.

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-P1 | **Impresión y PDF** de tres documentos: la proforma, la nota de pedido para el cliente (con precios) y la **orden de trabajo para el taller** (sin precios, con especificaciones). Hoy no hay impresión en ninguna parte de la web | El cliente espera la proforma por WhatsApp; el taller trabaja con la orden en papel | **P1** | M (base T1) + S por documento | B | Parcial |
| C-P2 | **Proforma con el borrador del pedido** mientras no llega el Cotizador: «válida hasta» y la marca «enviada al cliente» | Es el primer paso de toda venta en gráfica | **P1** | S | B | Sí (prepara la proforma y la persona la envía) |
| C-P3 | Adelanto al confirmar (ver C-F4) | 50 % por adelantado | **P1** | — | — | — |
| C-P4 | Descuento por línea o sobre el total («se lo dejo en 180») | Se negocia en casi toda venta | P2 | S–M | M (toca `calcularTotalesDePedido`, compartida con Compras) | — |
| C-P5 | Etapas de producción configurables dentro de «En proceso» (diseño, aprobación del arte, preprensa, impresión, acabados), con responsable por etapa | Saber en qué paso está cada trabajo | P2 | M | M | Sí (avisa de los cuellos de botella) |
| C-P6 | Especificaciones técnicas por línea: medida, papel o material, colores (4/0, 4/4), acabados, pliegos. Las líneas **no** tienen `datos_extra` (`esquema/ordenes.ts`), así que hace falta una columna nueva | La orden de trabajo sin especificaciones no le sirve al taller | P2 | M | M | — |
| C-P7 | Archivos de arte, prueba de color y foto de la entrega | Evita el «yo no aprobé eso» | P2 | M–L (depende de T4) | M | — |
| C-P8 | Repetir un pedido anterior | «Lo mismo del mes pasado» es muy común | P2 | S | B | Sí (lo sugiere al elegir un cliente recurrente) |
| C-P9 | Consumo de insumos del pedido: salida de papel, tinta o vinil | Que el inventario baje con el trabajo real | P2 | M | M | Sí (propone la salida al pasar a impresión) |
| C-P10 | «Tu pedido está listo» por WhatsApp (enlace `wa.me` hoy; la API de WhatsApp después) | El cliente pregunta todo el tiempo | P2 | S | B | Parcial |
| C-P11 | Lugar de entrega y entregas parciales | Pedidos grandes | P3 | M | B | — |

### 4.4 Inventario (`insumos`)

**Hoy:** artículos ligados a productos; existencias por sucursal sin permitir negativos; mínimos y alertas; entradas, salidas y ajuste crítico; historial; último costo; la entrada se propone al recibir una compra.

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-I1 | Unidades y conversión (ver B12) | Existencias correctas | P2 (P1 si ya se usa) | M | M | — |
| C-I2 | La entrada cae en la sucursal correcta: el evento `compra.recibida` no trae la sucursal y la entrada va a la principal (comentario en `insumos/consumidores.ts`; mejora ya anotada en el relevo) | Talleres con dos locales | P2 | S | B | — |
| C-I3 | Toma de inventario: hoja de conteo imprimible, carga de varios conteos y **un solo borrador** con todos los ajustes. Hoy se ajusta artículo por artículo, con una confirmación crítica cada vez | El inventario de fin de mes | P2 | M | M | **Sí** |
| C-I4 | Valor del inventario al último costo («¿cuánto tengo en papel?») | El dato ya existe | P2 | S | B | — |
| C-I5 | **Sugerencia de compra:** con un artículo bajo el mínimo, el sistema propone una orden de compra en borrador al proveedor habitual | Que no se acabe el papel a mitad de un trabajo | P2 | S–M | B | **Sí, de lleno** |
| C-I6 | Transferencia entre sucursales (hoy solo hay entrada, salida y ajuste) | Pocos talleres la necesitan | P3 | S–M | B | — |
| C-I7 | Lotes, varios almacenes por sucursal, costo promedio | Fuera de alcance por P3-1 y P3-2 | P3 | L | M | — |

### 4.5 Compras

**Hoy:** orden de compra con líneas; número asignado al enviarla; recepción parcial o total; cancelación crítica; se proponen la cuenta por pagar y la entrada al inventario.

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-K1 | PDF de la orden de compra para el proveedor | Se pide por WhatsApp o por correo | P2 | S (tras T1) | B | Parcial |
| C-K2 | Último costo por proveedor y producto, sugerido al armar la orden | Comparar precios sin buscar papeles | P2 | S | B | Sí |
| C-K3 | Devoluciones al proveedor | Papel fallado | P3 | M | M | — |
| C-K4 | Pedir cotización a varios proveedores | Compras grandes | P3 | M | B | — |
| C-K5 | Compras en dólares (insumos importados) | Algunos proveedores cotizan en USD | P3 | M–L | M | — |

### 4.6 Personal

**Hoy:** colaboradores (documento, teléfono, cargo, fecha de ingreso, sucursal); asistencia del día marcada por el encargado (presente, tardanza, falta, permiso, descanso); corrección crítica; adelantos que proponen su egreso. No hay campo de sueldo (verificado en `contratos/personal.ts`).

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-H1 | **Liquidación simple del pago** semanal o quincenal: sueldo o jornal pactado, menos los adelantos del período, igual a lo que hay que pagar. **No** es planilla ni boleta | Muchos talleres pagan cada semana y descuentan los adelantos a mano | P2 | M | M (dinero y datos personales) | **Sí** (propone el pago y la persona aprueba) |
| C-H2 | Horario esperado por colaborador, para marcar la tardanza sola | Menos discusiones | P3 | S–M | B | — |
| C-H3 | Vacaciones y permisos con saldo | Control de días | P3 | M | B | — |
| C-H4 | Cada colaborador marca su asistencia desde su celular (P3-7, ya preparado en la tabla) | Comodidad | P3 | M | M | — |
| — | Planilla, boletas, PLAME | **Fuera de alcance:** se conecta con un sistema externo | — | — | — | — |

### 4.7 Reportes

**Hoy:** panel por período con las cifras de cada módulo al que la persona puede entrar; exportación a CSV; gráfico de línea preparado.

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| C-R1 | **Series en el tiempo:** ningún `_resumen` entrega `serie`, así que el gráfico nunca aparece. Empezar por ventas confirmadas y caja, por día y por mes | «¿Cómo vamos este mes?» se responde con un gráfico | P2 | S–M | B | — |
| C-R2 | Comparación con el período anterior (este mes contra el pasado) | Saber si se crece | P2 | S | B | — |
| C-R3 | Ventas por cliente y por producto (los primeros de la lista) y ticket promedio | Saber quién y qué deja más | P2 | M | B | Parcial (lo comenta el trabajador digital) |
| C-R4 | Exportar a Excel (.xlsx) y PDF | El CSV ya abre en Excel; el .xlsx exige una dependencia (D10) | P3 | M | B | — |
| C-R5 | Tableros por rol (dueño, caja, taller) | Cada uno ve lo suyo | P3 | M | B | — |

### 4.8 Piezas transversales

| # | Brecha | Por qué importa al taller | P | Esf | Riesgo | TD |
|---|---|---|---|---|---|---|
| T1 | **Base de impresión:** una vista imprimible con hoja de estilo para papel y «Guardar como PDF» del navegador, sin dependencias ni servidor. Plantilla propia con los datos de la empresa (B2). Hoy no hay ninguna (se buscaron `print`, `imprimir` y `pdf` en `apps/web/src`) | Todo documento del taller sale de aquí | **P1** | M | B | — |
| T2 | **Arranque guiado del primer día:** datos de la empresa → sucursal → cuentas con saldo inicial → importar clientes → importar deudas → productos → invitar usuarios | Sin esto, la primera semana se abandona | **P1** | M | B | Sí (guía y propone el siguiente paso) |
| T3 | Importar más cosas: deudas iniciales (C-F7, P1), artículos con su existencia inicial, colaboradores y proveedores | Cargar el taller en una tarde | P1 / P2 | S–M | M | Parcial |
| T4 | Archivos adjuntos: una pieza del núcleo con enlaces firmados, límite de tamaño y separación por empresa (R2) | Artes, fotos, comprobantes | P2 | M–L | M (servicio externo: decisión del dueño) | — |
| T5 | Correo de sistema («olvidé mi contraseña» e invitaciones). Hoy no se envía ningún correo: la invitación se copia a mano (`ajustes/usuarios/hoja-invitar.tsx`) | Autonomía de los usuarios | P2 | S–M | M (servicio externo) | — |
| T6 | Enlaces de WhatsApp (`wa.me`) en clientes, pedidos y deudas; la API de WhatsApp queda para la ola 5 | El canal real del cliente | P2 | S | B | Parcial |
| T7 | Búsqueda global (cliente, pedido por número, deuda) con salto a las pantallas. No existe | Encontrar cualquier cosa en dos segundos | P2 | M | B | — |
| T8 | Atajos de teclado fuera de la bandeja (hoy solo los tiene la bandeja) | Rapidez en el mostrador | P3 | S | B | — |
| T9 | Ayuda en pantalla: frases cortas y pantallas vacías que explican qué hacer | Menos capacitación | P2 | S | B | — |
| T10 | Historial visible en cada ficha (la auditoría ya filtra por entidad) | Saber quién cambió qué | P3 | S–M | B | — |
| T11 | Varias monedas (USD) | Pocos casos en el taller | P3 | M–L | M | — |
| T12 | Copias de seguridad y exportación completa de la empresa (un ZIP de CSV). La restauración de Neon a un punto en el tiempo depende del plan contratado: **no verificado** | Confianza del cliente y salida limpia si se va | P2 | S–M | M | — |
| T13 | Empresa de ejemplo con datos de muestra (un comando de plataforma) | Demostraciones de venta y capacitación | P2 | S | B | — |
| T14 | Iconos propios por módulo (en las capturas, CRM, Pedidos, Inventario y Registro muestran el mismo ícono genérico) | Orientarse en el menú | P3 | S | B | — |
| T15 | Medir el rendimiento en el servidor real: el guardia hace tres consultas por petición y hay unos 89 ms hasta Neon desde aquí. Accesibilidad sin auditar: **no verificado** | Que no se sienta lento en el celular | P2 | S | M | — |
| T16 | Aviso interno (P3-11): una campana con lo que venció y con lo que espera en la bandeja. Inicio ya muestra los pendientes | Que nada se olvide | P3 | S–M | B | Sí |

### 4.9 Lo que no recomiendo hacer ahora (para cuidar el presupuesto)

Quedan para después:
- variantes de producto;
- listas de precios por cliente;
- conciliación bancaria;
- lotes y varios almacenes;
- varias monedas;
- exportar a Excel nativo;
- «entrar como el cliente»;
- pasarela de pagos;
- tableros por rol.

**Ninguna de estas cambia el uso diario del taller tanto como lo que va en las rondas 1 y 2.**

---

## 5. Hoja de ruta sugerida (cuatro rondas)

El costo es relativo (S, M o L) y supone carriles pequeños con fichas cerradas, al estilo de `FICHAS-OLA-2.md`.

| Ronda | Objetivo | Incluye | Costo | Hecha cuando |
|---|---|---|---|---|
| **1 · El taller trabaja y entrega papeles** | Cerrar el circuito proforma → pedido → adelanto → orden de trabajo → recibo | T1 base de impresión · B2 datos de la empresa · C-P1 y C-P2 (proforma, nota de pedido, orden de trabajo) · C-F3 (recibo y estado de cuenta) · C-F1 deuda a mano · C-F2 transferencias · C-F4 adelanto al confirmar · A1 consola visible · A2 pantalla de restablecer · A3a (sin restablecer cuentas de operadores) | **M** (casi todo en pantallas; servidor: B2, C-F2 y A1) | Desde el celular se arma una proforma, se manda en PDF por WhatsApp, se confirma cobrando el 50 %, se imprime la orden para el taller y al entregar se emite el recibo del saldo. La caja se deposita en el banco sin descuadrar los reportes |
| **2 · Conocer al cliente y arrancar con datos reales** | Que una empresa nueva quede operativa en una tarde y que el mostrador tenga todo a mano | B1 vista 360 (con saldo por contacto) · T2 arranque guiado · C-F7 y T3 importar deudas iniciales · B5 búsqueda por documento y teléfono, y filtros · B3 condiciones comerciales · C-P8 repetir pedido · C-C5, C-P10 y T6 enlaces de WhatsApp · C-R1 y C-R2 series y comparación | **M** | Al abrir un cliente se ve en una pantalla qué pedidos tiene, cuánto debe y desde cuándo; una empresa nueva carga clientes y deudas en menos de una hora |
| **3 · Administrar a los clientes de Capaz** (antes del 2.º cliente) | Diseño 3 del frente A | A3b segundo factor para operadores · A4 ficha de cuenta · A5 · A6 alta con plan · A7 vencimientos y resumen · A8 salud · A9 puente al CRM y a Finanzas de Datayros · B6 fusión de duplicados · C-C1 actividades sin oportunidad · C-C2 ganada → pedido | **M** | En la consola se ve qué cuentas vencen o están en riesgo, y cada solicitud o vencimiento llega como borrador a la bandeja de Datayros |
| **4 · Taller gráfico de verdad** | Producción y materiales | C-P5 etapas de producción · C-P6 especificaciones por línea · C-P4 descuento · B12 y C-I1 unidades con conversión · C-I2 · C-P9 consumo de insumos · C-I5 sugerencia de compra · C-I3 toma de inventario · C-I4 valor del inventario · C-H1 liquidación semanal · (si se aprueba el servicio) T4 archivos y C-P7 artes | **L** (conviene partirla en 4a y 4b) | Un pedido avanza por las etapas del taller con sus especificaciones; el papel que gasta se descuenta en la unidad correcta y el sistema propone la compra cuando falta |

**Orden de valor por esfuerzo:** ronda 1 > ronda 2 > ronda 3 > ronda 4. Si el presupuesto aprieta, las rondas 1 y 2 ya dejan un ERP útil para el taller. La ronda 3 es obligatoria **solo** cuando haya un segundo cliente de pago.

---

## 6. Decisiones que necesito del dueño

Las **tres que más pesan** van primero.

| # | Decisión | Mi recomendación | Qué destraba |
|---|---|---|---|
| **1** | **Documentos impresos con «Guardar como PDF» del navegador y la proforma hecha con el borrador del pedido**, sin esperar al Cotizador | **Sí.** No hay dependencias, ni servidor de PDF, ni hay que esperar. Cuando llegue, el Cotizador generará el mismo pedido | Toda la ronda 1 |
| **2** | **Diseño 3 para administrar a los clientes de Capaz**: consola de cuentas más el CRM y Finanzas de la empresa Datayros, unidos por un puente que deja borradores | **Sí.** Cumple la decisión del 11-nov sin construir un segundo CRM | Ronda 3; que Datayros se registre como empresa dentro de Capaz |
| **3** | **El adelanto y la deuda del pedido los registra la persona al confirmar**, en un paso, en lugar de esperar al borrador de la bandeja | **Sí, como opción** (una casilla «registrar adelanto» al confirmar). La bandeja queda para lo que el sistema propone por su cuenta | C-F4 y C-P3; evitar que la bandeja se llene de trámites |
| 4 | Servicios externos (regla 14): correo de sistema y archivos en R2 | Correo **pronto** (para «olvidé mi contraseña»); R2 en la ronda 4 | T5, T4 y C-P7 |
| 5 | Segundo factor obligatorio para operadores, y ningún operador puede restablecer la cuenta de otro | **Sí** | A3 |
| 6 | Precios por cantidad (escalas): ¿en Productos ahora o en el Cotizador? | **Esperar al Cotizador**; mientras tanto, el precio se ajusta en la línea | B15 |
| 7 | Nombre visible del módulo de Finanzas | «Caja y cuentas» (D20) | C-F11 |
| 8 | «Entrar como el cliente» para dar soporte | **Posponer**; cuando se haga, con consentimiento, por tiempo limitado, en solo lectura y con auditoría | A11 |
| 9 | Suspensión por falta de pago | **Siempre la decide una persona**; el sistema solo la propone | A9 |
| 10 | Variantes de producto | **No hacerlas**; las especificaciones van en la línea del pedido | B17, C-P6 |

---

## 7. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Sin despliegue ni migraciones en Neon | Nada de esto se prueba en el taller | Ronda previa de Keny: host con HTTPS, migraciones 0006 a 0020, secretos de producción, GitHub |
| Seguridad de la consola: un operador puede tomar la cuenta de otro, no hay segundo factor y el enlace de restablecer está roto | Robo de cuentas; usuarios bloqueados | A2 y A3 en las rondas 1 y 3; revisión humana de los cinco puntos de seguridad del `RELEVO.md` |
| **Exceso de borradores en la bandeja** (pedido → deuda, compra → deuda, compra → inventario, adelanto → egreso, y en el futuro puente, inventario y personal) | El trabajador digital se vuelve trabajo extra y la gente deja de mirar la bandeja | Medir cuántos borradores hay por día; aprobar en lote; permitir que la persona haga la acción directa cuando ya está en la pantalla (decisión 3) |
| Unidades sin conversión | Existencias equivocadas y desconfianza en Inventario | B12 antes de vender Inventario a un tercero |
| Privacidad en la salud de las cuentas | La plataforma podría ver el negocio del cliente | La vista devuelve solo conteos y fechas; se audita cada consulta; nunca nombres, importes ni documentos |
| El puente depende de los webhooks de salida a nombres de host | No llegan los avisos a Datayros | Probar contra el host real; el arreglo de D22 parece hecho pero no está probado fuera de las pruebas |
| Presupuesto de IA limitado | Rondas a medias | Fichas cerradas antes de lanzar; nada L hasta que el taller use las rondas 1 y 2; partir la ronda 4 |
| Regla 12 (no copiar otros ERP) | Riesgo legal y de marca | Documentos impresos, nombres y medidas propios; las referencias, solo como ideas genéricas |
| Deuda técnica conocida: `QueryClient` propio en la consola y en algunos módulos; empresas de prueba repetidas en la base local | Comportamientos raros de caché; datos sucios | Retirarlos al tocar esas pantallas (ya está anotado); no llevar la base local a producción |
| Cambiar la función de totales compartida (descuento, C-P4) | Descuadres en Pedidos y Compras | Pruebas de referencia con montos exactos antes de integrar |
