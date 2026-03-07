
with open('/home/bryant/Desktop/Projects/KDR Revamped/pages/kdr/[id]/class.tsx') as f:
    stack = []
    content = f.read()
    line = 1
    col = 1
    opened = []
    for i, char in enumerate(content):
        if char == '\n':
            line += 1
            col = 1
        else:
            col += 1
        
        if char == '{': 
            stack.append((line, col))
        elif char == '}': 
            if not stack: 
                print(f'Unbalanced closing brace at line {line}, col {col}')
                continue
            stack.pop()
    
    for l, c in stack:
        print(f'Unclosed brace opened at line {l}, col {c}')
