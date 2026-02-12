import re

def check_syntax(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    errors = []

    for i, line in enumerate(lines):
        line_num = i + 1
        # Strip comments (naive, assumes // is not in string)
        code_part = line.split('//')[0]
        for char in code_part:
            if char in '{[(':
                stack.append((char, line_num))
            elif char in '}])':
                if not stack:
                    errors.append(f"Unmatched '{char}' at line {line_num}")
                else:
                    last, last_line = stack.pop()
                    if (last == '{' and char != '}') or \
                       (last == '[' and char != ']') or \
                       (last == '(' and char != ')'):
                        errors.append(f"Mismatched '{last}' (line {last_line}) with '{char}' at line {line_num}")

    if stack:
        for char, line_num in stack:
            errors.append(f"Unclosed '{char}' starting at line {line_num}")

    if errors:
        print("Syntax Errors Found:")
        for e in errors[:10]: # Validar primeros 10
            print(e)
    else:
        print("No obvious bracket mismatches found.")

check_syntax(r'c:\Users\Admini\Desktop\avance 0602\script.js')
