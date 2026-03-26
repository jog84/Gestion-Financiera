# Auditoría Integral y Rediseño Propuesto

## 1. Diagnóstico general del proyecto

La app tiene una base funcional valiosa: stack moderno (`Tauri 2`, `React 19`, `TypeScript`, `Vite`, `React Query`, `SQLite`, `sqlx`) y un dominio de producto ya bastante amplio. No es un MVP vacío. Ya hay módulos reales de flujo de caja, inversiones, patrimonio, objetivos, alertas, recurrentes y reportes.

El problema es otro: el proyecto creció por acumulación de features, no por diseño de producto ni por arquitectura de plataforma. La app registra muchas cosas, muestra varios gráficos y expone métricas útiles, pero todavía no opera como una fintech personal coherente. Hoy el usuario puede “cargar datos” y “ver pantallas”; todavía no obtiene una lectura verdaderamente clara, accionable y consistente de su situación financiera.

Hay dos brechas principales:

1. Brecha de producto:
   faltan modelos mentales más sólidos para que la app responda preguntas importantes como:
   - ¿Estoy mejor o peor que el mes pasado?
   - ¿Cuál es mi capacidad real de ahorro?
   - ¿Cuánto de mi patrimonio está líquido?
   - ¿Qué parte del portfolio depende de una sola moneda, un solo sector o un solo activo?
   - ¿Qué decisiones debería tomar hoy?

2. Brecha de ingeniería:
   el código está funcional, pero con demasiada lógica mezclada en páginas grandes, acoplamiento fuerte al perfil `"default"`, UI resuelta en línea, poca separación entre presentación y lógica de dominio, y prácticamente sin red de seguridad automática.

En síntesis:
- El proyecto vale la pena y tiene base para evolucionar.
- No necesita “maquillaje”.
- Sí necesita rediseño de producto, arquitectura y sistema visual.

## 2. Problemas críticos detectados

### Arquitectura

- El frontend está acoplado a un perfil hardcodeado (`"default"`) en múltiples vistas y query keys.
- La capa de dominio está distribuida entre páginas, utilidades y comandos sin límites claros.
- Las páginas grandes concentran demasiadas responsabilidades: fetch, cálculo, estado local, rendering, formato y reglas de negocio.
- La estructura actual por `pages/`, `components/`, `lib/` y `types/` sirve para empezar, pero ya no alcanza para escalar.
- No existe una capa frontend explícita de “domain services” o “application layer”.
- No hay un sistema de estados transversales claro para sesión de perfil, filtros globales, moneda de visualización y preferencias de análisis.

### Calidad de código

- Uso intensivo de estilos inline: lento de mantener, difícil de estandarizar, propenso a divergencia visual.
- Componentes con cientos o más de mil líneas, en particular `Investments.tsx`.
- Lógica financiera sensible mezclada con rendering.
- Repetición de patrones de tablas, cards, headers, botones, pills, empty states y filtros.
- `README.md` no representa el estado real del proyecto.

### Datos y modelo de dominio

- El modelo soporta perfiles, pero el producto real no está diseñado para multi-perfil.
- Faltan entidades financieras más sólidas para cuentas, posiciones, movimientos importados, holdings consolidados y benchmarks.
- La inversión mezcla conceptos de “operación”, “posición” y “valuación” en formas que hoy funcionan, pero no escalan bien.
- No hay una contabilidad clara de cuentas/cash balances; eso limita mucho cualquier lectura seria de liquidez y cashflow real.
- Compartir SQLite por carpeta sincronizada es una solución frágil y con riesgo explícito de corrupción concurrente.

### UX / producto

- La navegación está organizada por features, no por decisiones del usuario.
- La app tiene mucha capacidad operativa, pero baja priorización de insights.
- Falta jerarquía entre “lo importante ahora” y “lo disponible para explorar”.
- Los reportes son correctos pero todavía muy descriptivos; les falta traducción a decisiones.
- El dashboard es atractivo, pero todavía no es un tablero de control financiero maduro.

### Testing / confiabilidad

- No hay suite automática visible de tests en frontend ni backend.
- No hay validación de regresión del cálculo financiero.
- No hay cobertura de edge cases críticos de fechas, FX, instrumentos ni agregaciones.

### Seguridad / robustez

- `csp: null` en Tauri es una concesión grande para un producto que pretende verse serio.
- El fetch de precios está descrito como concurrente, pero hoy itera secuencialmente.
- La app depende de fuentes externas sin una estrategia clara de resiliencia, stale data o degradación elegante.

