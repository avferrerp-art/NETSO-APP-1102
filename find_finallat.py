
import os

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f, 1):
        if 'finalLat' in line:
            print(f"Line {i}: {line.strip()}")
