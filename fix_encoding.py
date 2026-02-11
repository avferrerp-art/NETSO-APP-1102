
try:
    with open('script.js', 'rb') as f:
        content = f.read()
    
    # Strip null bytes (typical artifact of UTF-16 interpreted as ASCII)
    fixed_content = content.replace(b'\x00', b'')

    with open('script.js', 'wb') as f:
        f.write(fixed_content)
    
    print("FIXED: Removed null bytes.")
except Exception as e:
    print(f"ERROR: {e}")
