"""
修复重复的文件头注释

检查并修复因批量添加导致的重复文件头注释问题。

Author: Luigi Lu
Date: 2025-12-27
"""

import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SRC_DIR = PROJECT_ROOT / "src"


def fix_duplicate_headers(file_path: Path) -> bool:
    """
    修复文件中的重复文件头注释
    
    Args:
        file_path: 文件路径
        
    Returns:
        bool: 如果修复了返回True
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否有重复的三引号注释块
        # 匹配模式：两个连续的 """...""" 块
        pattern = r'^""".*?"""\s*\n\s*"""'
        
        if re.search(pattern, content, re.DOTALL | re.MULTILINE):
            # 找到第一个完整的注释块（包含Author和Date）
            # 保留第一个，删除第二个
            lines = content.split('\n')
            new_lines = []
            skip_until_next_import = False
            first_docstring_end = False
            
            i = 0
            while i < len(lines):
                line = lines[i]
                
                # 如果遇到第一个 """ 开始
                if line.strip().startswith('"""') and not first_docstring_end:
                    # 收集整个docstring
                    docstring_lines = [line]
                    i += 1
                    while i < len(lines):
                        docstring_lines.append(lines[i])
                        if '"""' in lines[i] and lines[i].strip() != '"""':
                            break
                        if lines[i].strip() == '"""':
                            break
                        i += 1
                    
                    docstring_content = '\n'.join(docstring_lines)
                    
                    # 检查是否包含Author和Date
                    if 'Author:' in docstring_content and 'Date:' in docstring_content:
                        # 这是完整的注释块，保留
                        new_lines.extend(docstring_lines)
                        first_docstring_end = True
                    else:
                        # 这是旧的注释块，也保留（可能是原有的模块注释）
                        new_lines.extend(docstring_lines)
                    
                    if i < len(lines):
                        i += 1
                    continue
                
                # 如果已经处理了第一个docstring，跳过后续的docstring直到import
                if first_docstring_end and line.strip().startswith('"""'):
                    # 跳过这个docstring块
                    i += 1
                    while i < len(lines):
                        if '"""' in lines[i]:
                            i += 1
                            break
                        i += 1
                    continue
                
                new_lines.append(line)
                i += 1
            
            # 写入修复后的内容
            new_content = '\n'.join(new_lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            return True
        
        return False
    except Exception as e:
        print(f"❌ 处理文件 {file_path} 时出错: {e}")
        return False


def main():
    """
    主函数
    """
    print("=" * 60)
    print("修复重复的文件头注释")
    print("=" * 60)
    print()
    
    # 扫描所有Python文件
    python_files = []
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if "__pycache__" not in d]
        for file in files:
            if file.endswith('.py'):
                file_path = Path(root) / file
                python_files.append(file_path)
    
    print(f"📋 扫描 {len(python_files)} 个Python文件")
    print()
    
    # 修复重复注释
    fixed_count = 0
    for file_path in python_files:
        if fix_duplicate_headers(file_path):
            rel_path = file_path.relative_to(PROJECT_ROOT)
            print(f"  ✅ {rel_path}")
            fixed_count += 1
    
    print()
    print("=" * 60)
    print(f"✅ 修复了 {fixed_count} 个文件")
    print("=" * 60)


if __name__ == "__main__":
    import os
    main()

