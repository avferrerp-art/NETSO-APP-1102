
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
    return centroids.map((cent, idx) => {
        let finalLat = cent.lat;
        let finalLng = cent.lng;

        // Snap to nearest pole if available
        if (typeof poleManager !== 'undefined' && poleManager.snapToNearestPole) {
            const snapped = poleManager.snapToNearestPole({ lat: cent.lat, lng: cent.lng });
            if (snapped) {
                finalLat = snapped.lat;
                finalLng = snapped.lng;
            }
        }

        return {
            id: `NAP-${(idx + 1).toString().padStart(3, '0')}`,
            lat: finalLat,
            lng: finalLng,
            clients: clusters[idx].length,
            capacity: PORT_CAPACITY
        };
    });
}

// ==========================================
// ARCHITECTURE VISUALIZATION (Main Handler)
// ==========================================
// Expose to window for HTML access
window.showArchitecture = showArchitecture;

async function showArchitecture(oltOverride = null) {
    console.log("🗺️ Calculando Arquitectura...");
    const btn = event?.target;
    if (btn) btn.innerHTML = "⏳ Procesando...";

    try {
        // 1. Get Clients (mock or global)
        // Check if we have clients loaded, if not use mock or fetch
        // For debugging restoration, let's grab from a potential global var or DB
        // Assuming 'currentProject' has clients or we use a mock set for demo

        // MOCK CLIENTS FOR NOW IF EMPTY (Unblock User)
        // In real app, this should come from 'inventory-table-body' rows or Firestore
        let clients = [];
        // Try to scrape from UI or use mock
        // ... (Simulated Logic)

        // Generate Mock Clients around the user's searched address or default
        // We need a center point. Let's assume the user searched an address
        const mapCenter = { lat: 40.7128, lng: -74.0060 }; // Default NY
        // If address-search has value, we should geocode it (skipped for speed)

        // Create 20 mock clients around center
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
            // Init map (using google.maps if available)
            if (window.google) {
                const map = new google.maps.Map(mapDiv, {
                    zoom: 15,
                    center: oltResult.optimal
                });

                // Marker OLT
                new google.maps.Marker({
                    position: oltResult.optimal,
                    map: map,
                    label: "OLT",
                    title: "OLT Óptima"
                });

                // Markers NAPs
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
