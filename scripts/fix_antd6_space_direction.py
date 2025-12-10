#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量修复 Ant Design 6.0 的 Space 组件 direction 属性问题
将 Space 组件的 direction 属性改为 orientation 属性
"""

import os
import re
import sys

def fix_space_direction(file_path):
    """
    修复单个文件中的 Space 组件 direction 属性
    将 direction="vertical" 改为 orientation="vertical"
    将 direction="horizontal" 改为 orientation="horizontal"（或删除，因为这是默认值）
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 替换 direction="vertical" 为 orientation="vertical"
        content = re.sub(r'\bdirection="vertical"', r'orientation="vertical"', content)
        content = re.sub(r"\bdirection='vertical'", r"orientation='vertical'", content)
        content = re.sub(r'\bdirection=\{["\']vertical["\']\}', r'orientation="vertical"', content)
        
        # 替换 direction="horizontal" 为 orientation="horizontal"（或删除，因为这是默认值）
        # 但为了保持代码清晰，我们也可以保留它
        content = re.sub(r'\bdirection="horizontal"', r'orientation="horizontal"', content)
        content = re.sub(r"\bdirection='horizontal'", r"orientation='horizontal'", content)
        content = re.sub(r'\bdirection=\{["\']horizontal["\']\}', r'orientation="horizontal"', content)
        
        # 如果内容有变化，写回文件
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
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
                
                if fix_space_direction(file_path):
                    modified_files += 1
                    print(f"✓ 已修复: {os.path.relpath(file_path, project_root)}")
    
    print(f"\n处理完成:")
    print(f"  总文件数: {total_files}")
    print(f"  修改文件数: {modified_files}")

if __name__ == '__main__':
    main()

