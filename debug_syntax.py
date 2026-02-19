
import subprocess
import sys

try:
    result = subprocess.run(['node', '-c', 'script.js'], capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print("Syntax Error Found!")
        # Print only the first few lines of stderr which contain the error location
        lines = result.stderr.split('\n')
        for line in lines[:10]:
            print(line)
    else:
        print("Syntax OK")
except Exception as e:
    print("Error:", e)
