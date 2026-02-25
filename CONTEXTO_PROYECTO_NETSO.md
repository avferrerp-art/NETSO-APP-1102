# Arquitectura y Contexto del Proyecto: Netso Expert (Generador BOM y Redes FTTH)

Este documento centraliza el conocimiento técnico, la arquitectura y las herramientas utilizadas en la plataforma de Netso. Está diseñado para servir como "prompt maestro" o guía de arquitectura para integrar nuevos desarrolladores o asistentes de IA al proyecto.

---

## 1. Definición del Producto
**Netso Expert** es una aplicación web (Single Page Application - SPA) dirigida a Proveedores de Servicios de Internet (ISPs) y administradores internos de Netso.
Su propósito principal es **automatizar la ingeniería de redes de fibra óptica (FTTH)**. Permite a los usuarios definir un polígono o radio de cobertura, estimar la cantidad de clientes, y automáticamente genera:
1. Una topología de red visual en un mapa interactivo (ubicación de OLT, postes, cajas NAP, y rutas de fibra).
2. Cálculos de presupuesto óptico (pérdida de señal).
3. Una Lista de Materiales (BOM - Bill of Materials) exacta que se cruza con el inventario real en **Odoo** para dar precios y disponibilidad en tiempo real.
4. Exportación de cotizaciones y planes de compra a Excel.

---

## 2. Archivos Cruciales (Core Stack)

La aplicación utiliza tecnologías web estándar (Vanilla JS, HTML5, CSS3) orientadas a la velocidad y ejecución del lado del cliente sin requerir un framework pesado como React o Angular.

*   **`index.html` (La Estructura y UI):** Contiene el esqueleto de la aplicación. Gestiona un sistema de "Páginas" o "Pasos" (formularios de login, ingreso de parámetros, contenedor del mapa interactivo y la tabla final de resultados). Carga todas las librerías externas mediante etiquetas `<script>` y `<link>`.
*   **`style.css` (Capa de Presentación):** Archivo de estilos que contiene el diseño responsivo, las animaciones, el modo oscuro parcial y la paleta de colores corporativa de Netso.
*   **`script.js` (El Motor Monolítico):** Es el corazón del sistema. Controla la lógica de estado de la UI, la integración con APIS de mapas, el algoritmo del Árbol de Expansión Mínima (MST) para las rutas, la lógica de empaquetado y la sincronización asíncrona con Odoo y Firebase.
*   **`products_data.js` / `productos.json`:** Diccionarios locales que mapean los nombres genéricos de ingeniería (ej. "Fibra ADSS 48 Hilos") con los SKUs o nombres exactos de los productos registrados en el ERP Odoo.
*   **`LOGICA_NEGOCIO_BOM.md`:** Documento de texto que detalla las fórmulas matemáticas subyacentes: factores de holgura (slack) para cables, cálculo de presupuestos ópticos, y las reglas que deciden cuándo usar NAPs de 16 puertos vs 48 puertos.

---

## 3. APIs y Servicios Externos Utilizados

El sistema no opera aislado de la red; integra varios servicios remotos para realizar cálculos logísticos y comerciales:

### A. Ecosistema de Mapas e Inteligencia Geoespacial
1.  **MapLibre GL JS:** La librería base para renderizar el mapa interactivo en el navegador de forma fluida usando WebGL. Se usa porque es de código abierto y altamente personalizable.
2.  **MapTiler API:** Provee los "tiles" (imágenes vectoriales y satelitales) que sirven como fondo para el mapa de MapLibre. Se identifica usualmente con un token de acceso.
3.  **OSRM (Open Source Routing Machine) API:** 
    *   **¿Para qué se usa?** Para trazar la fibra óptica por las calles reales en lugar de trazar líneas rectas atravesando edificios.
    *   **¿Cómo funciona?** El sistema calcula un MST (Árbol de Expansión Mínima) para saber qué NAP se conecta con qué NAP. Luego, lanza peticiones a la API "Route" de OSRM para obtener el dibujo exacto de las calles. *Nota: Tiene un mitigador de saturación en `script.js` para grandes topologías (>60 nodos) que evita el error HTTP 429 cruzando a fórmulas directas (Haversine) si la red es inmensa.*

### B. Ecosistema Comercial y Bases de Datos
4.  **Odoo API (ERP):**
    *   **¿Para qué se usa?** Es la fuente de la verdad para el inventario físico y los precios.
    *   **¿Cómo funciona?** Cuando se calcula el BOM, la app consulta el catálogo de Odoo. Si se determinó que se necesitan 1000 metros de cable Drop, busca la referencia en Odoo, verifica si hay `qty_available` (Stock) y extrae el `list_price_usd`. Luego lo proyecta en la página 4 y en el Excel descargable.
