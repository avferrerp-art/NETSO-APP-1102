
import os

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'
clean_file = r'c:\Users\Admini\Desktop\avance 0602\script_clean.js'

with open(target_file, 'rb') as f:
    content = f.read()

# Remove NUL characters and other weirdness
clean_content = content.replace(b'\x00', b'')

with open(clean_file, 'wb') as f:
    f.write(clean_content)

print(f"Original size: {len(content)}")
print(f"Clean size: {len(clean_content)}")
print(f"Removed {len(content) - len(clean_content)} problematic bytes.")
