/**
 * Módulo de Despliegue de Fibra Real (Calles + Infraestructura)
 * Versión: 1.0
 */

// --- CONFIGURACIÓN Y CONSTANTES ---
const FIBRA_CONFIG = {
    P_TX: 7,
    SENSIBILIDAD_RX: -27,
    ALPHA: 0.35, // dB/km
    PERDIDA_CONECTOR: 0.5,
    PERDIDA_EMPALME: 0.1,
    MARGEN_SEGURIDAD: 3,
    SPLITTER_NAP16: 13.5,
    SPLITTER_NAP48: 17.3,
    MS_BETWEEN_REQUESTS: 200
};

// Variables de Estado
let consecutiveErrors = 0;
let OFFLINE_MODE = false;

const RUTA_CACHE = new Map();
const RUTA_QUEUE = [];
let isProcessingQueue = false;

// --- PASO 1: RUTEO POR CALLES REALES ---

/**
 * Obtiene la ruta de fibra entre dos puntos.
 * Si OFFLINE_MODE está activo o la API falla, usa geometría esférica (Línea Recta).
 */
async function obtenerRutaFibra(origen, destino) {
    const key = `${origen.lat},${origen.lng}→${destino.lat},${destino.lng}`;

    // 1. Revisar Caché
    if (RUTA_CACHE.has(key)) return RUTA_CACHE.get(key);

    // 2. Modo Offline (Fallback Inmediato)
    if (OFFLINE_MODE) {
        return calcularLineaRecta(origen, destino, key);
    }

    // 3. Intentar API de Google
    return new Promise((resolve, reject) => {
        const request = () => {
            if (OFFLINE_MODE) { // Check again in case mode changed while in queue
                resolve(calcularLineaRecta(origen, destino, key));
                return;
            }

            const directionsService = new google.maps.DirectionsService();
            directionsService.route({
                origin: new google.maps.LatLng(origen.lat, origen.lng),
                destination: new google.maps.LatLng(destino.lat, destino.lng),
                travelMode: google.maps.TravelMode.WALKING
            }, (response, status) => {
                if (status === 'OK') {
                    consecutiveErrors = 0; // Reset error count
                    const route = response.routes[0];
                    const result = {
                        path: google.maps.geometry.encoding.decodePath(route.overview_polyline),
                        distancia_m: route.legs[0].distance.value,
                        polyline_encoded: route.overview_polyline
                    };
                    RUTA_CACHE.set(key, result);
                    resolve(result);
                } else {
                    console.warn(`⚠️ API Error (${status}) - Fallback activado`);
                    consecutiveErrors++;

                    // Si fallamos 3 veces seguidas (ej: REQUEST_DENIED), pasamos a modo Offline completo
                    if (consecutiveErrors >= 3) {
                        console.error("🚫 API bloqueada o sin permisos. Cambiando a MODO OFFLINE (Líneas Rectas).");
                        OFFLINE_MODE = true;
                    }

                    resolve(calcularLineaRecta(origen, destino, key));
                }
            });
        };

        // Manejo de cola para rate limiting
        enqueueRequest(request);
    });
}

function calcularLineaRecta(origen, destino, key) {
    const p1 = new google.maps.LatLng(origen.lat, origen.lng);
    const p2 = new google.maps.LatLng(destino.lat, destino.lng);
    const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);

    const result = {
        path: [{ lat: origen.lat, lng: origen.lng }, { lat: destino.lat, lng: destino.lng }],
        distancia_m: dist,
        polyline_encoded: null // Null indica línea recta
    };
    RUTA_CACHE.set(key, result);
    return result;
}

// --- PASO 2: POSTES ELÉCTRICOS / INFRAESTRUCTURA ---

/**
 * Busca postes eléctricos o puntos de anclaje a lo largo de la ruta.
 * Utiliza NearbySearch de PlacesService.
 */
async function obtenerPostesEnRuta(polylinePoints) {
    const postes = [];
    const service = new google.maps.places.PlacesService(document.createElement('div'));

    // Muestreo: cada ~10 puntos para no saturar la API
    for (let i = 0; i < polylinePoints.length; i += 10) {
        const point = polylinePoints[i];

        await new Promise((resolve) => {
            service.nearbySearch({
                location: point,
                radius: 30,
                keyword: 'poste electrico'
            }, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    results.slice(0, 1).forEach(place => {
                        postes.push({
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                            place_id: place.place_id,
                            nombre: place.name
                        });
                    });
                }
                setTimeout(resolve, 100); // Pequeño delay entre búsquedas de postes
            });
        });
    }
    return postes;
}

// --- PASO 3: TRAZADO VISUAL COMBINADO ---