5.  **Firebase / Firestore (Google Cloud):**
    *   **¿Para qué se usa?** Sistema de autenticación de clientes (Login ISP) y base de datos NoSQL para almacenar el historial de proyectos ("Mis Proyectos").
    *   **¿Cómo funciona?** Al finalizar una simulación (Página 4), se dispara un evento asíncrono que sube un JSON con el polígono del mapa, la lista de materiales y los cálculos ópticos a una colección en Firebase, permitiendo recuperarlo en futuras sesiones.

### C. Inteligencia Artificial Analítica
6.  **Google Gemini API:**
    *   **¿Para qué se usa?** Es el componente "experto" que aconseja qué equipos extra comprar dependiendo del contexto geográfico trazado por el usuario.
    *   **¿Cómo funciona?** Al finalizar el cálculo base de materiales, el script envía detalles matemáticos sobre la densidad del área y cantidad de clientes cubiertos (junto con datos espaciales y de postes) a un modelo Gemini remoto a través de un proxy/función HTTP en la nube. Gemini responde con un recuento analítico sugiriendo, por ejemplo, "comprar cintas de acero y tensores adicionales porque es una zona rural con alta demanada". Estás sugerencias viajan de vuelta como objetos al carro de `lista_faltantes` con origen `ai-suggestion`.

---

## 4. Flujo de Ejecución (Paso a Paso)

Para ubicar errores o programar nuevas funciones, este es el viaje de los datos:

1.  **Fase 1 (Inicio):** El usuario ingresa (Firebase Auth) e introduce la cantidad de clientes (censo), radio deseado y tipo de SFP a colocar en la OLT.
2.  **Fase 2 (Generación Cartográfica):** El script usa Geolocalización para centrar el mapa. Despliega un marcador centralizado (OLT).
3.  **Fase 3 (Algoritmos de Nodos):** Crea NAPs virtuales distribuidas alrededor de la OLT. Emplea simulaciones de postes y "snappea" las NAPs a las infraestructuras viables más cercanas.
4.  **Fase 4 (Enrutamiento):** Ejecuta la función `drawNetworkLines`. Conecta la OLT con los NAPs primero lógicamente mediante matrices de distancia y luego visualmente pidiendo caminos vehiculares a la API OSRM.
5.  **Fase 5 (Ingeniería Inversa BOM):** Llama a `finalizar()`. Determina la pérdida de los Splitters, metros de cable (sumando porcentajes por instalación en áreas rurales vs urbanas) y consolida la lista cruda.
6.  **Fase 6 (Sincronización Odoo y Tablas):** Llama a `renderCotizacionTable()`. Empareja la lista cruda con el JSON de Odoo para agregar nombres de catálogo y precios en USD `(list_price_usd)`. Muestra los datos en HTML.
7.  **Fase 7 (Exportación):** Generación manual mediante Blob de un archivo `.xls` en `downloadComparisonReport()`, estructurado en tablas HTML compatibles con MS Excel, insertando el costo unitario USD del último escaneo de Odoo.

---

## 5. Panel de Supervisión (Netso Admin Dashboard)

Netso Expert posee una vista separada y privilegiada para el personal interno de la compañía que opera en la sombra del flujo estándar del cliente ISP.

¿Qué se puede hacer en el *Admin Dashboard*?
1.  **Observabilidad de Proyectos ("Mis Proyectos Globales"):** Un Netso Admin puede ver en una tabla maestra todos los proyectos guardados en Firestore por todos los clientes/ISPs en tiempo real. Pueden revisar ubicaciones, cantidades calculadas y estatus de los levantamientos sin pedírselos al cliente.
2.  **Sincronización Maestra Odoo/BDD:** Tienen la capacidad de forzar una sincronización global para descargar el último catálogo de `products_data` y purgar el caché, asegurando que todos los ingenieros ISP que generen planes vean los nuevos herrajes o cambios de precios del día.
3.  **Auditoría de Stock de Odoo en Vivo:** Poseen visualización directa para revisar "qué hay en los galpones ahora mismo" sin requerir abrir el software contable directamente.

---

## 5. Prevención de Riesgos Comunes
*   **Asincronismo del Mapa:** Las capas (`layers`) y fuentes (`sources`) de fibra en MapLibre solo pueden actualizarse cuando el mapa ha terminado de cargar. Alterar el DOM antes provoca crasheos.
*   **Rate Limits OSRM:** Manipular `drawNetworkLines()` sin cuidado provocará bloqueos del servidor público de mapas. Para modificaciones, mantener siempre el bloqueador de `BATCH_SIZE` temporal.
*   **Variables Globales:** `script.js` hace fuerte uso de variables asociadas al objeto `window` (ej: `window.finalReportState`). Abstenerse de sobreescribirlas accidentalmente en funciones locales.
