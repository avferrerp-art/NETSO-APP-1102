
// ==========================================
// OLT OPTIMIZER (Restored from test_olt_algo.js)
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
