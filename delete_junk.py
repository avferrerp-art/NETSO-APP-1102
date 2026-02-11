def delete_lines(filename, lines_to_delete):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    # lines_to_delete should be 1-indexed
    indices_to_delete = set(l - 1 for l in lines_to_delete)
    
    new_lines = [line for i, line in enumerate(lines) if i not in indices_to_delete]
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

# Lines to delete (1-indexed based on Step 241, 251, 243):
# generateId #1: 413, 414, 415
# generateId #2: 1455, 1456, 1457
# Tail junk: 3662, 3663, 3664, 3665, 3666, 3667, 3668, 3669, 3670, 3671, 3672
lines_to_del = [413, 414, 415, 1455, 1456, 1457]
lines_to_del += list(range(3662, 3673))

if __name__ == "__main__":
    delete_lines('script.js', lines_to_del)
