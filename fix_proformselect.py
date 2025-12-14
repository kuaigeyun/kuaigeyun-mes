#!/usr/bin/env python3
import os
import re
import glob

def fix_file(filepath):
    """修复单个文件中的 ProFormSelect 使用"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 检查是否已经修复过
        if 'SafeProFormSelect' in content and 'import.*ProFormSelect.*from' not in content:
            return False

        # 替换导入语句
        import_pattern = r'import\s+.*?\bProFormSelect\b.*?\s+from\s+[\'"][^\'"]*[\'"];'
        if re.search(import_pattern, content, re.MULTILINE | re.DOTALL):
            # 添加 SafeProFormSelect 导入
            content = re.sub(
                r'(import\s+.*?from\s+[\'"][^\'"]*[\'"];)\s*',
                r'\1\nimport SafeProFormSelect from \'@/components/SafeProFormSelect\';',
                content
            )
            # 移除 ProFormSelect 从导入中
            content = re.sub(
                r'(\s*),?\s*ProFormSelect(\s*,)?',
                lambda m: ',' if m.group(1) and m.group(2) else '',
                content
            )

        # 替换组件使用
        content = re.sub(r'<ProFormSelect\s', '<SafeProFormSelect ', content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        return True
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    # 查找所有使用 ProFormSelect 的文件
    pattern = 'src/**/*.tsx'
    files = glob.glob(pattern, recursive=True)

    fixed_count = 0
    for filepath in files:
        if 'SafeProFormSelect.tsx' in filepath:
            continue

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if 'ProFormSelect' in content and 'SafeProFormSelect' not in content:
                if fix_file(filepath):
                    print(f"Fixed: {filepath}")
                    fixed_count += 1
                else:
                    print(f"Skipped: {filepath}")
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

    print(f"\nFixed {fixed_count} files")

if __name__ == '__main__':
    main()
