
import subprocess
import sys

try:
    result = subprocess.run(['node', '-c', 'script.js'], capture_output=True, text=True, shell=True)
    if result.returncode != 0:
        print("Syntax Error Detected:")
        print(result.stderr)
    else:
        print("No Syntax Errors Detected.")
except Exception as e:
    print(f"Error running node: {e}")