## 3. Oportunidades de mejora de producto

La mayor oportunidad no está en agregar veinte features nuevas. Está en convertir la información ya existente en criterio de decisión.

### Lo que hoy ya existe y vale conservar

- Dashboard con KPIs y tendencias.
- Módulo de inversiones relativamente avanzado.
- Reportes anuales y comparativos.
- Categorías, fuentes, recurrentes, metas y temas.
- Persistencia local robusta para una app de escritorio.

### Lo que hoy aporta poco valor real

- Vistas que muestran datos sin traducirlos en decisiones.
- KPIs sin contexto suficiente para saber si son “buenos”, “malos” o “peligrosos”.
- Secciones de reportes con foco en visualización más que en interpretación.
- Algunos flujos de registro que obligan al usuario a pensar como la base de datos y no como una persona administrando su plata.

### Lo que falta para que la app ayude de verdad

- Diagnóstico financiero mensual.
- Lectura clara de liquidez disponible.
- Evolución del patrimonio neto y no solo de activos aislados.
- Costo promedio y P&L claramente explicados.
- Exposición por moneda, tipo de activo y sector.
- Alertas accionables.
- Recomendaciones de rebalanceo con criterio.
- Segmentación entre “operación”, “análisis” y “decisión”.

## 4. Nueva arquitectura propuesta

### Arquitectura de frontend

Propuesta de organización por dominio, no por tipo de archivo:

```text
src/
  app/
    router/
    providers/
    layout/
  domains/
    dashboard/
      components/
      hooks/
      queries/
      mappers/
      types.ts
    cashflow/
    investments/
    networth/
    budgets/
    goals/
    settings/
    reports/
  shared/
    ui/
    charts/
    table/
    filters/
    feedback/
  entities/
    profile/
    transaction/
    account/
    position/
    holding/
  infrastructure/
    tauri/
    query/
    formatters/
    dates/
    fx/
```

### Principios

- Separar “operaciones” de “lecturas consolidadas”.
- Mover cálculos reutilizables fuera de las páginas.
- Introducir mappers para pasar de datos crudos a view models.
- Centralizar `queryKeys`, invalidación y contratos de dominio por módulo.
- Crear un estado explícito de perfil activo, moneda de visualización y rango temporal.

### Arquitectura de backend

Agrupar comandos por bounded context más claro:

- `cashflow`
- `portfolio`
- `net_worth`
- `budgets`
- `goals`
- `reporting`
- `settings`
- `catalogs`
- `importing`
- `market_data`

Separar en backend:
- comandos Tauri
- servicios de dominio
- repositorios SQL
- DTOs de entrada/salida

El backend actual funciona, pero hoy mezcla SQL y lógica de aplicación en el mismo nivel.

## 5. Nuevo mapa de pantallas / módulos

### 1. Inicio / Dashboard
- Objetivo: mostrar la salud financiera actual.
- Problema que resuelve: saber en 30 segundos si la situación mejora o empeora.
- Datos: cashflow mensual, ahorro, liquidez, patrimonio neto, variación mensual, alertas, top riesgos.
- Acciones: registrar ingreso/gasto, revisar desvíos, abrir portfolio, ver presupuesto, aplicar recurrentes.

### 2. Movimientos
- Objetivo: gestionar ingresos, gastos y transferencias.
- Problema: hoy ingresos y gastos están demasiado separados.
- Datos: lista unificada filtrable por tipo, cuenta, categoría, fecha, origen.
- Acciones: alta, edición, importación, conciliación, categorización masiva.

### 3. Presupuestos
- Objetivo: controlar gasto contra plan.
- Datos: presupuesto por categoría, gasto acumulado, forecast de cierre, desvío.
- Acciones: ajustar presupuesto, ver categorías críticas, generar alertas.

### 4. Cuentas y saldos
- Objetivo: representar el cash real.
- Datos: cuentas, saldos, moneda, tipo, liquidez.
- Acciones: transferencias, reconciliación, saldos iniciales, vincular movimientos.

### 5. Inversiones
- Objetivo: entender portfolio, rendimiento y riesgo.
- Datos: holdings consolidados, transacciones, asignación, P&L, FX, benchmark, riesgo.
- Acciones: registrar compra/venta, actualizar precios, rebalancear, importar operaciones.

