/**
 * ESPECIFICACIONES TECNICAS NAVIGATOR
 * Fuente: Resumen Técnico Navigator GPON
 * Uso: Referenciado por el motor de Presupuesto Óptico en index.html
 *
 * PENDIENTE: Agregar especificaciones de ONT/ONU cuando estén disponibles.
 */

window.NAVIGATOR_SPECS = {

    // ================================================================
    // SFP MÓDULOS ÓPTICOS (NUEVA TABLA 1)
    // ================================================================
    SFP: {
        models: {
            'SFP GPON C+++': {
                manufacturer: 'Huawei', tech: 'GPON', version: 'C+++', speedGbps: 2.5,
                pTx_min: 5.0, pTx_max: 10.0, pTx_typical: 7.5, sRx: -31,
                maxDistKm: 60
            },
            'SFP GPON C++': {
                manufacturer: 'Huawei', tech: 'GPON', version: 'C++', speedGbps: 2.5,
                pTx_min: 4.0, pTx_max: 9.0, pTx_typical: 6.5, sRx: -29,
                maxDistKm: 40
            },
            'SFP GPON C+': {
                manufacturer: 'Huawei', tech: 'GPON', version: 'C+', speedGbps: 2.5,
                pTx_min: 3.0, pTx_max: 7.0, pTx_typical: 5.0, sRx: -27,
                maxDistKm: 30
            },
            'SFP 10G GPON C+': {
                manufacturer: 'Huawei', tech: 'XGS-PON/GPON', version: 'C+', speedGbps: 10.0,
                pTx_min: 5.0, pTx_max: 7.0, pTx_typical: 6.0, sRx: -28,
                maxDistKm: 35
            }
        }
    },

    // ================================================================
    // OLT — OPTICAL LINE TERMINAL (NUEVA TABLA 2)
    // ================================================================
    OLT: {
        models: {
            'NAVGPT-01P': {
                label: 'Navigator NAVGPT-01P (1 puerto GPON)', manufacturer: 'SUMEC/Navigator',
                gponPorts: 1, xgsPonPorts: 0, tech: 'GPON', maxSpeedGbps: 2.5, maxSubs: 128
            },
            'NAVGPT-02P': {
                label: 'Navigator NAVGPT-02P (2 puertos GPON)', manufacturer: 'SUMEC/Navigator',
                gponPorts: 2, xgsPonPorts: 0, tech: 'GPON', maxSpeedGbps: 2.5, maxSubs: 256
            },
            'NAVGPT-04P': {
                label: 'Navigator NAVGPT-04P (4 puertos GPON)', manufacturer: 'SUMEC/Navigator',
                gponPorts: 4, xgsPonPorts: 0, tech: 'GPON', maxSpeedGbps: 2.5, maxSubs: 512
            },
            'NAVGPT-08P': {
                label: 'Navigator NAVGPT-08P (8 puertos GPON)', manufacturer: 'SUMEC/Navigator',
                gponPorts: 8, xgsPonPorts: 0, tech: 'GPON', maxSpeedGbps: 2.5, maxSubs: 1024
            },
            'NAVGPT-16P': {
                label: 'Navigator NAVGPT-16P (16 puertos GPON)', manufacturer: 'SUMEC/Navigator',
                gponPorts: 16, xgsPonPorts: 0, tech: 'GPON', maxSpeedGbps: 2.5, maxSubs: 2048
            },
            'MA5800-X7': {
                label: 'Huawei MA5800-X7 (Distribuida 6U)', manufacturer: 'Huawei',
                gponPorts: 112, xgsPonPorts: 56, tech: 'GPON + XGS-PON', maxSpeedGbps: 10.0, maxSubs: 7000
            },
            'MA5800-X17': {
                label: 'Huawei MA5800-X17 (Distribuida 11U)', manufacturer: 'Huawei',
                gponPorts: 272, xgsPonPorts: 136, tech: 'GPON + XGS-PON', maxSpeedGbps: 10.0, maxSubs: 17000
            },
            'ZTE-C620': {
                label: 'ZTE C620 10G AC (Combo)', manufacturer: 'ZTE',
                gponPorts: 16, xgsPonPorts: 16, tech: 'GPON + XGS-PON Combo', maxSpeedGbps: 10.0, maxSubs: 4096
            }
        }
    },

    // ================================================================
    // MATRIZ DE COMPATIBILIDAD Y CRITERIOS (TABLAS 3 y 4)
    // ================================================================
    RULES: {
        marginAging: 2.0,      // dB envejecimiento
        marginWeather: 1.5,    // dB clima
        marginInterference: 0.5, // dB interferencia
        overSubscriptionFactor: 2.5
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
