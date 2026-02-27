
import os
import re

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'
backup_file = r'c:\Users\Admini\Desktop\avance 0602\script_corrupted_backup.js'

with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

# Save backup
with open(backup_file, 'w', encoding='utf-8') as f:
    f.writelines(lines)

clean_lines = []
seen_functions = set()

# Pattern for line number prefix like "L123: " or "123: "
line_num_pattern = re.compile(r'^(L?\d+:)\s*')

for line in lines:
    stripped = line.strip()
    
    # Skip lines that are obviously line number fragments from AI output
    if line_num_pattern.match(stripped):
        # Extract the actual content after the line number
        actual_content = line_num_pattern.sub('', stripped)
        if not actual_content:
            continue
        line = actual_content + "\n"
        stripped = actual_content

    # Detection of duplication/junk
    # If we see a second initAuthListener, we probably reached the junk zone
    if 'function initAuthListener' in line:
        if 'initAuthListener' in seen_functions:
            print(f"Stopping at duplicated function: {stripped}")
            break
        seen_functions.add('initAuthListener')

    # If we see a line that looks like corrupted interleaved code
    if 'AREHOUSES' in line and 'const ODOO' not in line:
         print(f"Skipping corrupted line: {stripped}")
         continue

    clean_lines.append(line)

# Ensure the last needed classes are there or added back
# I'll just keep the first 8000 clean lines for now as a baseline
if len(clean_lines) > 8200:
    print(f"Truncating suspicious length: {len(clean_lines)} -> 8100")
    clean_lines = clean_lines[:8100]

# Now, let's RE-ADD the clean NAP_Optimizer and PoleManager if they were caught in the truncate
# Actually, I'll just write the final known good block
final_classes = """
class NAP_Optimizer {
    constructor(clients, capacity = 16) {
        this.clients = clients || [];
        this.capacity = capacity;
    }

    clusterClients() {
        if (this.clients.length === 0) return [];
        const clusters = [];
        const unassigned = [...this.clients];
        while (unassigned.length > 0) {
            const seed = unassigned.shift();
            const currentCluster = [seed];
            for (let i = 0; i < unassigned.length; i++) {
                if (currentCluster.length >= this.capacity) break;
                const d = OLT_Optimizer.getDistanceKm(seed.lat, seed.lng, unassigned[i].lat, unassigned[i].lng);
                if (d <= 0.15) {
                    currentCluster.push(unassigned[i]);
                    unassigned.splice(i, 1);
                    i--;
                }
            }
            let sumLat = 0, sumLng = 0;
            currentCluster.forEach(cl => { sumLat += cl.lat; sumLng += cl.lng; });
            const fLat = sumLat / currentCluster.length;
            const fLng = sumLng / currentCluster.length;
            clusters.push({
                lat: fLat,
                lng: fLng,
                clients: currentCluster,
                clientCount: currentCluster.length
            });
        }
        return clusters;
    }

    clusterKMeans(k) {
        if (this.clients.length === 0 || k <= 0) return [];
        if (k >= this.clients.length) {
            return this.clients.map(c => ({ lat: c.lat, lng: c.lng, clients: [c], clientCount: 1 }));
        }
        let centroids = [];
        const indices = new Set();
        while (indices.size < k) { indices.add(Math.floor(Math.random() * this.clients.length)); }
        indices.forEach(i => centroids.push({ ...this.clients[i] }));
        let assignments = new Array(this.clients.length).fill(-1);
        let changed = true;
        let iterations = 0;
        while (changed && iterations < 20) {
            changed = false;
            const newClusters = Array(k).fill(null).map(() => []);
            this.clients.forEach((client, idx) => {
                let minDist = Infinity;
                let bestK = 0;
                centroids.forEach((c, cIdx) => {
                    const d = OLT_Optimizer.getDistanceKm(client.lat, client.lng, c.lat, c.lng);
                    if (d < minDist) { minDist = d; bestK = cIdx; }
                });
                if (assignments[idx] !== bestK) { assignments[idx] = bestK; changed = true; }
                newClusters[bestK].push(client);
            });
            if (changed) {
                centroids = centroids.map((c, cIdx) => {
                    const cluster = newClusters[cIdx];
                    if (cluster.length === 0) return c;
                    let sumL = 0, sumLn = 0;
                    cluster.forEach(cl => { sumL += cl.lat; sumLn += cl.lng; });
                    return { lat: sumL / cluster.length, lng: sumLn / cluster.length };
                });
            }
            iterations++;
        }
        return centroids.map((c, idx) => {
            const clusterClients = this.clients.filter((_, pid) => assignments[pid] === idx);
            return { lat: c.lat, lng: c.lng, clients: clusterClients, clientCount: clusterClients.length };
        });
    }
}

class PoleManager {
    constructor() { window.postes = window.postes || []; }
    async fetchPoles(lat, lng, radiusMeters) {
        console.log(`Searching infrastructure around ${lat}, ${lng}...`);
        const query = `[out:json][timeout:25];(node["man_made"="utility_pole"](around:${radiusMeters},${lat},${lng});node["power"="pole"](around:${radiusMeters},${lat},${lng});node["highway"="lighting"](around:${radiusMeters},${lat},${lng});node["telecom"="pole"](around:${radiusMeters},${lat},${lng});way["highway"](around:${radiusMeters},${lat},${lng}););out body;>;out skel qt;`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
            const data = await response.json();
            const realPoles = [];
            const ways = [];
            const nodes = {};
            data.elements.forEach(el => {
                if (el.type === 'node') {
                    nodes[el.id] = { lat: el.lat, lng: el.lon };
                    let type = null;
                    if (el.tags) {
                        if (el.tags.power === 'pole') type = 'electric';
                        else if (el.tags.man_made === 'utility_pole') type = 'utility';
                        else if (el.tags.highway === 'lighting') type = 'light';
                        else if (el.tags.telecom === 'pole') type = 'telecom';
                    }
                    if (type) realPoles.push({ id: el.id, lat: el.lat, lng: el.lon, type, source: 'osm' });
                } else if (el.type === 'way') { ways.push(el); }
            });
            const vPoles = this.generateVirtualPoles(ways, nodes);
            window.postes = [...realPoles, ...vPoles];
            return window.postes;
        } catch (err) { console.error("Overpass error:", err); return []; }
    }
    generateVirtualPoles(ways, nodes) {
        const v = [];
        ways.forEach(w => { if (w.nodes) { w.nodes.forEach(nId => { const n = nodes[nId]; if (n) v.push({ id: `v_${nId}`, lat: n.lat, lng: n.lng, type: 'virtual', source: 'way_node' }); }); } });
        return v;
    }
    snapToNearestPole(pos) {
        let best = { lat: pos.lat, lng: pos.lng, dist: Infinity, snappedId: null };
        window.postes.forEach(p => {
            const d = OLT_Optimizer.getDistanceKm(pos.lat, pos.lng, p.lat, p.lng) * 1000;
            if (d < best.dist && d < 100) { best = { ...p, dist: d, snappedId: p.id }; }
        });
        return best;
    }
}
"""

with open(target_file, 'w', encoding='utf-8') as f:
    f.writelines(clean_lines)
    f.write("\n\n" + final_classes + "\n")

print(f"Recovery complete. New file length: {len(clean_lines) + final_classes.count('\\n')} lines roughly.")