let activePolylines = [];
let activeMarkers = [];

function dibujarFibraEnMapa(map, ruta, postes, nap, p_recibida) {
    const estado = p_recibida > FIBRA_CONFIG.SENSIBILIDAD_RX ? 'OK' :
        p_recibida > FIBRA_CONFIG.SENSIBILIDAD_RX - 2 ? 'WARNING' : 'ERROR';

    const colors = {
        'OK': '#00FF88',
        'WARNING': '#FFA500',
        'ERROR': '#FF3333'
    };

    // 1. Dibujar Polyline
    const lineSymbol = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 3,
        strokeColor: '#FFF',
        fillOpacity: 1
    };

    const fiberPoly = new google.maps.Polyline({
        path: ruta.path,
        geodesic: true,
        strokeColor: colors[estado],
        strokeOpacity: 0.85,
        strokeWeight: 3,
        icons: [{
            icon: lineSymbol,
            offset: '100%',
            repeat: '200px'
        }],
        map: map
    });

    // Animación de flechas
    let count = 0;
    setInterval(() => {
        count = (count + 1) % 200;
        const icons = fiberPoly.get('icons');
        icons[0].offset = (count / 2) + '%';
        fiberPoly.set('icons', icons);
    }, 50);

    activePolylines.push(fiberPoly);

    // 2. Dibujar Postes (Iconos SVG realistas)
    const poleIcon = {
        path: 'M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z', // Simple utility pole SVG path
        fillColor: '#475569',
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: '#FFFFFF',
        scale: 1,
        anchor: new google.maps.Point(12, 12)
    };

    postes.forEach(p => {
        const marker = new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            icon: poleIcon,
            zIndex: 1,
            map: map,
            title: 'Poste de anclaje (Verificado por Google Places)'
        });

        const info = new google.maps.InfoWindow({
            content: `
                <div style="font-family: 'Inter', sans-serif; padding: 8px;">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">Poste de Anclaje</div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Verified by Google Places</div>
                    <div style="font-size: 10px; color: #94a3b8;">
                        LAT: ${p.lat.toFixed(6)}<br>
                        LNG: ${p.lng.toFixed(6)}
                    </div>
                </div>
            `
        });

        marker.addListener('click', () => info.open(map, marker));
        activeMarkers.push(marker);
    });

    // 3. Etiqueta Interactiva (Hover)
    const midIndex = Math.floor(ruta.path.length / 2);
    const midPoint = ruta.path[midIndex];

    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="font-family: 'Inter', sans-serif; padding: 4px; text-align: center;">
                <div style="font-weight: 600; color: #1e293b; font-size: 12px;">Tramo de Fibra</div>
                <div style="font-size: 11px; color: #64748b;">
                    ${ruta.distancia_m} metros<br>
                    <strong>Rx: ${p_recibida.toFixed(2)} dBm</strong>
                </div>
            </div>
        `,
        disableAutoPan: true
    });

    // Eventos para mostrar etiqueta al pasar el mouse
    fiberPoly.addListener('mouseover', (e) => {
        fiberPoly.setOptions({ strokeOpacity: 1, strokeWeight: 5 });
        infoWindow.setPosition(e.latLng || midPoint);
        infoWindow.open(map);
    });

    fiberPoly.addListener('mouseout', () => {
        fiberPoly.setOptions({ strokeOpacity: 0.85, strokeWeight: 3 });
        infoWindow.close();
    });

    // Fallback: Si es línea recta (sin polyline encoded), la hacemos punteada para diferenciar
    if (!ruta.polyline_encoded) {
        fiberPoly.setOptions({
            icons: [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                offset: '0',
                repeat: '10px'
            }],
            strokeOpacity: 0
        });
    }

    activeMarkers.push({ setMap: () => infoWindow.close() }); // Duck typing para limpieza
}

// --- PASO 4: MST CON RUTAS REALES ---

async function calcularMSTConRutas(map, olt, naps) {
    console.log("Calculando MST con distancias reales...");

    // Limpiar previo
    limpiarDespliegueFibra();

    const nodos = [olt, ...naps];
    const aristas = [];

    // 1. Obtener todas las posibles rutas reales entre nodos
    for (let i = 0; i < nodos.length; i++) {
        for (let j = i + 1; j < nodos.length; j++) {
            try {
                const ruta = await obtenerRutaFibra(nodos[i], nodos[j]);
                aristas.push({
                    u: i,
                    v: j,
                    peso: ruta.distancia_m,
                    ruta: ruta
                });
            } catch (err) {
                console.warn(`No se pudo trazar ruta entre ${i} y ${j}`);
            }
        }
    }

    // 2. Algoritmo de Kruskal
    aristas.sort((a, b) => a.peso - b.peso);
    const parent = Array.from({ length: nodos.length }, (_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (i, j) => {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    const finalEdges = [];
    let totalFibra = 0;

    for (const edge of aristas) {
        if (find(edge.u) !== find(edge.v)) {
            union(edge.u, edge.v);
            finalEdges.push(edge);
            totalFibra += edge.peso;

            // Dibujar cada tramo
            // Cálculo simplificado de potencia para visualización inicial
            const p_loss = (edge.peso / 1000) * FIBRA_CONFIG.ALPHA + FIBRA_CONFIG.PERDIDA_CONECTOR + FIBRA_CONFIG.MARGEN_SEGURIDAD;
            const p_rec = FIBRA_CONFIG.P_TX - p_loss - (nodos[edge.v].tipo === '48' ? FIBRA_CONFIG.SPLITTER_NAP48 : FIBRA_CONFIG.SPLITTER_NAP16);

            // Buscar postes síncronamente (opcionalmente)
            const postes = await obtenerPostesEnRuta(edge.ruta.path);
            dibujarFibraEnMapa(map, edge.ruta, postes, nodos[edge.v], p_rec);
        }
    }

    console.log(`MST Completado. Fibra total: ${totalFibra}m`);
    return {
        total_m: totalFibra,
        total_km: (totalFibra / 1000).toFixed(2),
        costo_est: (totalFibra * 2.5).toFixed(2) // Asumiendo $2.5 el metro tendido
    };
}

// --- UTILIDADES ---

function limpiarDespliegueFibra() {
    activePolylines.forEach(p => p.setMap(null));
    activeMarkers.forEach(m => m.setMap(null));
    activePolylines = [];
    activeMarkers = [];
}

function enqueueRequest(fn) {
    RUTA_QUEUE.push(fn);
    if (!isProcessingQueue) processQueue();
}

async function processQueue() {
    isProcessingQueue = true;
    while (RUTA_QUEUE.length > 0) {
        const fn = RUTA_QUEUE.shift();
        fn();
        await new Promise(r => setTimeout(r, FIBRA_CONFIG.MS_BETWEEN_REQUESTS));
    }
    isProcessingQueue = false;
}

const createMapLegend = (map) => {
    const legendDiv = document.createElement('div');
    legendDiv.style.margin = '10px';
    legendDiv.style.padding = '12px';
    legendDiv.style.background = 'rgba(255, 255, 255, 0.8)';
    legendDiv.style.backdropFilter = 'blur(10px)';
    legendDiv.style.borderRadius = '12px';
    legendDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
    legendDiv.style.border = '1px solid rgba(255,255,255,0.3)';
    legendDiv.style.fontFamily = "'Inter', sans-serif";
    legendDiv.style.fontSize = '12px';
    legendDiv.style.color = '#1e293b';
    legendDiv.style.zIndex = '1000';

    legendDiv.innerHTML = `
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">LEYENDA DE RED</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="http://maps.google.com/mapfiles/ms/icons/red-dot.png" width="16"> <strong>OLT</strong> (Centro de Datos)
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="http://maps.google.com/mapfiles/ms/icons/orange-dot.png" width="16"> <strong>NAP 16</strong> (Splitter 1:16)
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="http://maps.google.com/mapfiles/ms/icons/blue-dot.png" width="16"> <strong>NAP 48</strong> (Splitter 1:48)
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; clip-path: polygon(50% 0%, 0% 100%, 100% 100%); background: #475569;"></div> 
                <strong>Poste</strong> (Google Places)
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 3px; background: #00FF88;"></div> <strong>Fibra Real</strong> (Vía Calle)
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 1px; border-top: 2px dashed #00FF88;"></div> <strong>Fibra Fallback</strong> (Recta)
            </div>
        </div>
        <div style="margin-top: 8px; font-size: 9px; color: #94a3b8; font-style: italic;">
            *Pasa el mouse sobre el tramo para ver detalles técnicos.
        </div>
    `;

    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(legendDiv);
    return legendDiv;
};

const clearRouteCache = () => {
    RUTA_CACHE.clear();
    consecutiveErrors = 0;
    OFFLINE_MODE = false;
    console.log("🧹 Caché de rutas limpiada y modo Offline reseteado.");
};

// --- EXPORTAR ---
window.FibraDespliegue = {
    obtenerRutaFibra,
    obtenerPostesEnRuta,
    dibujarFibraEnMapa,
    calcularMSTConRutas,
    limpiarDespliegueFibra,
    clearRouteCache,
    createMapLegend,
    config: FIBRA_CONFIG
};
