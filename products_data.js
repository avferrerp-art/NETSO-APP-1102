// ============================================
// CATÁLOGO DE PRODUCTOS Y REGLAS (GENERADO DESDE EXCEL)
// ============================================

const PRODUCT_MAPPING = {
    // FIBRA
    "Drop Flat/Tenzado 1 hilo (Bobina 1km)": "[NTS010001] FIBRA DROP GJYXCH 1 HILOS NETSO MENSAJERO METALICO 1KM G657.A1",
    "ADSS 24 hilos (Distribución)": "[NTS010028] FIBRA OPTICA ADSS 24 HILOS G652D SPAN100 4KM SUMEC",
    "ADSS 24 hilos": "FIBRA OPTICA ADSS 24 HILOS G652D SPAN100 4KM SUMEC",
    "ADSS 12 hilos": "FIBRA OPTICA ADSS 12 HILOS G652.D NETSO SPAN 100 4KM 10.1MM",
    "ADSS 48 hilos": "[NTS010013] FIBRA OPTICA ADSS 48 HILOS G652.D NETSO SPAN 100 4KM 10.8MM",
    "ADSS 96 hilos": "FIBRA OPTICA ADSS 96 HILOS G652.D NETSO SPAN 100 4KM 12.5MM",

    // EQUIPOS ACTIVOS
    "OLT Navigator 4 Puertos": "OLT NAVGPT-04P SUMEC 4 PUERTOS GPON",
    "OLT Navigator 8 Puertos": "[NTS120001] OLT NAVGPT-08P SUMEC 8 PUERTOS GPON",
    "OLT Navigator 16 Puertos": "OLT NAVGPT-16P SUMEC 16 PUERTOS GPON",
    "Módulos SFP C++": "MODULO SFP HUAWEI GPON C++",
    "SFP Clase C+": "MODULO SFP HUAWEI GPON 10G 1310NM 10KM SM C+",
    "SFP Clase C++": "MODULO SFP HUAWEI GPON C++",
    "SFP Clase B+": "MODULO SFP GPON C+++ SUMEC",

    // DIVISION Y CONECTORIZACION
    "Splitter PLC 1x4 (Nivel 1)": "SPLITTER PLC SC/APC 1X4 DE COLORES",
    "Splitter PLC APC 1x4": "SPLITTER PLC SC/APC 1X4 DE COLORES",
    "Splitter PLC APC 1x8": "SPLITTER PLC SC/APC 1X8",
    "Splitter PLC APC 1x16": "SPLITTER PLC SC/APC 1X16",
    "Splitter PLC APC 1x32": "SPLITTER PLC SC/APC 1X32",
    "Caja Nap 16 puertos (Splitter 1x16 APC)": "[NTS040030] CAJA NAP 16 PUERTOS IP65 PC NETSO SPLITTER 1X16 ST-F218-A",
    "Caja Nap 16 puertos (2x Splitter 1x8 APC)": "CAJA NAP 16 PUERTOS IP65 PC NETSO SPLITTER 1X8 ST-F218-A",
    "Caja Nap 48 puertos (2x Splitter 1x32 APC)": "CAJA NAP 48 PUERTOS IP65 NETSO CARGADA CON SP 1X32 SNT",
    "Caja Nap 8 puertos (2x Splitter 1x4 APC)": "CAJA NAP 8 PUERTOS IP65 ABS+PC NETSO CARGADA CON SP 1X4 ST-227",
    "Caja Nap 4 puertos (Splitter 1x4 APC)": "CAJA NAP 4 PUERTOS IP65 ABS+PC NETSO CARGADA CON SP 1X4 ST-F311",
    "Caja Nap 32 puertos (Splitter 1x32 APC)": "CAJA NAP 48 PUERTOS IP65 NETSO CARGADA CON SP 1X32 SNT",
    "Caja Nap 64 puertos (2x Splitter 1x32 APC)": "CAJA NAP 48 PUERTOS IP65 NETSO CARGADA CON SP 1X32 SNT",
    "ONT T21 Navigator Doble Banda": "ONT SUMEC NAVIGATOR T21 CON CATV",
    "ONT T21 Navigator con CATV Doble Banda y catv": "ONT SUMEC NAVIGATOR T21 CON CATV",
    "ONT T21 Navigator con CATV Doble Banda": "ONT SUMEC NAVIGATOR T21 CON CATV",
    "Mini ONU T10 Navigator Gigabit": "ONU SUMEC T10 XPON",
    "Router T12 Navigator WIFI 5": "ROUTER AC1200 SUMEC NAVIGATOR",

    // HERRAJES Y OTROS
    "Fleje de Acero 1/2 pulgada": "[NTS070027] FLEJE 1/2 ACERO 201 19*0, 7MM 45MTS",
    "Fleje de Accero 1/2 pulgada (45 mts)": "[NTS070027] FLEJE 1/2 ACERO 201 19*0, 7MM 45MTS",
    "Fleje de acero 1/2 pulgada (45 mts)": "[NTS070027] FLEJE 1/2 ACERO 201 19*0, 7MM 45MTS",
    "Fleje de acero 1/2 pulgada (45mts)": "[NTS070027] FLEJE 1/2 ACERO 201 19*0, 7MM 45MTS",
    "Fleje de acero 3/4 pulgada (45mts)": "FLEJE 3/4 ACERO 201 19*0.7*45MTS",
    "Hebillas de Acero 1/2 pulgada": "HEBILLA 1/2",
    "Hebilla para flejes 1/2 y 3/4 pulgadas": "HEBILLA 1/2",
    "Tensores Drop": "[NTS060016] TENSOR DROP METALICO TIPO CUÑA",
    "Tensor metálico con herraje tipo cuña": "TENSOR PARA DROP METALICO TIPO CUÑA",
    "Tensor tipo ancla (Modelo Tensor)": "TENSOR ADSS PAL-1500 TIPO ANCLA PLASTICO Y METALICO DR1500 10,1MM A 14MM",
    "Abrazaderas (para tensor ancla)": "TENSOR DROP TIPO ABRAZADERA PLASTICO",
    "Conectores Rápidos SC/APC": "[NTS030001] CONECTOR MECANICO SC/APC SUMEC",
    "Conector Tipo A (Modelo APC)": "[NTS030001] CONECTOR MECANICO SC/APC SUMEC",
    "Conectores Rápidos SC/UPC": "[NTS030021] CONECTOR MECANICO SC/UPC NAVIGATOR (ROBOCOP)",
    "Conector Tipo A (Modelo UPC)": "[NTS030021] CONECTOR MECANICO SC/UPC NAVIGATOR (ROBOCOP)",
    "Rosetas Ópticas": "ROSETA FTTH, ACOPLE FP-008",
    "Roseta con acoples APC": "ROSETA FTTH, ACOPLE FP-008",
    "Acople APC": "ACOPLADOR SIMPLEX SC/APC",
    "Preformado NETSO": "PREFORMADO TIPO DEAD END 1/2 PARA CABLE DIAMETRO 12.4 A 13MM",
    "Manga de Empalme Domo 24/48 hilos": "MANGA DOMO 24 CORES IP68 CON PUERTO OVAL MEDIANA TERMOCONTRAIBLE",
    "Herraje de Sujeción Tipo D (Trompoplatina)": "HERRAJE DE SUJECION TIPO D (TROMPOPLATINA)",
    "Herraje de Suspensión Tipo J 5MM - 8MM": "[NTS060025] HERRAJE DE SUSPENSION TIPO J 5MM - 8MM",
    "Tensor ADSS": "TENSOR ADSS PAL-1500 TIPO ANCLA PLASTICO Y METALICO DR1500 10,1MM A 14MM",
    "Fleje de Acero 1/2 pulgada (45 mts)": "[NTS070027] FLEJE 1/2 ACERO 201 19*0, 7MM 45MTS",
    "Acople UPC": "ACOPLADOR SIMPLEX SC/UPC"
};

