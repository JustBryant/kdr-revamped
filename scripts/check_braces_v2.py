
import re

def check_braces(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

    # Remove strings
    content = re.sub(r"'.*?'", "''", content)
    content = re.sub(r'".*?"', '""', content)
    content = re.sub(r'`.*?`', '``', content, flags=re.DOTALL)

    stack = []
    line = 1
    col = 1
    for char in content:
        if char == '\n':
            line += 1
            col = 0
        col += 1
        
        if char == '{':
            stack.append((line, col))
        elif char == '}':
            if not stack:
                print(f"Unbalanced brace at {line}:{col}")
            else:
                stack.pop()
    
    for l, c in stack:
        print(f"Unclosed brace at {l}:{c}")

if __name__ == '__main__':
    check_braces('/home/bryant/Desktop/Projects/KDR Revamped/pages/kdr/[id]/class.tsx')
