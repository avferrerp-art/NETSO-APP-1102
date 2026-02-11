
// Mock of MATERIAL_RULES from products_data.js
const MATERIAL_RULES = {
    "Drop Flat/Tenzado 1 hilo (Bobina 1km)": { "unit": "Bobina", "qty_per_unit": 1000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "CABLE DE FIBRA PTICA 12 HILOS ADSS SPAN 100": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "LIBRE", "logic": "Fibra" },
    "Hebilla 1/2": { "unit": "Unidad", "qty_per_unit": 100.0, "rounding": "LIBRE", "logic": "Manual" }
};

// Copy of MaterialCalculator class from script.js
class MaterialCalculator {
    static calculate(itemName, quantityNeeded) {
        // 1. Obtener regla del catálogo
        const rule = (typeof MATERIAL_RULES !== 'undefined') ? MATERIAL_RULES[itemName] : null;

        if (!rule) {
            return {
                originalItem: itemName,
                originalQty: quantityNeeded,
                finalItem: itemName,
                finalQty: quantityNeeded,
                unit: 'u',
                note: 'Cálculo directo (Sin regla definida)'
            };
        }

        const qtyPerUnit = rule.qty_per_unit || 1;
        const unitName = rule.unit || 'u';
        const rounding = rule.rounding || 'LIBRE'; // 'ESTRICTO' o 'LIBRE'

        let finalQty = 0;
        let note = '';

        // 2. Lógica por Tipo de Unidad
        if (unitName.toLowerCase().includes('bobina') || unitName.toLowerCase().includes('rollo')) {
            // CASO: CABLE / BOBINAS
            const packsNeeded = quantityNeeded / qtyPerUnit;

            if (rounding === 'ESTRICTO') {
                // Forzar entero superior
                const packsInt = Math.ceil(packsNeeded);
                finalQty = packsInt;
                note = `Redondeado a ${packsInt} ${unitName}(s) de ${qtyPerUnit}m (Req: ${quantityNeeded}m)`;
            } else {
                // LIBRE: 2 decimales
                finalQty = parseFloat(packsNeeded.toFixed(2));
                note = `Equivalente a ${finalQty} ${unitName}(s) (Req: ${quantityNeeded}m)`;
            }

        } else {
            // CASO: UNIDADES DISCRETAS
            if (rounding === 'ESTRICTO' || (qtyPerUnit > 1)) {
                const packsNeeded = quantityNeeded / qtyPerUnit;
                finalQty = Math.ceil(packsNeeded);
                note = `Pack de ${qtyPerUnit} u. (Req: ${quantityNeeded})`;
            } else {
                finalQty = Math.ceil(quantityNeeded);
                note = '';
            }
        }

        return {
            originalItem: itemName,
            originalQty: quantityNeeded,
            finalItem: itemName,
            finalQty: finalQty,
            unit: unitName,
            note: note,
            ruleApplied: rule
        };
    }
}

// TEST CASES
console.log("--- TEST INICIO ---");

// Test 1: Drop Cable (Strict Rounding)
const t1 = MaterialCalculator.calculate("Drop Flat/Tenzado 1 hilo (Bobina 1km)", 1500);
console.log("Test 1 (1500m Drop -> Bobinas):", t1.finalQty, t1.unit, "| Expected: 2 Bobina");
if (t1.finalQty === 2 && t1.unit === "Bobina") console.log("✅ PASS"); else console.log("❌ FAIL");

// Test 2: ADSS Cable (Free Rounding)
const t2 = MaterialCalculator.calculate("CABLE DE FIBRA PTICA 12 HILOS ADSS SPAN 100", 6000);
// 6000 / 4000 = 1.5
console.log("Test 2 (6000m ADSS -> Bobinas):", t2.finalQty, t2.unit, "| Expected: 1.5 Bobina");
if (t2.finalQty === 1.5) console.log("✅ PASS"); else console.log("❌ FAIL");

// Test 3: Hebillas (Free Rounding but QtyPerUnit > 1 implies pack logic usually, strictly speaking 'Unit' with '100' per unit)
// Rules says: rounding LIBRE.
// Logic says: if qtyPerUnit > 1, use Pack logic?
// script.js logoc: if (rounding === 'ESTRICTO' || (qtyPerUnit > 1)) -> Math.ceil.
// So 150 hebillas / 100 = 1.5 packs -> ceil -> 2 packs.
const t3 = MaterialCalculator.calculate("Hebilla 1/2", 150);
console.log("Test 3 (150 Hebillas -> Packs of 100):", t3.finalQty, t3.unit, "| Expected: 2 Unidad");
if (t3.finalQty === 2) console.log("✅ PASS"); else console.log("❌ FAIL");

console.log("--- TEST FIN ---");
