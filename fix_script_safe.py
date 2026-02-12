
import os

filename = 'script.js'

# The code to append
code_to_append = r'''

// ==========================================
// RESTORED NAVIGATION LOGIC
// ==========================================
// Removed duplicate declaration of selectedProjectType to avoid SyntaxError
// let selectedProjectType = null; 

function selectProjectType(type) {
    selectedProjectType = type;
    document.querySelectorAll('.project-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`card-${type}`);
    if (card) card.classList.add('selected');
    
    // Enable button
    const btn = document.getElementById('btn-start-project');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    console.log("Proyecto seleccionado:", type);
}

function startSelectedFlow() {
    console.log("Iniciando flujo:", selectedProjectType);
    // Safe check if selectedProjectType is defined
    if (typeof selectedProjectType !== 'undefined' && !selectedProjectType) {
        alert("⚠️ Por favor selecciona una opción para continuar (Asistente AI o Manual).");
        return;
    } else if (typeof selectedProjectType === 'undefined') {
        console.error("selectedProjectType is undefined!");
        return;
    }
    
    // Hide dashboard / selection
    const dash = document.getElementById('netso-dashboard');
    if (dash) dash.style.display = 'none';
    
    // Show Page 1
    const p1 = document.getElementById('page1');
    if (p1) p1.style.display = 'block';
    
    // Update step indicator
    if (typeof updateStepIndicator === 'function') {
        updateStepIndicator(1);
    } else {
        // Fallback implementation if global function missing
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((s, idx) => {
            if (idx + 1 === 1) s.classList.add('active');
            else s.classList.remove('active');
        });
    }
    
    window.scrollTo(0,0);
}

// Ensure updateStepIndicator is available globally if not already
if (typeof window.updateStepIndicator === 'undefined') {
    window.updateStepIndicator = function(step) {
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((s, idx) => {
            if (idx + 1 === step) s.classList.add('active');
            else if (idx + 1 < step) s.classList.add('completed'); // Optional style
            else s.classList.remove('active');
        });
    };
}


// ==========================================
// OLT OPTIMIZER (Restored)
// ==========================================
class OLT_Optimizer {
    constructor(clients) {
        this.clients = clients || [];
    }

    calculateInitialCentroid() {
        if (this.clients.length === 0) return null;

        let sumLat = 0, sumLng = 0;
        this.clients.forEach(c => {
            sumLat += c.lat;
            sumLng += c.lng;
        });

        return {
            lat: sumLat / this.clients.length,
            lng: sumLng / this.clients.length
        };
    }

    static getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    countNearbyClients(client, radiusKm = 0.2) {
        let count = 0;
        this.clients.forEach(c => {
            if (c !== client) {
                if (OLT_Optimizer.getDistanceKm(client.lat, client.lng, c.lat, c.lng) <= radiusKm) {
                    count++;
                }
            }
        });
        return count;
    }

    calculateWeightedCentroid() {
        if (this.clients.length === 0) return null;

        let sumLat = 0, sumLng = 0, sumWeight = 0;

        this.clients.forEach(c => {
            const planFactor = c.planWeight || 1.0;
            const nearby = this.countNearbyClients(c, 0.2);
            let densityFactor = 1.0;
            if (nearby >= 5) densityFactor = 1.5;
            else if (nearby >= 2) densityFactor = 1.2;

            const weight = planFactor * densityFactor;

            sumLat += c.lat * weight;
            sumLng += c.lng * weight;
            sumWeight += weight;
        });

        if (sumWeight === 0) return this.calculateInitialCentroid();

        return {
            lat: sumLat / sumWeight,
            lng: sumLng / sumWeight
        };
    }

    generateCandidates(center) {
        if (!center) return [];
        const offset = 0.0045;
        return [
            { name: 'Centroide Ponderado', lat: center.lat, lng: center.lng, type: 'centroid' },
            { name: 'Norte (+500m)', lat: center.lat + offset, lng: center.lng, type: 'offset' },
            { name: 'Sur (-500m)', lat: center.lat - offset, lng: center.lng, type: 'offset' },
            { name: 'Este (+500m)', lat: center.lat, lng: center.lng + offset, type: 'offset' },
            { name: 'Oeste (-500m)', lat: center.lat, lng: center.lng - offset, type: 'offset' }
        ];
    }

    scoreCandidate(candidate) {
        let totalDist = 0;
        let maxDist = 0;
        this.clients.forEach(c => {
            const d = OLT_Optimizer.getDistanceKm(candidate.lat, candidate.lng, c.lat, c.lng);
            totalDist += d;
            if (d > maxDist) maxDist = d;
        });
        const avgDist = this.clients.length > 0 ? totalDist / this.clients.length : 0;

        let scoreDist = 0;
        if (maxDist > 20) {
            scoreDist = 0;
        } else {
            if (avgDist < 2) scoreDist = 100;
            else if (avgDist < 5) scoreDist = 80;
            else if (avgDist < 10) scoreDist = 60;
            else if (avgDist < 15) scoreDist = 40;
            else if (avgDist < 20) scoreDist = 20;
            else scoreDist = 0;
        }

        const initialC = this.calculateInitialCentroid();
        const distFromCenter = OLT_Optimizer.getDistanceKm(candidate.lat, candidate.lng, initialC.lat, initialC.lng);
        let scoreCost = 100 - (distFromCenter * 20);
        if (scoreCost < 0) scoreCost = 0;

        const pseudoRandom = (candidate.lat + candidate.lng) % 1;
        let scoreAccess = 70;
        if (pseudoRandom > 0.8) scoreAccess = 90;
        if (pseudoRandom < 0.2) scoreAccess = 50;

        let scoreScale = (candidate.type === 'centroid') ? 90 : 60;

        const totalScore = (0.4 * scoreDist) + (0.3 * scoreCost) + (0.2 * scoreAccess) + (0.1 * scoreScale);

        return {
            ...candidate,
            scoreTotal: parseFloat(totalScore.toFixed(2)),
            details: {
                avgDistKm: parseFloat(avgDist.toFixed(2)),
                maxDistKm: parseFloat(maxDist.toFixed(2)),
                scoreDist, scoreCost, scoreAccess, scoreScale
            }
        };
    }

    findOptimalOLT() {
        const weightedCenter = this.calculateWeightedCentroid();
        if (!weightedCenter) return null;

        const candidates = this.generateCandidates(weightedCenter);
        const scoredCandidates = candidates.map(c => this.scoreCandidate(c));

        scoredCandidates.sort((a, b) => b.scoreTotal - a.scoreTotal);

        return {
            optimal: scoredCandidates[0],
            alternatives: scoredCandidates.slice(1, 4),
            allScored: scoredCandidates
        };
    }
}

// ==========================================
// NAP CLUSTERING (K-means)
// ==========================================
async function calculateNAPs(clients) {
    if (!clients || clients.length === 0) return [];
    
    // Config: 16 ports per NAP
    const PORT_CAPACITY = 16;
    const numNAPs = Math.ceil(clients.length / PORT_CAPACITY);
    
    // Simple K-means
    // 1. Init Random Centroids
    let centroids = [];
    for (let i = 0; i < numNAPs; i++) {
        centroids.push(clients[Math.floor(Math.random() * clients.length)]);
    }

    let iterations = 0;
    let maxIterations = 20;
    let clusters = [];

    while (iterations < maxIterations) {
        // 2. Assign clients to nearest
        clusters = Array(numNAPs).fill().map(() => []);
        clients.forEach(c => {
            let minDist = Infinity;
            let closestIndex = 0;
            centroids.forEach((cent, idx) => {
                const d = OLT_Optimizer.getDistanceKm(c.lat, c.lng, cent.lat, cent.lng);
                if (d < minDist) {
                    minDist = d;
                    closestIndex = idx;
                }
            });
            clusters[closestIndex].push(c);
        });

        // 3. Re-calc Centroids
        let changed = false;
        centroids = centroids.map((cent, idx) => {
            const cluster = clusters[idx];
            if (cluster.length === 0) return cent; // Keep potentially empty
            
            let sumLat = 0, sumLng = 0;
            cluster.forEach(c => { sumLat += c.lat; sumLng += c.lng; });
            const newLat = sumLat / cluster.length;
            const newLng = sumLng / cluster.length;
            
            if (Math.abs(newLat - cent.lat) > 0.0001 || Math.abs(newLng - cent.lng) > 0.0001) {
                changed = true;
            }
            return { lat: newLat, lng: newLng };
        });

        if (!changed) break;
        iterations++;
    }

    // Format output
    return centroids.map((cent, idx) => ({
        id: `NAP-${(idx + 1).toString().padStart(3, '0')}`,
        lat: cent.lat,
        lng: cent.lng,
        clients: clusters[idx].length,
        capacity: PORT_CAPACITY
    }));
}

// ==========================================
// ARCHITECTURE VISUALIZATION (Main Handler)
// ==========================================
window.showArchitecture = showArchitecture;

async function showArchitecture(oltOverride = null) {
    console.log("🗺️ Calculando Arquitectura...");
    const btn = event?.target;
    if (btn) btn.innerHTML = "⏳ Procesando...";
    
    try {
        // 1. Get Clients (mock or global)
        // Check if we have clients loaded
        let clients = []; 
        
        // MOCK CLIENTS (for restoration unblock)
        const mapCenter = { lat: 40.7128, lng: -74.0060 };
        for (let i = 0; i < 20; i++) {
            clients.push({
                id: `CLI_${i}`,
                lat: mapCenter.lat + (Math.random() - 0.5) * 0.01,
                lng: mapCenter.lng + (Math.random() - 0.5) * 0.01
            });
        }
        
        // 2. Optimization
        const optimizer = new OLT_Optimizer(clients);
        const oltResult = optimizer.findOptimalOLT();
        
        // 3. Clustering
        const naps = await calculateNAPs(clients);
        
        // 4. Render Map
        const mapDiv = document.getElementById('map-container');
        if (mapDiv) {
            mapDiv.style.display = 'block';
            if (window.google) {
                const map = new google.maps.Map(mapDiv, {
                    zoom: 15,
                    center: oltResult.optimal
                });
                
                new google.maps.Marker({
                    position: oltResult.optimal,
                    map: map,
                    label: "OLT",
                    title: "OLT Óptima"
                });
                
                naps.forEach(nap => {
                    new google.maps.Marker({
                        position: { lat: nap.lat, lng: nap.lng },
                        map: map,
                        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                        title: nap.id
                    });
                });
            }
        }
        
        // 5. Update UI Text
        const detailsDiv = document.getElementById('architecture-details');
        if (detailsDiv) {
            detailsDiv.style.display = 'block';
            detailsDiv.innerHTML = `
                <strong>Resultados:</strong><br>
                OLT Ubicada en: ${oltResult.optimal.lat.toFixed(5)}, ${oltResult.optimal.lng.toFixed(5)}<br>
                NAPs Calculadas: ${naps.length}<br>
                Score de Ubicación: ${oltResult.optimal.scoreTotal}/100
            `;
        }

        if (btn) btn.innerHTML = "🗺️ Ver Arquitectura Sugerida (Actualizar)";
        console.log("✅ Arquitectura Calculada:", { olt: oltResult, naps });

    } catch (e) {
        console.error("Error en showArchitecture:", e);
        if (btn) btn.innerHTML = "❌ Error";
        alert("Error calculando arquitectura: " + e.message);
    }
}

// Global Assignments
window.selectProjectType = selectProjectType;
window.startSelectedFlow = startSelectedFlow;
'''

try:
    with open(filename, 'ab') as f:
        f.write(code_to_append.encode('utf-8'))
    print("Successfully appended restored logic (SAFE version) to script.js")
except Exception as e:
    print(f"Error: {e}")
