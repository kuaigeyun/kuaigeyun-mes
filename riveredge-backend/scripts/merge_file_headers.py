"""
合并重复的文件头注释

将批量添加的文件头注释与原有的模块注释合并。

Author: Luigi Lu
Date: 2025-12-27
"""

import re
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SRC_DIR = PROJECT_ROOT / "src"


def merge_file_headers(file_path: Path) -> bool:
    """
    合并文件中的重复文件头注释
    
    Args:
        file_path: 文件路径
        
    Returns:
        bool: 如果修复了返回True
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # 检查前20行是否有两个连续的docstring
        first_docstring = None
        second_docstring = None
        first_docstring_end = -1
        second_docstring_start = -1
        second_docstring_end = -1
        
        in_first_docstring = False
        in_second_docstring = False
        first_docstring_lines = []
        second_docstring_lines = []
        
        for i, line in enumerate(lines[:30]):  # 只检查前30行
            stripped = line.strip()
            
            # 检测第一个docstring
            if not in_first_docstring and stripped.startswith('"""'):
                in_first_docstring = True
                first_docstring_lines = [line]
                continue
            
            if in_first_docstring:
                first_docstring_lines.append(line)
                if '"""' in stripped and len(stripped) > 3:
                    # 单行docstring
                    in_first_docstring = False
                    first_docstring_end = i
                elif stripped == '"""':
                    # 多行docstring结束
                    in_first_docstring = False
                    first_docstring_end = i
                    continue
            
            # 检测第二个docstring（在第一个之后）
            if first_docstring_end >= 0 and not in_second_docstring and stripped.startswith('"""'):
                in_second_docstring = True
                second_docstring_start = i
                second_docstring_lines = [line]
                continue
            
            if in_second_docstring:
                second_docstring_lines.append(line)
                if '"""' in stripped and len(stripped) > 3:
                    # 单行docstring
                    in_second_docstring = False
                    second_docstring_end = i
                elif stripped == '"""':
                    # 多行docstring结束
                    in_second_docstring = False
                    second_docstring_end = i
                    break
        
        # 如果找到两个docstring，合并它们
        if first_docstring_end >= 0 and second_docstring_start >= 0:
            # 提取第一个docstring的内容（去掉三引号）
            first_content = '\n'.join(first_docstring_lines)
            first_content = re.sub(r'^"""', '', first_content)
            first_content = re.sub(r'"""$', '', first_content)
            first_content = first_content.strip()
            
            # 提取第二个docstring的内容（去掉三引号）
            second_content = '\n'.join(second_docstring_lines)
            second_content = re.sub(r'^"""', '', second_content)
            second_content = re.sub(r'"""$', '', second_content)
            second_content = second_content.strip()
            
            # 检查第一个是否包含Author和Date
            has_author_date = 'Author:' in first_content and 'Date:' in first_content
            
            # 合并策略：
            # 1. 如果第一个有Author和Date，保留第一个的描述，合并第二个的描述
            # 2. 如果第一个没有Author和Date，使用第二个的描述，添加Author和Date
            
            if has_author_date:
                # 第一个是完整的文件头注释
                # 提取第一个的标题和描述（在Author之前）
                first_parts = first_content.split('Author:')
                first_main = first_parts[0].strip()
                first_author_date = 'Author:' + first_parts[1] if len(first_parts) > 1 else ''
                
                # 提取第二个的描述（去掉可能的重复信息）
                second_main = second_content
                if 'Author:' in second_main:
                    second_main = second_main.split('Author:')[0].strip()
                
                # 合并：使用第二个的描述（通常更详细），保留第一个的Author和Date
                merged_content = second_main
                if first_author_date:
                    merged_content += '\n\n' + first_author_date
            else:
                # 第一个没有Author和Date，使用第二个的描述
                merged_content = second_content
                # 添加Author和Date（从第一个中提取，如果没有则添加默认值）
                if 'Author:' in first_content:
                    author_date_part = first_content.split('Author:')[1] if 'Author:' in first_content else ''
                    if author_date_part:
                        merged_content += '\n\nAuthor:' + author_date_part
                else:
                    merged_content += '\n\nAuthor: Luigi Lu\nDate: 2025-12-27'
            
            # 构建新的文件内容
            new_lines = []
            new_lines.append('"""')
            new_lines.extend(merged_content.split('\n'))
            new_lines.append('"""')
            new_lines.append('')  # 空行
            
            # 添加剩余的行（从第二个docstring之后开始）
            new_lines.extend(lines[second_docstring_end + 1:])
            
            # 写入文件
            new_content = '\n'.join(new_lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            return True
        
        return False
    except Exception as e:
        print(f"❌ 处理文件 {file_path} 时出错: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """
    主函数
    """
    print("=" * 60)
    print("合并重复的文件头注释")
    print("=" * 60)
    print()
    
    # 扫描所有Python文件
    python_files = []
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if "__pycache__" not in d]
        for file in files:
            if file.endswith('.py') and file != '__init__.py':
                file_path = Path(root) / file
                python_files.append(file_path)
    
    print(f"📋 扫描 {len(python_files)} 个Python文件")
    print()
    
    # 修复重复注释
    fixed_count = 0
    for file_path in python_files:
        if merge_file_headers(file_path):
            rel_path = file_path.relative_to(PROJECT_ROOT)
            print(f"  ✅ {rel_path}")
            fixed_count += 1
    
    print()
    print("=" * 60)
    print(f"✅ 合并了 {fixed_count} 个文件的重复注释")
    print("=" * 60)


if __name__ == "__main__":
    main()

