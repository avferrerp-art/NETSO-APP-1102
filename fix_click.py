import re

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# The target block of code that we placed OUTSIDE the else block
target_block = """    }
        // Interacciones de click para mostrar distancia de la fibra
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
            });
            
            // Hover (cambiar cursor)
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        });"""

# Replacement: move the closing brace to the END of this block
new_block = """        // Interacciones de click para mostrar distancia de la fibra
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
            });
            
            // Hover (cambiar cursor)
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        });
    }"""

if target_block in content:
    content = content.replace(target_block, new_block)
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully moved event listeners inside else block.")
else:
    print("Could not find the target block to replace.")