### 6. Patrimonio neto
- Objetivo: mostrar evolución real de riqueza.
- Datos: activos líquidos, inversiones, otros activos, pasivos, net worth.
- Acciones: registrar snapshots manuales o automáticos, ver composición, detectar tendencias.

### 7. Objetivos
- Objetivo: conectar ahorro e inversión con metas.
- Datos: meta, aporte acumulado, gap, deadline, probabilidad de cumplimiento.
- Acciones: asignar aportes, simular ritmo necesario, generar hitos.

### 8. Insights y alertas
- Objetivo: convertir datos en decisiones.
- Datos: anomalías, concentración, caída de ahorro, exceso de gasto, vencimientos.
- Acciones: marcar como leída, abrir contexto, tomar acción recomendada.

### 9. Reportes
- Objetivo: análisis profundo.
- Datos: evolución histórica, cohortes mensuales, comparativos, métricas agregadas.
- Acciones: exportar, imprimir, comparar períodos, abrir drill-down.

### 10. Configuración e importación
- Objetivo: administrar perfil, catálogos, temas, data source, importaciones y backups.

## 6. Rediseño UX/UI general

### Dirección visual

La app ya tiene una dirección oscura/profesional razonable, pero está resuelta más como “dashboard developer aesthetic” que como producto fintech maduro.

Debe evolucionar hacia:
- contraste fuerte pero no saturado
- menos ruido cromático
- tipografía más jerárquica
- métricas con prioridad superior al decorado
- visualización consistente entre módulos

### Sistema de navegación

La sidebar actual sirve, pero debe reorganizarse en grupos mentales:

- Inicio
- Movimientos
- Presupuestos
- Cuentas
- Inversiones
- Patrimonio
- Objetivos
- Insights
- Reportes
- Configuración

### Patrones visuales base

- `PageHeader`: título, contexto, rango temporal, acciones primarias.
- `MetricCard`: valor, variación, benchmark, CTA contextual.
- `SectionCard`: contenedor estándar con header y acciones secundarias.
- `SmartTable`: tabla consistente con columnas configurables, sticky header, sorting, filtros y empty state.
- `ChartPanel`: gráfico con insight textual arriba o abajo.
- `InsightBanner`: problema + impacto + acción sugerida.
- `EntityDrawer`: edición rápida sin romper contexto.

### Reglas UX

- El usuario primero debe entender, después explorar, y recién al final editar.
- Toda métrica importante debe responder: qué es, cómo cambió, si importa, qué hacer.
- Menos tabs internas cuando el contenido puede resolverse con bloques progresivos.
- Menos inline editing improvisado en contextos complejos.

## 7. Rediseño por vista

### Dashboard

#### Qué hace hoy
- Muestra ingresos, gastos, balance, tasa de ahorro, evolución, breakdown y últimas transacciones.

#### Problemas
- Mezcla resumen ejecutivo con detalle operativo.
- No muestra liquidez, patrimonio neto ni riesgo.
- No prioriza alertas ni acciones recomendadas.
- Usa datos útiles, pero todavía no cuenta una historia.

#### Rediseño
- Fila 1: patrimonio neto, cash disponible, ahorro del mes, retorno cartera.
- Fila 2: alertas e insights.
- Fila 3: cashflow y evolución de patrimonio.
- Fila 4: top desvíos de gasto y composición de cartera.
- Fila 5: actividad reciente.

### Ingresos / Gastos

#### Qué hacen hoy
- Pantallas separadas con foco en carga y listado.

#### Problemas
- Separación rígida.
- Modelo de navegación operativo, no analítico.
- Duplicación conceptual y visual.

#### Rediseño
- Unificar en módulo “Movimientos”.
- Subvistas: lista, calendario, categorías, reglas de categorización.
- Filtros estándar: período, tipo, cuenta, categoría, origen.

### Cuotas

#### Qué hace hoy
- Gestiona compromisos en cuotas.

#### Problemas
- Está aislado como feature cuando en realidad es gasto comprometido.
- Su valor analítico debería verse en cashflow futuro y compromisos.

#### Rediseño
- Integrarla a “Compromisos futuros”.
- Mostrar calendario de vencimientos y peso sobre cashflow proyectado.

### Inversiones

#### Qué hace hoy
- Muestra KPIs, posiciones, transacciones, charts, señales y rebalanceo.

#### Problemas
- Es la mejor pantalla en ambición, pero está demasiado cargada.
- `Investments.tsx` es difícil de mantener.
- Mezcla portfolio analytics, operación, pricing, importación y UI compleja en un solo archivo.
- El gráfico temporal no representa del todo bien la evolución real del portfolio.

