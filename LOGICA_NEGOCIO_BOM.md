# ⚙️ Lógica de Negocio y Cálculo de Materiales (Non-AI)
*Este documento describe las fórmulas y algoritmos utilizados para generar el diseño de red y la lista de materiales (BOM) en la Página 4.*

---

## 1. Motor de Optimización de Red (NAP Mix)
La aplicación no solo calcula cuántas cajas (NAPs) necesitas, sino que intenta optimizar el costo y la gestión utilizando una mezcla inteligente de capacidades:

- **Objetivo de Utilización:** 90% (evita saturar las cajas al 100% para dejar margen de mantenimiento).
- **Capacidades Efectivas:**
  - **NAP 16p:** 14.4 clientes reales.
  - **NAP 48p:** 43.2 clientes reales.
- **Algoritmo de Selección:** 
  1. Primero se calcula cuántas cajas de **48 puertos** cubren la mayor parte del censo.
  2. El remanente (clientes sobrantes) se cubre con cajas de **16 puertos**.
  *Esto reduce la cantidad total de puntos de falla y empalmes en la red.*

---

## 2. Ingeniería Óptica (Presupuesto de Potencia)
Se realiza un cálculo de pérdida teórica para determinar si el cliente más lejano tendrá señal suficiente:

- **Fórmula de Potencia Final ($P_f$):**
  $$P_f = P_{sfp} - L_{cable} - L_{splitter} - M_s$$
  
  - **$P_{sfp}$ (Transmisión):** +7.0 dBm (para SFPs C++) o +4.5 dBm (estándar).
  - **$L_{cable}$ (Pérdida Fibra):** Distancia (km) × 1.5 (recorrido no lineal) × 0.35 dB/km.
  - **$L_{splitter}$ (División):** 13.8 dB (valor promedio para cascada 1:8 + 1:8).
  - **$M_s$ (Margen de Seguridad):** 3.5 dB (reservado para dobleces, empalmes y degradación).

**Escalas de Resultado:**
- ✅ **Ideal:** > -27.0 dBm
- ⚠️ **Aceptable:** > -28.0 dBm
- ❌ **Crítico:** ≤ -28.0 dBm

---

## 3. Lógica de Selección de Cables (Troncal y Distribución)
La aplicación elige el tipo de cable ADSS automáticamente según la envergadura del proyecto:

| Clientes (Censo) | Tipo de Fibra Troncal |
| :--- | :--- |
| > 1,000 | ADSS 96 Hilos |
| 200 - 1,000 | ADSS 48 Hilos |
| 100 - 200 | ADSS 24 Hilos |
| < 100 (Rural) | ADSS 12 Hilos |

---

## 4. Cálculo de Metrajes y Factores de Holgura (Slack)
Para evitar que el cable quede corto en la instalación real, se aplican factores de corrección:
- **Factor Rural:** 1.30 (30% extra para evitar obstáculos o grandes vanos).
- **Factor Urbano:** 1.15 (15% extra para cruces de calle y reservas).

**Fórmulas de Metraje:**
- **Cable Drop:** `Clientes * 125m * Factor_Holgura`
- **Cable Troncal:** `Radio_Cobertura * 1.5 * Factor_Holgura`
- **Cable Distribución:** `Cantidad_NAPs * 200m * Factor_Holgura`

---

## 5. Auditoría de Inventario (Delta Logics)
Antes de sugerir una compra, el sistema "resta" lo que ya tienes:
1. **Lógica "Smart Match":** Busca en tu inventario palabras clave (ej: si tienes "Cable ADSS 24", lo descuenta del requerimiento de fibra troncal).
2. **Priorización:** Primero consume el stock del usuario y solo lo que falta se añade a la "Lista de Compra".

---

## 6. Redondeo y Empaque (MaterialCalculator)
Todos los resultados pasan por un filtro de empaque comercial:
- **Bobinas:** Si necesitas 1,200m de cable, el sistema redondea a 2 bobinas (si la regla es de 1km) o muestra `1.2 Bobinas` según la configuración de redondeo "Libre" o "Estricto".
- **Hardware:** Los herrajes se calculan en base a la cantidad de postes estimados (distancia / 50m).
