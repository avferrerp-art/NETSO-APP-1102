import math

# Mock of MATERIAL_RULES
MATERIAL_RULES = {
    "Drop Flat/Tenzado 1 hilo (Bobina 1km)": { "unit": "Bobina", "qty_per_unit": 1000.0, "rounding": "ESTRICTO", "logic": "Fibra" },
    "CABLE DE FIBRA PTICA 12 HILOS ADSS SPAN 100": { "unit": "Bobina", "qty_per_unit": 4000.0, "rounding": "LIBRE", "logic": "Fibra" },
    "Hebilla 1/2": { "unit": "Unidad", "qty_per_unit": 100.0, "rounding": "LIBRE", "logic": "Manual" }
}

class MaterialCalculator:
    @staticmethod
    def calculate(item_name, quantity_needed):
        rule = MATERIAL_RULES.get(item_name)

        if not rule:
            return {
                "finalQty": quantity_needed,
                "unit": 'u',
                "note": 'Cálculo directo'
            }

        qty_per_unit = rule.get("qty_per_unit", 1)
        unit_name = rule.get("unit", 'u')
        rounding = rule.get("rounding", 'LIBRE')

        final_qty = 0
        note = ''

        unit_lower = unit_name.lower()
        if 'bobina' in unit_lower or 'rollo' in unit_lower:
            packs_needed = quantity_needed / qty_per_unit
            
            if rounding == 'ESTRICTO':
                final_qty = math.ceil(packs_needed)
                note = f"Redondeado a {final_qty} {unit_name}(s)"
            else:
                # LIBRE: 2 decimals, simulates JS behavior
                final_qty = round(packs_needed + 0.0000001, 2) # small epsilon for float stability if needed
                # Actually JS toFixed(2) rounds half up/down depending on implementation but mostly standard.
                # Python round is banker's rounding, but for simple division it should be close enough.
                # Let's just use simple formatting or math.
                final_qty = float(f"{packs_needed:.2f}")
                note = f"Equivalente a {final_qty} {unit_name}(s)"
        else:
            # Discrete units
            if rounding == 'ESTRICTO' or qty_per_unit > 1:
                packs_needed = quantity_needed / qty_per_unit
                final_qty = math.ceil(packs_needed)
                note = f"Pack de {qty_per_unit} u."
            else:
                final_qty = math.ceil(quantity_needed)
                note = ''
        
        return {
            "finalQty": final_qty,
            "unit": unit_name
        }

print("--- TEST INICIO ---")

# Test 1
res1 = MaterialCalculator.calculate("Drop Flat/Tenzado 1 hilo (Bobina 1km)", 1500)
print(f"Test 1 (1500m Drop -> Bobinas): {res1['finalQty']} {res1['unit']} | Expected: 2 Bobina")

# Test 2
res2 = MaterialCalculator.calculate("CABLE DE FIBRA PTICA 12 HILOS ADSS SPAN 100", 6000)
print(f"Test 2 (6000m ADSS -> Bobinas): {res2['finalQty']} {res2['unit']} | Expected: 1.5 Bobina")

# Test 3
res3 = MaterialCalculator.calculate("Hebilla 1/2", 150)
print(f"Test 3 (150 Hebillas -> Packs 100): {res3['finalQty']} {res3['unit']} | Expected: 2 Unidad")

print("--- TEST FIN ---")
