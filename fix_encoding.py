
import os

filename = 'script.js'
temp_olt = 'temp_olt.js'
temp_arch = 'temp_arch.js'

try:
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    # Find where the garbage starts
    # We know it started after `dismissSuggestion` function
    cutoff_index = -1
    for i, line in enumerate(lines):
        if 'function dismissSuggestion(elementId)' in line:
            # The function is about 8 lines long
            # Let's search for the closing brace '}' after this line
            for j in range(i, min(i + 20, len(lines))):
                if lines[j].strip() == '}':
                    cutoff_index = j + 1
                    break
            break
    
    if cutoff_index != -1:
        print(f"Trimming script.js at line {cutoff_index}")
        clean_lines = lines[:cutoff_index]
    else:
        print("Could not find cut-off point. Aborting to avoid damage.")
        exit(1)

    # Write clean content
    with open(filename, 'w', encoding='utf-8') as f:
        f.writelines(clean_lines)
        f.write('\n\n')

        # Read and append OLT logic
        if os.path.exists(temp_olt):
             with open(temp_olt, 'r', encoding='utf-8', errors='ignore') as t1:
                f.write(t1.read())
                f.write('\n\n')
        
        # Read and append Arch logic
        if os.path.exists(temp_arch):
             with open(temp_arch, 'r', encoding='utf-8', errors='ignore') as t2:
                f.write(t2.read())
                f.write('\n\n')
                
    print("Successfully fixed script.js and appended logic.")

except Exception as e:
    print(f"Error: {e}")
