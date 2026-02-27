import re
import os

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the definition of calcLineStringLen and move it UP, or just redefine it
# Let's find PASO 5
paso5_idx = content.find('// ─── PASO 5: Construir GeoJSON y dibujar')
if paso5_idx == -1:
    print("Could not find PASO 5")
    exit(1)

paso6_idx = content.find('// ─── PASO 6: Calcular métricas reales para el presupuesto')

# Replacement part for the features map
old_features_code = """    const features = mstEdges.map((e, i) => ({

        type: 'Feature',

        properties: { type: edgeType(e.fromIdx) },

        geometry: { type: 'LineString', coordinates: routeCoords[i] }

    }));"""

new_features_code = """    // Helper: calcular longitud real de un Feature/LineString (arreglo de [lng, lat])
    const calcLineStringLen = (coords) => {
        let len = 0;
        if (!coords || coords.length < 2) return 0;
        for (let j = 0; j < coords.length - 1; j++) {
            len += haversineM({ lng: coords[j][0], lat: coords[j][1] }, { lng: coords[j + 1][0], lat: coords[j + 1][1] });
        }
        return len;
    };

    const features = mstEdges.map((e, i) => {
        const dist = calcLineStringLen(routeCoords[i]);
        return {
            type: 'Feature',
            properties: { 
                type: edgeType(e.fromIdx),
                distance: dist,
                formattedDistance: dist > 1000 ? (dist/1000).toFixed(2) + ' km' : Math.round(dist) + ' m'
            },
            geometry: { type: 'LineString', coordinates: routeCoords[i] }
        };
    });"""

content = content.replace(old_features_code, new_features_code)

# Now we need to add the click events after adding layers
old_layer_code = """        map.addLayer({

            id: 'network-lines-dist', type: 'line', source: 'network-lines',

            filter: ['==', ['get', 'type'], 'dist'],

            layout: { 'line-join': 'round', 'line-cap': 'round' },

            paint: { 'line-color': '#22c55e', 'line-width': 2.2, 'line-dasharray': [4, 2], 'line-opacity': 0.9 }

        });

    }"""

new_layer_events = """
        // Interacciones de click para mostrar distancia de la fibra
        const layersToInteract = ['network-lines-trunk', 'network-lines-dist'];
        
        layersToInteract.forEach(layerId => {
            // Click
            map.on('click', layerId, (e) => {
                if (!e.features.length) return;
                const feature = e.features[0];
                const distStr = feature.properties.formattedDistance;
                const isTrunk = feature.properties.type === 'trunk';
                
                new maplibregl.Popup({ closeButton: false })
                    .setLngLat(e.lngLat)
                    .setHTML(`<div style="padding: 5px; font-family: sans-serif;">
                        <span style="font-weight: bold; color: ${isTrunk ? '#2563eb' : '#22c55e'};">
                            Fibra ${isTrunk ? 'Troncal' : 'Distribución'}
                        </span><br>
                        Distancia: <b>${distStr}</b>
                    </div>`)
                    .addTo(map);
            });
            
            // Hover (cambiar cursor)
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        });
"""

if old_layer_code in content:
    content = content.replace(old_layer_code, old_layer_code + new_layer_events)
else:
    print("Could not find layer code to inject events")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected distances and events.")
