"""
批量添加文件头注释脚本

扫描所有Python文件，为缺少文件头注释的文件添加标准注释。

Author: Luigi Lu
Date: 2025-12-27
"""

import os
import re
from pathlib import Path
from datetime import datetime

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
SRC_DIR = PROJECT_ROOT / "src"

# 文件头注释模板
HEADER_TEMPLATE = '''"""
{module_name}

{module_description}

Author: Luigi Lu
Date: {date}
"""

'''

# 需要跳过的文件（通常是自动生成的文件）
SKIP_PATTERNS = [
    "__pycache__",
    ".pyc",
    "__init__.py",  # __init__.py 文件通常不需要详细注释
    "migrations",  # 迁移文件有特殊格式
]


def get_module_name(file_path: Path) -> str:
    """
    从文件路径提取模块名称
    
    Args:
        file_path: 文件路径
        
    Returns:
        str: 模块名称
    """
    # 获取相对于src目录的路径
    rel_path = file_path.relative_to(SRC_DIR)
    # 移除.py扩展名
    module_name = rel_path.stem
    # 转换为模块路径格式
    module_parts = rel_path.parts[:-1] + (module_name,)
    return ".".join(module_parts)


def get_module_description(file_path: Path) -> str:
    """
    根据文件路径生成模块描述
    
    Args:
        file_path: 文件路径
        
    Returns:
        str: 模块描述
    """
    # 根据文件路径推断描述
    parts = file_path.parts
    
    # 提取关键信息
    if "infra" in parts:
        level = "平台级"
    elif "core" in parts:
        level = "系统级"
    elif "apps" in parts:
        level = "应用级"
    else:
        level = ""
    
    # 根据目录结构生成描述
    if "models" in parts:
        desc = f"{level}数据模型模块" if level else "数据模型模块"
    elif "schemas" in parts:
        desc = f"{level}数据验证模块" if level else "数据验证模块"
    elif "services" in parts:
        desc = f"{level}业务服务模块" if level else "业务服务模块"
    elif "api" in parts:
        desc = f"{level}API路由模块" if level else "API路由模块"
    elif "exceptions" in parts:
        desc = f"{level}异常定义模块" if level else "异常定义模块"
    elif "utils" in parts:
        desc = f"{level}工具函数模块" if level else "工具函数模块"
    elif "config" in parts:
        desc = f"{level}配置模块" if level else "配置模块"
    elif "middleware" in parts:
        desc = f"{level}中间件模块" if level else "中间件模块"
    else:
        desc = f"{level}模块" if level else "模块"
    
    return desc


def has_file_header(file_path: Path) -> bool:
    """
    检查文件是否已有文件头注释
    
    Args:
        file_path: 文件路径
        
    Returns:
        bool: 如果已有文件头注释返回True
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            # 检查第一行是否是 """ 或 '''
            if first_line.startswith('"""') or first_line.startswith("'''"):
                # 读取更多行检查是否有Author和Date
                content = f.read(500)  # 读取前500个字符
                return "Author:" in content and "Date:" in content
            return False
    except Exception:
        return False


def should_skip_file(file_path: Path) -> bool:
    """
    判断是否应该跳过该文件
    
    Args:
        file_path: 文件路径
        
    Returns:
        bool: 如果应该跳过返回True
    """
    path_str = str(file_path)
    for pattern in SKIP_PATTERNS:
        if pattern in path_str:
            return True
    return False


def add_file_header(file_path: Path) -> bool:
    """
    为文件添加文件头注释
    
    Args:
        file_path: 文件路径
        
    Returns:
        bool: 如果成功添加返回True
    """
    try:
        # 读取原文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 如果已有文件头注释，跳过
        if has_file_header(file_path):
            return False
        
        # 生成文件头注释
        module_name = get_module_name(file_path)
        module_description = get_module_description(file_path)
        date_str = datetime.now().strftime("%Y-%m-%d")
        
        header = HEADER_TEMPLATE.format(
            module_name=module_name,
            module_description=module_description,
            date=date_str
        )
        
        # 如果文件开头有编码声明，保留它
        encoding_pattern = r'^#.*coding[:=]\s*([-\w.]+)'
        encoding_match = re.match(encoding_pattern, content, re.MULTILINE)
        
        if encoding_match:
            # 有编码声明，在编码声明后添加注释
            lines = content.split('\n')
            # 找到编码声明行
            encoding_line_idx = None
            for i, line in enumerate(lines):
                if re.match(encoding_pattern, line):
                    encoding_line_idx = i
                    break
            
            if encoding_line_idx is not None:
                # 在编码声明后插入注释
                new_lines = lines[:encoding_line_idx + 1]
                new_lines.append('')
                new_lines.extend(header.strip().split('\n'))
                new_lines.extend(lines[encoding_line_idx + 1:])
                new_content = '\n'.join(new_lines)
            else:
                new_content = header + content
        else:
            # 没有编码声明，直接添加注释
            new_content = header + content
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return True
    except Exception as e:
        print(f"❌ 处理文件 {file_path} 时出错: {e}")
        return False


def main():
    """
    主函数
    """
    print("=" * 60)
    print("批量添加文件头注释")
    print("=" * 60)
    print()
    
    # 扫描所有Python文件
    python_files = []
    for root, dirs, files in os.walk(SRC_DIR):
        # 跳过不需要的目录
        dirs[:] = [d for d in dirs if "__pycache__" not in d]
        
        for file in files:
            if file.endswith('.py'):
                file_path = Path(root) / file
                if not should_skip_file(file_path):
                    python_files.append(file_path)
    
    print(f"📋 找到 {len(python_files)} 个Python文件")
    print()
    
    # 检查哪些文件需要添加注释
    files_to_update = []
    files_with_header = []
    
    for file_path in python_files:
        if has_file_header(file_path):
            files_with_header.append(file_path)
        else:
            files_to_update.append(file_path)
    
    print(f"✅ 已有文件头注释: {len(files_with_header)} 个")
    print(f"⏳ 需要添加文件头注释: {len(files_to_update)} 个")
    print()
    
    if not files_to_update:
        print("✅ 所有文件都已包含文件头注释！")
        return
    
    # 显示需要更新的文件列表
    print("📋 需要更新的文件列表:")
    for i, file_path in enumerate(files_to_update[:20], 1):
        rel_path = file_path.relative_to(PROJECT_ROOT)
        print(f"  {i}. {rel_path}")
    
    if len(files_to_update) > 20:
        print(f"  ... 还有 {len(files_to_update) - 20} 个文件")
    
    print()
    print("⚠️  即将为以上文件添加文件头注释")
    
    # 检查是否有 --auto 参数
    import sys
    if "--auto" in sys.argv:
        print("   自动模式：直接执行...")
    else:
        print("   按 Enter 继续，按 Ctrl+C 取消...")
        try:
            input()
        except (KeyboardInterrupt, EOFError):
            print("\n❌ 操作已取消")
            return
    
    # 批量添加文件头注释
    print()
    print("🔄 开始添加文件头注释...")
    print()
    
    success_count = 0
    fail_count = 0
    
    for file_path in files_to_update:
        rel_path = file_path.relative_to(PROJECT_ROOT)
        if add_file_header(file_path):
            print(f"  ✅ {rel_path}")
            success_count += 1
        else:
            print(f"  ⚠️  {rel_path} (可能已有注释或出错)")
            fail_count += 1
    
    print()
    print("=" * 60)
    print(f"✅ 成功: {success_count} 个文件")
    print(f"⚠️  跳过/失败: {fail_count} 个文件")
    print("=" * 60)


if __name__ == "__main__":
    main()