#### Rediseño
- Dividir en:
  - Resumen
  - Holdings
  - Operaciones
  - Riesgo y diversificación
  - Performance
  - Rebalanceo
- Introducir benchmark, FX exposure y contribución por posición.

### Patrimonio

#### Qué hace hoy
- Registra snapshots de activos.

#### Problemas
- No diferencia claramente activos líquidos, inversiones y otros activos.
- No habla de patrimonio neto si faltan pasivos.

#### Rediseño
- Renombrar a “Patrimonio neto”.
- Composición:
  - cash
  - inversiones
  - activos no líquidos
  - pasivos
  - patrimonio neto

### Objetivos

#### Qué hace hoy
- Gestiona metas y milestones.

#### Problemas
- Está desconectado del ahorro mensual y del portfolio.
- La UX probablemente sea más administrativa que estratégica.

#### Rediseño
- Mostrar funding progress, aporte recomendado mensual, proyección de cumplimiento y vinculación con cuentas/inversiones.

### Recurrentes

#### Qué hace hoy
- Mantiene transacciones recurrentes.

#### Problemas
- Es útil, pero como pantalla separada no tiene suficiente valor.

#### Rediseño
- Integrarla con movimientos y compromisos futuros.
- Mantener una vista administrativa secundaria.

### Reportes

#### Qué hace hoy
- Desglose, evolución, anual y YoY.

#### Problemas
- Mucho valor descriptivo, poco valor de decisión.
- Algunas tabs parecen más demos analíticas que reportes financieros integrados.

#### Rediseño
- Reportes por pregunta:
  - gasto
  - ingresos
  - ahorro
  - patrimonio
  - portfolio
  - comparativos

### Settings

#### Qué hace hoy
- Perfil, categorías, fuentes, temas y ubicación de DB.

#### Problemas
- Demasiadas responsabilidades heterogéneas.
- La parte de base compartida expone una solución frágil como flujo normal.

#### Rediseño
- Separar:
  - perfil
  - catálogos
  - personalización
  - datos y respaldo
  - importación/exportación

## 8. Mejoras de lógica financiera

### Debe incorporarse o consolidarse

- Patrimonio neto real:
  activos - pasivos, no solo snapshots de activos.

- Cashflow operativo:
  ingreso neto, gasto fijo, gasto variable, ahorro, compromisos futuros.

- Liquidez:
  porcentaje del patrimonio disponible en 24/72 horas.

- Ahorro:
  ahorro absoluto, tasa de ahorro, consistencia del ahorro.

- Portfolio:
  costo promedio, valor actual, P&L absoluto, P&L porcentual, P&L realizado vs no realizado.

- Riesgo:
  concentración por activo, sector, clase y moneda.

- FX:
  exposición por moneda y sensibilidad al tipo de cambio.

- Performance:
  retorno nominal, retorno real, retorno en moneda base y en moneda dura.

- Rebalanceo:
  gap versus asignación objetivo, monto sugerido por activo/clase.

- Alertas:
  caída de ahorro, desvío de presupuesto, concentración excesiva, vencimientos, deterioro de liquidez.

### Correcciones conceptuales necesarias

- No usar solo `current_value` aislado como verdad del portfolio.
- Distinguir transacción, holding consolidado y snapshot de valuación.
- No presentar “valor actual” como si fuera rendimiento completo sin aclarar costo, FX y período.
- Las métricas de evolución deben considerar series temporales reales y no sólo el último valor.

## 9. Plan de refactor por fases

### Fase 1. Enderezar la base
- Objetivo: reducir fragilidad y preparar escalabilidad.
- Tareas:
  - auditar modelo de datos
  - eliminar hardcodeo del perfil
  - normalizar query keys
  - separar utilidades de dominio
  - actualizar README
  - agregar tests de utilidades críticas
- Impacto: alto
- Prioridad: crítica
- Riesgos: cambios transversales de bajo glamour pero mucho alcance

### Fase 2. Reorganización arquitectónica frontend
- Objetivo: pasar de estructura por pantallas a estructura por dominio.
- Tareas:
  - crear `domains/`
  - mover hooks, queries, mappers y componentes
  - reducir páginas a shells delgadas
- Impacto: alto
- Prioridad: crítica
- Riesgos: churn de imports y deuda temporal de transición

