import re

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add id to GeoJSON features
old_feature_decl = """        return {
            type: 'Feature',
            properties: {"""

new_feature_decl = """        return {
            type: 'Feature',
            id: i,
            properties: {"""
content = content.replace(old_feature_decl, new_feature_decl)

# 2. Update TRONCAL layer paint
old_trunk_paint = "paint: { 'line-color': '#2563eb', 'line-width': 3.5, 'line-opacity': 0.95 }"
new_trunk_paint = """paint: { 
                'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#facc15', '#2563eb'],
                'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 5.0, 3.5],
                'line-opacity': 0.95 
            }"""
content = content.replace(old_trunk_paint, new_trunk_paint)

# 3. Update DIST layer paint
old_dist_paint = "paint: { 'line-color': '#22c55e', 'line-width': 2.2, 'line-dasharray': [4, 2], 'line-opacity': 0.9 }"
new_dist_paint = """paint: { 
                'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#facc15', '#22c55e'],
                'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 4.0, 2.2],
                'line-dasharray': [4, 2], 
                'line-opacity': 0.9 
            }"""
content = content.replace(old_dist_paint, new_dist_paint)

# 4. Update click events
old_click_events = """        // Interacciones de click para mostrar distancia de la fibra
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
            });"""

new_click_events = """        // Interacciones de click para mostrar distancia de la fibra
        const layersToInteract = ['network-lines-trunk', 'network-lines-dist'];
        
        let hoveredStateId = null;
        let currentPopup = null;

        layersToInteract.forEach(layerId => {
            // Click
            map.on('click', layerId, (e) => {
                if (!e.features.length) return;
                const feature = e.features[0];
                
                if (hoveredStateId !== null) {
                    map.setFeatureState({ source: 'network-lines', id: hoveredStateId }, { selected: false });
                }
                
                hoveredStateId = feature.id;
                map.setFeatureState({ source: 'network-lines', id: hoveredStateId }, { selected: true });
                
                if (currentPopup) currentPopup.remove();

                const distStr = feature.properties.formattedDistance;
                const isTrunk = feature.properties.type === 'trunk';
                
                currentPopup = new maplibregl.Popup({ closeButton: true })
                    .setLngLat(e.lngLat)
                    .setHTML(`<div style="padding: 5px; font-family: sans-serif;">
                        <span style="font-weight: bold; color: ${isTrunk ? '#2563eb' : '#22c55e'};">
                            Fibra ${isTrunk ? 'Troncal' : 'Distribución'}
                        </span><br>
                        Distancia: <b>${distStr}</b>
                    </div>`)
                    .addTo(map);
                    
                currentPopup.on('close', () => {
                    if (hoveredStateId !== null) {
                        map.setFeatureState({ source: 'network-lines', id: hoveredStateId }, { selected: false });
                        hoveredStateId = null;
                    }
                });
            });"""
            
if old_click_events in content:
    content = content.replace(old_click_events, new_click_events)
else:
    print("Could not find old click events block")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied highlight changes.")
