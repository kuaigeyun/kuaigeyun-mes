#!/usr/bin/env python3
"""
更新 .env 文件中的 Inngest 配置
"""

import re
import sys

def update_inngest_config():
    env_file = '.env'
    backup_file = '.env.backup'
    
    # 读取备份文件
    try:
        with open(backup_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        # 如果没有备份，读取当前文件
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
    
    # 新的Inngest配置
    new_inngest_config = """# ========================================
# Inngest 服务配置
# ========================================
# Inngest 服务主机地址（可通过环境变量覆盖，默认127.0.0.1）
INNGEST_HOST=127.0.0.1

# Inngest 服务端口（可通过环境变量覆盖，默认8300避免Windows端口保留问题）
INNGEST_PORT=8300

# Inngest 事件 API 地址（推荐方式，直接指定完整URL）
# 如果不设置此变量，则自动从 INNGEST_HOST 和 INNGEST_PORT 构建
# INNGEST_EVENT_API_URL=http://127.0.0.1:8300

# Inngest 应用ID（用于标识应用）
INNGEST_APP_ID=riveredge

# Inngest 是否为生产环境（true/false）
INNGEST_IS_PRODUCTION=false"""
    
    # 移除所有旧的Inngest配置
    # 匹配从 "# ========================================" 开始到下一个 "# ========================================" 或文件结尾的Inngest配置块
    pattern = r'# ========================================\s*\n# Inngest 服务配置\s*\n# ========================================.*?(?=\n# ========================================|$)'
    content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    # 移除单独的INNGEST变量行（如果存在）
    lines = content.split('\n')
    new_lines = []
    skip_inngest_vars = False
    
    for i, line in enumerate(lines):
        # 如果遇到Inngest配置部分开始，标记跳过
        if 'Inngest 服务配置' in line:
            skip_inngest_vars = True
            continue
        
        # 如果遇到下一个配置部分，停止跳过
        if skip_inngest_vars and line.strip() == '# ========================================':
            skip_inngest_vars = False
            # 插入新的Inngest配置
            new_lines.append(new_inngest_config)
            new_lines.append('')
            new_lines.append(line)
            continue
        
        # 跳过Inngest相关的变量行
        if skip_inngest_vars and (line.startswith('INNGEST') or line.startswith('# INNGEST')):
            continue
        
        new_lines.append(line)
    
    # 如果文件末尾还有Inngest变量，也要移除
    final_lines = []
    for line in new_lines:
        if line.startswith('INNGEST') and 'Inngest 服务配置' not in '\n'.join(final_lines[-10:]):
            # 检查是否在Inngest配置块中
            in_inngest_block = False
            for prev_line in reversed(final_lines[-20:]):
                if 'Inngest 服务配置' in prev_line:
                    in_inngest_block = True
                    break
                if prev_line.strip() == '# ========================================':
                    break
            if not in_inngest_block:
                continue
        final_lines.append(line)
    
    # 确保Inngest配置存在
    content = '\n'.join(final_lines)
    if 'Inngest 服务配置' not in content:
        # 在文件开头添加Inngest配置
        header = """# RiverEdge SaaS 多组织框架 - 后端环境变量配置
# 
# 使用方法：
# 1. 根据实际环境修改配置值
# 2. .env 文件已加入 .gitignore，不会被提交到版本库

"""
        content = header + new_inngest_config + '\n\n' + content.split(header)[-1] if header in content else header + new_inngest_config + '\n\n' + content
    
    # 写入文件
    with open(env_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 已更新 .env 文件中的 Inngest 配置")
    return 0

if __name__ == '__main__':
    sys.exit(update_inngest_config())