### Fase 3. Design system real
- Objetivo: eliminar divergencia visual.
- Tareas:
  - tokens semánticos
  - componentes base
  - tablas y cards unificadas
  - headers, filtros, estados vacíos, banners
- Impacto: alto
- Prioridad: alta
- Riesgos: refactor visual amplio

### Fase 4. Rediseño del dashboard
- Objetivo: convertirlo en tablero de decisión.
- Tareas:
  - nueva jerarquía de métricas
  - alertas
  - cashflow + net worth
  - recomendaciones
- Impacto: muy alto
- Prioridad: muy alta
- Riesgos: requiere consolidar datos entre módulos

### Fase 5. Rediseño del módulo de movimientos
- Objetivo: unificar ingresos y gastos en una experiencia mejor.
- Tareas:
  - ledger unificado
  - filtros y tabla estándar
  - edición contextual
  - preparación para importación bancaria
- Impacto: muy alto
- Prioridad: muy alta
- Riesgos: migración de UX significativa

### Fase 6. Rediseño del módulo de inversiones
- Objetivo: hacerlo sólido como producto y mantenible como código.
- Tareas:
  - separar operaciones de holdings
  - consolidar analítica
  - benchmark y riesgo
  - refactor completo de `Investments.tsx`
- Impacto: muy alto
- Prioridad: muy alta
- Riesgos: módulo sensible por complejidad financiera

### Fase 7. Patrimonio, objetivos e insights
- Objetivo: conectar finanzas personales e inversión en una sola narrativa.
- Tareas:
  - net worth real
  - goals conectados con cashflow
  - insights automáticos
- Impacto: alto
- Prioridad: alta
- Riesgos: requiere mejor modelo de cuentas/pasivos

### Fase 8. Reportes, importación y robustez
- Objetivo: cerrar el producto como plataforma seria.
- Tareas:
  - importadores
  - reportes accionables
  - backup / restore
  - manejo resiliente de market data
- Impacto: alto
- Prioridad: media-alta
- Riesgos: depende de diseño final del dominio

## 10. Cambios concretos de código recomendados

### Críticos y de bajo arrepentimiento

1. Introducir `ProfileContext` real
- Reemplazar `const PROFILE_ID = "default"` por un provider central.
- Afecta:
  - `src/lib/queryKeys.ts`
  - `src/pages/*`
  - `src/components/layout/Sidebar.tsx`

2. Romper `Investments.tsx`
- Extraer:
  - `usePortfolioMetrics`
  - `usePortfolioPositions`
  - `usePortfolioPricing`
  - `InvestmentForm`
  - `HoldingsTable`
  - `TransactionsTable`
  - `PortfolioSummaryHeader`

3. Crear capa `domains/investments/mappers`
- Evitar que la página haga consolidación, clasificación y señales directamente.

4. Unificar tablas
- Hoy hay varias tablas ad hoc.
- Crear `SmartTable` reutilizable con columnas, sort y empty states.

5. Unificar headers de página
- Crear `PageHeader` y dejar de repetir botones “este mes / mes pasado / año pasado”.

6. Separar `Settings`
- Dividir la pantalla en secciones o subrutas por responsabilidad.

7. Endurecer backend
- Extraer servicios en Rust.
- Añadir validaciones formales de payloads.
- Corregir comentario/implementación de `prices.rs`.

8. Agregar tests de dominio
- `investmentCalcs.ts`
- utilidades de fechas
- agregaciones mensuales
- clasificación de instrumentos

## 11. Recomendaciones finales

- No conviene seguir agregando features grandes sobre esta base sin antes ordenar arquitectura.
- El mejor ROI no está en “más pantallas”; está en:
  - un dashboard más inteligente,
  - un ledger unificado,
  - un módulo de inversiones desacoplado,
  - una capa de patrimonio neto real,
  - y un design system consistente.

- Si se hace bien, esta app puede pasar de “tracker personal avanzado” a “plataforma financiera personal seria”.
- Si se sigue iterando feature por feature sin refactor, se va a volver lenta de evolucionar, difícil de testear y cada vez menos coherente para el usuario.

## Archivos clave auditados

- `src/App.tsx`
- `src/index.css`
- `src/lib/api.ts`
- `src/lib/queryKeys.ts`
- `src/lib/theme.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Investments.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Settings.tsx`
- `src/components/layout/Layout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/src/db/mod.rs`
- `src-tauri/src/commands/prices.rs`
- `src-tauri/migrations/001_initial.sql`
- `src-tauri/tauri.conf.json`
