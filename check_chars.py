
import os

target_file = r'c:\Users\Admini\Desktop\avance 0602\script.js'

with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
print("--- FIRST 50 LINES ---")
for i in range(50):
    if i < len(lines):
        print(f"L{i+1}: {lines[i].strip()}")

print("--- LINES 8100-8150 ---")
for i in range(8100, 8150):
    idx = i - 1
    if idx < len(lines):
        print(f"L{i}: {lines[idx].strip()}")
