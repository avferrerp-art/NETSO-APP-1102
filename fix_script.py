
import os

file_path = r"c:\Users\Admini\Desktop\avance 0602\script.js"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "class FiberRouteCalculator {" in line:
        # Go back to find the comment header
        # The header is 3 lines above usually
        # // ============================================
        # // FIBER OPTIC ROUTE CALCULATOR
        # // ============================================
        start_idx = i - 3
    
    if "const initialC = this.calculateInitialCentroid();" in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    print(f"Removing lines {start_idx+1} to {end_idx} (non-inclusive of end)")
    
    # We want to keep the line at end_idx, but insert the missing comment there
    # The original code had:
    # // --- Score Costo (30%) - Simulado sin datos reales de backhaul ---
    # const initialC = ...
    
    # So we replace the block with just that comment properly indented
    indent = "        " # 8 spaces
    replacement = [
        f"{indent}// --- Score Costo (30%) - Simulado sin datos reales de backhaul ---\n",
        f"{indent}// Asumimos que más cerca del centroide original es más barato (infraestructura urbana)\n"
    ]
    
    new_lines = lines[:start_idx] + replacement + lines[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully removed nested class and restored comment.")
else:
    print("Could not find the block to remove.")
    print(f"Start: {start_idx}, End: {end_idx}")
