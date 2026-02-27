import os

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The duplicate calcLineStringLen is around line 15022
# lines are 0-indexed, so 15022 is index 15021.
# Let's search for it in that area.

start_idx = -1
for i in range(15000, 15050):
    if i < len(lines) and 'const calcLineStringLen = (coords) => {' in lines[i]:
        start_idx = i
        break

if start_idx != -1:
    end_idx = -1
    for i in range(start_idx, start_idx + 30):
        if i < len(lines) and '};' in lines[i]:
            end_idx = i
            break
            
    if end_idx != -1:
        print(f"Removing lines from {start_idx+1} to {end_idx+1}")
        # remove the helper comment too
        if 'Helper: calcular longitud real' in lines[start_idx-2]:
            lines[start_idx-2] = "\n"
        
        for i in range(start_idx, end_idx + 1):
            lines[i] = "\n"
            
        with open(target_file, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Duplicate removed.")
    else:
        print("Could not find end of duplicate function.")
else:
    print("Could not find duplicate function.")
