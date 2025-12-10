#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量修复 Ant Design 6.0 的 width 属性问题
将 Modal 和 Drawer 组件的 width 属性改为 size 属性
最终版：直接替换独立的 width={...} 行
"""

import os
import re
import sys

def fix_width_to_size(file_path):
    """
    修复单个文件中的 width 属性
    只修复 Modal 和 Drawer 组件内的 width 属性
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        original_lines = lines.copy()
        modified = False
        in_modal_or_drawer = False
        modal_drawer_indent = 0
        
        new_lines = []
        
        for i, line in enumerate(lines):
            original_line = line
            
            # 检查是否是 Modal 或 Drawer 开始标签
            modal_match = re.search(r'<Modal\b', line)
            drawer_match = re.search(r'<Drawer\b', line)
            
            if modal_match or drawer_match:
                in_modal_or_drawer = True
                # 计算缩进（用于判断后续行是否在标签内）
                modal_drawer_indent = len(line) - len(line.lstrip())
                # 在同一行内替换 width
                if 'width={' in line and 'size=' not in line:
                    line = re.sub(r'\bwidth=\{([^}]+)\}', r'size={\1}', line)
                    if line != original_line:
                        modified = True
            
            # 检查是否是 Modal 或 Drawer 结束标签
            elif in_modal_or_drawer:
                if re.search(r'</Modal>', line) or re.search(r'</Drawer>', line):
                    in_modal_or_drawer = False
                elif re.search(r'/>', line):
                    # 自闭合标签，检查缩进
                    current_indent = len(line) - len(line.lstrip())
                    if current_indent <= modal_drawer_indent:
                        in_modal_or_drawer = False
                elif '>' in line and not line.strip().startswith('{') and not line.strip().startswith('//'):
                    # 可能是标签结束，检查缩进
                    current_indent = len(line) - len(line.lstrip())
                    if current_indent <= modal_drawer_indent and 'width=' not in line:
                        # 可能是其他标签，但需要更精确的判断
                        pass
            
            # 如果在 Modal 或 Drawer 标签内，且包含 width={，替换为 size={
            if in_modal_or_drawer and 'width={' in line and 'size=' not in line:
                # 确保这一行是属性行（通常有缩进）
                current_indent = len(line) - len(line.lstrip())
                if current_indent > modal_drawer_indent or modal_match or drawer_match:
                    line = re.sub(r'\bwidth=\{([^}]+)\}', r'size={\1}', line)
                    if line != original_line:
                        modified = True
            
            new_lines.append(line)
        
        # 如果内容有变化，写回文件
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            return True
        return False
    except Exception as e:
        print(f"处理文件 {file_path} 时出错: {e}", file=sys.stderr)
        return False

def main():
    """
    主函数：遍历所有 TypeScript/TSX 文件并修复
    """
    # 获取项目根目录
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_src = os.path.join(project_root, 'riveredge-frontend', 'src')
    
    if not os.path.exists(frontend_src):
        print(f"错误: 找不到目录 {frontend_src}", file=sys.stderr)
        sys.exit(1)
    
    # 统计信息
    total_files = 0
    modified_files = 0
    
    # 遍历所有 .tsx 和 .ts 文件
    for root, dirs, files in os.walk(frontend_src):
        # 跳过 node_modules
        if 'node_modules' in root:
            continue
        
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                file_path = os.path.join(root, file)
                total_files += 1
                
                if fix_width_to_size(file_path):
                    modified_files += 1
                    print(f"✓ 已修复: {os.path.relpath(file_path, project_root)}")
    
    print(f"\n处理完成:")
    print(f"  总文件数: {total_files}")
    print(f"  修改文件数: {modified_files}")

if __name__ == '__main__':
    main()

