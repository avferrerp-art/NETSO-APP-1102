def check_balance(filename):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    braces = 0
    parens = 0
    brackets = 0
    in_string = None
    in_comment = False
    
    i = 0
    while i < len(content):
        c = content[i]
        next_c = content[i+1] if i+1 < len(content) else None
        
        if not in_string and not in_comment:
            if c == '/' and next_c == '/':
                in_comment = 'line'
                i += 1
            elif c == '/' and next_c == '*':
                in_comment = 'block'
                i += 1
            elif c in ['"', "'", '`']:
                in_string = c
            elif c == '{': braces += 1
            elif c == '}': braces -= 1
            elif c == '(': parens += 1
            elif c == ')': parens -= 1
            elif c == '[': brackets += 1
            elif c == ']': brackets -= 1
        elif in_comment == 'line':
            if c == '\n': in_comment = False
        elif in_comment == 'block':
            if c == '*' and next_c == '/':
                in_comment = False
                i += 1
        elif in_string:
            if c == in_string and content[i-1] != '\\':
                in_string = False
        
        i += 1
        
    print(f"Braces: {braces}, Parens: {parens}, Brackets: {brackets}")
    if braces != 0 or parens != 0 or brackets != 0:
        print("Mismatched!")

if __name__ == "__main__":
    import sys
    check_balance(sys.argv[1])
