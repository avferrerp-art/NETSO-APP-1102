import js2py
import sys

def check_syntax(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    try:
        js2py.parse_js(content)
        print("Syntax is OK")
    except Exception as e:
        print(f"Syntax Error: {e}")

if __name__ == "__main__":
    check_syntax(sys.argv[1])
