#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量修复 Ant Design 6.0 的废弃样式属性问题
- Descriptions/ProDescriptions 组件的 contentStyle 改为 styles.content
- Card 组件的 bodyStyle 改为 styles.body
"""

import os
import re
import sys

def fix_deprecated_styles(file_path):
    """
    修复单个文件中的废弃样式属性
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        modified = False
        
        # 修复 Descriptions/ProDescriptions 的 contentStyle（在 columns 配置中）
        # 匹配模式：contentStyle: {...} 在 columns 数组中
        def replace_content_style_in_columns(match):
            style_content = match.group(1)
            return f'styles: {{\n                content: {style_content}\n              }}'
        
        # 匹配 columns 配置中的 contentStyle
        content = re.sub(
            r'contentStyle:\s*(\{[^}]*\})',
            replace_content_style_in_columns,
            content,
            flags=re.MULTILINE
        )
        
        # 修复 Descriptions/ProDescriptions 组件本身的 contentStyle 属性
        # 匹配模式：contentStyle={{...}} 或 contentStyle={...}
        def replace_content_style_prop(match):
            style_content = match.group(1)
            return f'styles={{\n          content: {style_content}\n        }}'
        
        # 匹配组件属性中的 contentStyle
        content = re.sub(
            r'contentStyle=\{\s*(\{[^}]*\})\s*\}',
            replace_content_style_prop,
            content,
            flags=re.MULTILINE
        )
        
        # 修复 Card 的 bodyStyle（在组件属性中）
        # 匹配模式：bodyStyle={{...}} 或 bodyStyle={...}
        def replace_body_style(match):
            style_content = match.group(1)
            return f'styles={{\n          body: {style_content}\n        }}'
        
        # 匹配组件属性中的 bodyStyle
        content = re.sub(
            r'bodyStyle=\{\s*(\{[^}]*\})\s*\}',
            replace_body_style,
            content,
            flags=re.MULTILINE
        )
        
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
                
                if fix_deprecated_styles(file_path):
                    modified_files += 1
                    print(f"✓ 已修复: {os.path.relpath(file_path, project_root)}")
    
    print(f"\n处理完成:")
    print(f"  总文件数: {total_files}")
    print(f"  修改文件数: {modified_files}")

if __name__ == '__main__':
    main()
