import sys

def check_js_balance(filename):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    stack = []
    in_string = False
    string_char = None
    in_comment = False
    comment_type = None # 'single' or 'multi'
    
    line = 1
    col = 0
    
    errors = []
    
    i = 0
    while i < len(content):
        char = content[i]
        col += 1
        
        if not in_string and not in_comment:
            if char == '"' or char == "'" or char == "`":
                in_string = True
                string_char = char
            elif char == '/' and i + 1 < len(content):
                if content[i+1] == '/':
                    in_comment = True
                    comment_type = 'single'
                    i += 1
                elif content[i+1] == '*':
                    in_comment = True
                    comment_type = 'multi'
                    i += 1
            elif char in '({[':
                stack.append((char, line, col))
            elif char in ')}]':
                if not stack:
                    errors.append(f"Unexpected closing {char} at line {line}, col {col}")
                else:
                    top, t_line, t_col = stack.pop()
                    if (char == ')' and top != '(') or (char == '}' and top != '{') or (char == ']' and top != '['):
                        errors.append(f"Mismatched {char} at line {line}, col {col} (matches {top} at line {t_line})")
        
        elif in_string:
            if char == string_char:
                # Check for escape
                escaped = False
                j = i - 1
                while j >= 0 and content[j] == '\\':
                    escaped = not escaped
                    j -= 1
                if not escaped:
                    in_string = False
        
        elif in_comment:
            if comment_type == 'single' and char == '\n':
                in_comment = False
            elif comment_type == 'multi' and char == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_comment = False
                i += 1
        
        if char == '\n':
            line += 1
            col = 0
        
        i += 1
        
    for char, l, c in stack:
        errors.append(f"Unclosed {char} from line {l}, col {c}")
    
    return errors

if __name__ == "__main__":
    errs = check_js_balance('script.js')
    if not errs:
        print("Balanced!")
    else:
        for e in errs:
            print(e)
