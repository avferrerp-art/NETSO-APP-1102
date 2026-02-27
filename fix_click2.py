target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# The bug: when clicking a new segment, this sequence happens:
#   1. hoveredStateId = feature.id  (new ID)
#   2. setFeatureState(new ID, selected: true)
#   3. currentPopup.remove()  <-- fires close event synchronously
#      close event: setFeatureState(hoveredStateId=NEW ID, selected: false), hoveredStateId=null
# Result: the new segment gets immediately deselected.
#
# Fix: save the old ID to a temp variable, update hoveredStateId AFTER removing old popup,
#      and ensure close handler only runs cleanup for its OWN segment.

old_click_handler = """            // Click
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

new_click_handler = """            // Click
            map.on('click', layerId, (e) => {
                if (!e.features.length) return;
                const feature = e.features[0];
                const newId = feature.id;

                // Deselect old segment first
                if (hoveredStateId !== null) {
                    map.setFeatureState({ source: 'network-lines', id: hoveredStateId }, { selected: false });
                }
                
                // Remove old popup without triggering our cleanup (set to null first)
                if (currentPopup) {
                    const oldPopup = currentPopup;
                    currentPopup = null;
                    oldPopup.remove();
                }

                // Select new segment
                hoveredStateId = newId;
                map.setFeatureState({ source: 'network-lines', id: hoveredStateId }, { selected: true });

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
                    // Only cleanup if this popup is still the active one
                    if (currentPopup !== null && hoveredStateId !== null) {
                        map.setFeatureState({ source: 'network-lines', id: hoveredStateId }, { selected: false });
                        hoveredStateId = null;
                        currentPopup = null;
                    }
                });
            });"""

if old_click_handler in content:
    content = content.replace(old_click_handler, new_click_handler)
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed click handler race condition.")
else:
    print("Could not find click handler to fix.")