const MATERIAL_RULES = {
    "Drop Flat/Tenzado 1 hilo (Bobina 1km)": { "unit": "Bobina", "qty_per_unit": 1000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "Drop 1 hilo": { "unit": "Bobina", "qty_per_unit": 1000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "ADSS 24 hilos (Distribución)": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "ADSS 24 hilos": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "ADSS 12 hilos": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "ADSS 48 hilos": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "ADSS 96 hilos": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "ESTRICTO", "logic": "Fibra" },

    // Equipos Activos
    "OLT Navigator 4 Puertos": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "OLT Navigator 8 Puertos": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "OLT Navigator 16 Puertos": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Módulos SFP C++": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "SFP Clase C+": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "SFP Clase C++": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "SFP Clase B+": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },

    // Splitters y Cajas
    "Splitter PLC 1x4 (Nivel 1)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Splitter PLC APC 1x4": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Splitter PLC APC 1x8": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Splitter PLC APC 1x16": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Splitter PLC APC 1x32": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Caja Nap 16 puertos (Splitter 1x16 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap 16 puertos (2x Splitter 1x8 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap 48 puertos (2x Splitter 1x32 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap 8 puertos (2x Splitter 1x4 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap 4 puertos (Splitter 1x4 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap 32 puertos (Splitter 1x32 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap 64 puertos (2x Splitter 1x32 APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },
    "Caja Nap OTB 16 puertos con Splitter 1x16 APC": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "NAP" },

    // ONTs y Routers
    "ONT T21 Navigator Doble Banda": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "ONT T21 Navigator con CATV Doble Banda": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "ONT T21 Navigator con CATV Doble Banda y catv": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Mini ONU T10 Navigator Gigabit": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Router T12 Navigator WIFI 5": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },

    // Herrajes (Nuevas llaves exactas)
    "Fleje de Acero 1/2 pulgada": { "unit": "Rollo", "qty_per_unit": 45.0, "rounding": "ESTRICTO", "logic": "Manual" },
    "Fleje de Accero 1/2 pulgada (45 mts)": { "unit": "Rollo", "qty_per_unit": 45.0, "rounding": "ESTRICTO", "logic": "Manual" }, // Typo posible en log
    "Fleje de Acero 1/2 pulgada (45 mts)": { "unit": "Rollo", "qty_per_unit": 45.0, "rounding": "ESTRICTO", "logic": "Manual" },
    "Fleje de acero 1/2 pulgada (45mts)": { "unit": "Rollo", "qty_per_unit": 45.0, "rounding": "ESTRICTO", "logic": "Manual" },
    "Fleje de acero 3/4 pulgada (45mts)": { "unit": "Rollo", "qty_per_unit": 45.0, "rounding": "ESTRICTO", "logic": "Manual" },
    "Hebillas de Acero 1/2 pulgada": { "unit": "Unidad", "qty_per_unit": 100.0, "rounding": "LIBRE", "logic": "Manual" },
    "Hebilla para flejes 1/2 y 3/4 pulgadas": { "unit": "Unidad", "qty_per_unit": 100.0, "rounding": "LIBRE", "logic": "Manual" },

    // Tensores y Herrajes Varios (Faltantes en logs)
    "Tensores Drop": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Tensor ADSS": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Preformado NETSO": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Manga de Empalme Domo 24/48 hilos": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Herraje de Sujeción Tipo D (Trompoplatina)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Herraje de Suspensión Tipo J 5MM - 8MM": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },

    "Tensor metálico con herraje tipo cuña": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Tensor tipo ancla (Modelo Tensor)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Abrazaderas (para tensor ancla)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },

    // Conectorización
    "Conectores Rápidos SC/APC": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Conector Tipo A (Modelo APC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Conectores Rápidos SC/UPC": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Conector Tipo A (Modelo UPC)": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Rosetas Ópticas": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Roseta con acoples APC": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Cliente" },
    "Acople APC": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" },
    "Acople UPC": { "unit": "Unidad", "qty_per_unit": 1.0, "rounding": "LIBRE", "logic": "Manual" }
};
