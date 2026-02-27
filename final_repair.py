
import re
import os

target = r'c:\Users\Admini\Desktop\avance 0602\script.js'
backup = r'c:\Users\Admini\Desktop\avance 0602\script_corrupted_backup.js'

# If backup doesn't exist for some reason, we use target (risky but we just made it)
if not os.path.exists(backup):
    backup = target

seen_init = False
clean_lines = []

with open(backup, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        # Only strip L123: type markers
        line = re.sub(r'^L\d+:\s*', '', line)
        if 'function initAuthListener' in line:
            if seen_init: break
            seen_init = True
        clean_lines.append(line)

# Now we write directly to script.js
with open(target, 'w', encoding='utf-8') as f:
    f.writelines(clean_lines)

print(f"Direct recovery of {target} complete. Lines written: {len(clean_lines)}")
