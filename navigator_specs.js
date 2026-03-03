/**
 * ESPECIFICACIONES TECNICAS NAVIGATOR
 * Fuente: Resumen Técnico Navigator GPON
 * Uso: Referenciado por el motor de Presupuesto Óptico en index.html
 *
 * PENDIENTE: Agregar especificaciones de ONT/ONU cuando estén disponibles.
 */

window.NAVIGATOR_SPECS = {

    // ================================================================
    // OLT — OPTICAL LINE TERMINAL
    // Serie NAVGPT | ITU-T G.984/G.988 | FSAN
    // ================================================================
    OLT: {
        // Interfaz PON: SC/APC, SMF 9/125µm, velocidad 2.5G down / 1.25G up
        // Longitud de onda TX: 1490nm | RX: 1310nm
        models: {
            'NAVGPT-01P': {
                label: 'Navigator NAVGPT-01P (1 puerto GPON)',
                gponPorts: 1,
                maxSubs: 128,
                supportedClasses: ['classBplus', 'classCplus'],
                classBplus: { pTx_min: 1.5, pTx_max: 5.0, pTx_typical: 3.5, sRx: -28, pSat: -8, iturBudget: 28 },
                classCplus: { pTx_min: 3.0, pTx_max: 7.0, pTx_typical: 5.0, sRx: -30, pSat: -12, iturBudget: 32 },
                defaultClass: 'classBplus',
                maxDistKm: 20
            },
            'NAVGPT-02P': {
                label: 'Navigator NAVGPT-02P (2 puertos GPON)',
                gponPorts: 2,
                maxSubs: 256,
                supportedClasses: ['classBplus', 'classCplus'],
                classBplus: { pTx_min: 1.5, pTx_max: 5.0, pTx_typical: 3.5, sRx: -28, pSat: -8, iturBudget: 28 },
                classCplus: { pTx_min: 3.0, pTx_max: 7.0, pTx_typical: 5.0, sRx: -30, pSat: -12, iturBudget: 32 },
                defaultClass: 'classBplus',
                maxDistKm: 20
            },
            'NAVGPT-04P': {
                label: 'Navigator NAVGPT-04P (4 puertos GPON)',
                gponPorts: 4,
                maxSubs: 512,
                supportedClasses: ['classBplus', 'classCplus'],
                classBplus: { pTx_min: 1.5, pTx_max: 5.0, pTx_typical: 3.5, sRx: -28, pSat: -8, iturBudget: 28 },
                classCplus: { pTx_min: 3.0, pTx_max: 7.0, pTx_typical: 5.0, sRx: -30, pSat: -12, iturBudget: 32 },
                defaultClass: 'classBplus',
                maxDistKm: 20
            },
            'NAVGPT-08P': {
                label: 'Navigator NAVGPT-08P (8 puertos GPON)',
                gponPorts: 8,
                maxSubs: 1024,
                supportedClasses: ['classBplus', 'classCplus'],
                classBplus: { pTx_min: 1.5, pTx_max: 5.0, pTx_typical: 3.5, sRx: -28, pSat: -8, iturBudget: 28 },
                classCplus: { pTx_min: 3.0, pTx_max: 7.0, pTx_typical: 5.0, sRx: -30, pSat: -12, iturBudget: 32 },
                defaultClass: 'classBplus',
                maxDistKm: 20
            },
            'NAVGPT-16': {
                label: 'Navigator NAVGPT-16 (16 puertos GPON)',
                gponPorts: 16,
                maxSubs: 2048,
                supportedClasses: ['classBplus', 'classCplus', 'classCplusplus'],
                classBplus: { pTx_min: 1.5, pTx_max: 5.0, pTx_typical: 3.5, sRx: -28, pSat: -8, iturBudget: 28 },
                classCplus: { pTx_min: 3.0, pTx_max: 7.0, pTx_typical: 5.0, sRx: -30, pSat: -12, iturBudget: 32 },
                classCplusplus: { pTx_min: 6.0, pTx_max: 10.0, pTx_typical: 8.0, sRx: -32, pSat: -12, iturBudget: 35 },
                defaultClass: 'classCplus',
                maxDistKm: 60
            }
        }
    },

    // ================================================================
    // ONT / ONU — PENDIENTE
    // ================================================================
    ONT: {
        // Fuente: Resumen Técnico Navigator — Parte 2: ONU/ONT
        // Interfaz PON: SC/PC, SMF, GPON FSAN G.984.2 Clase B+
        // Longitud de onda TX: 1310nm | RX: 1490nm
        // Sensibilidad GPON: -28 dBm | EPON: -27 dBm
        models: {
            'SM164242-T21': {
                label: 'SM164242-GHDUHR-T21 — Gateway Convergente Dual (Triple Play)',
                type: 'ONT/ONU Residencial',
                gpon: {
                    standard: 'FSAN G.984.2 Clase B+',
                    speedDown: 2488,   // Mbps
                    speedUp: 1244,   // Mbps
                    sRx: -28,    // dBm — sensibilidad de recepcion
                    pTx_min: 0.5,    // dBm
                    pTx_max: 5.0,    // dBm
                    pSat: -8,     // dBm
                    connector: 'SC/PC',
                    wavelengthTX: 1310,  // nm
                    wavelengthRX: 1490   // nm
                },
                epon: {
                    standard: '1000BASE-PX20+ Simetrico',
                    sRx: -27,       // dBm
                    pTx_min: 0,
                    pTx_max: 4.0,
                    pSat: -3
                },
                features: ['4x GigE', 'WiFi 2.4G/5G', '2x POTS', 'USB 2.0', 'CATV opcional'],
                powerW: { static: 2, max: 7 }
            },
            'SM16101-T10': {
                label: 'SM16101-GHZ-T10 — ONT Simple / Minimalista (Datos)',
                type: 'ONT Compacto',
                gpon: {
                    standard: 'FSAN G.984.2 Clase B+',
                    speedDown: 2488,
                    speedUp: 1244,
                    sRx: -28,    // dBm
                    pTx_min: 0.5,
                    pTx_max: 5.0,
                    pSat: -8,
                    connector: 'SC/PC',
                    wavelengthTX: 1310,
                    wavelengthRX: 1490
                },
                epon: {
                    standard: '1000BASE-PX20+ Simetrico',
                    sRx: -27,
                    pTx_min: 0,
                    pTx_max: 4.0,
                    pSat: -3
                },
                features: ['1x GigE', 'IPv4/IPv6'],
                powerW: { static: 2, max: 2.5 }
            }
        }
    },

    // ================================================================
    // SPLITTERS OPTICOS
    // Valores estandar ITU-T G.671 (estimados, aplicar hasta recibir datos reales)
    // Conector: SC/APC
    // ================================================================
    SPLITTERS: {
        '1:2': { dB: 3.7, label: '1:2  (3.7 dB)' },
        '1:4': { dB: 7.2, label: '1:4  (7.2 dB)' },
        '1:8': { dB: 10.5, label: '1:8  (10.5 dB)' },
        '1:16': { dB: 13.5, label: '1:16 (13.5 dB)' },
        '1:32': { dB: 16.8, label: '1:32 (16.8 dB)' },
        '1:64': { dB: 20.0, label: '1:64 (20.0 dB)' }
    },

    // ================================================================
    // CABLE DE FIBRA OPTICA
    // Valores estandar ITU-T G.652D (estimados)
    // ================================================================
    FIBER: {
        alpha_1310: 0.35,  // dB/km a 1310nm (upstream)
        alpha_1490: 0.20,  // dB/km a 1490nm (downstream)
        alpha_1550: 0.20,  // dB/km a 1550nm (video overlay)
        singleMode: '9/125µm SMF'
    },

    // ================================================================
    // CONECTORES  (SC/APC — estimado estandar)
    // ================================================================
    CONNECTORS: {
        'SC/APC': { dB: 0.30, label: 'SC/APC' },
        'SC/UPC': { dB: 0.50, label: 'SC/UPC' }  // mayor pérdida por reflexión
    },

    // ================================================================
    // EMPALMES (estimado estandar — sin datos reales disponibles)
    // ================================================================
    SPLICES: {
        fusion: { dB: 0.10, label: 'Empalme por fusión (estimado)' },
        mechanical: { dB: 0.30, label: 'Empalme mecánico (estimado)' }
    },

    // ================================================================
    // MARGEN DE ENVEJECIMIENTO RECOMENDADO
    // ================================================================
    SAFETY_MARGIN: {
        default: 2.0,   // dB — recomendado para redes nuevas
        min: 1.5,
        max: 3.0
    }
};
