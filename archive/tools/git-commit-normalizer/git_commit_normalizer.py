#!/usr/bin/env python3
"""
Git commit信息规范化脚本 - 专为git filter-repo设计
"""

import sys
import re

# 读取commit信息
commit_msg = sys.stdin.read()

# 如果已经是规范化的格式，直接返回
if re.match(r'^(feat|fix|docs|style|refactor|test|chore|perf|build|ci|revert)(\([^)]+\))?:', commit_msg):
    sys.stdout.write(commit_msg)
    sys.exit(0)

# 定义完整的映射
message_map = {
    # Emoji开头的commit规范化
    "🐛 修复平台级页面布局问题 - 添加BasicLayout包装": "fix(ui): 修复平台级页面布局问题 - 添加BasicLayout包装",
    "🐛 修复平台级页面路由404错误": "fix(routing): 修复平台级页面路由404错误",
    "🐛 修复层间隔离架构启动错误": "fix(architecture): 修复层间隔离架构启动错误",
    "🏗️ 深度优化平台层、系统层、应用层隔离架构": "refactor(architecture): 深度优化平台层、系统层、应用层隔离架构",
    "🔄 重构应用管理系统 - 移除硬编码，动态管理应用部件": "refactor(apps): 重构应用管理系统 - 移除硬编码，动态管理应用部件",
    "🐛 修复登录500错误 - 清理Tortoise ORM配置中的已停用应用模型引用": "fix(orm): 修复登录500错误 - 清理Tortoise ORM配置中的已停用应用模型引用",
    "🛠️ 重构 applications API 端点，修复 'NoneType' object is not iterable 错误": "fix(api): 重构 applications API 端点，修复数据类型错误",
    "🐛 移除不存在的应用详情页面路由": "fix(routing): 移除不存在的应用详情页面路由",
    "🐛 修复路由组件命名冲突错误": "fix(components): 修复路由组件命名冲突错误",
    "🏗️ 实现系统层与应用层完全隔离架构": "feat(architecture): 实现系统层与应用层完全隔离架构",
    "🐛 修复 scan_and_register_plugins 返回类型不匹配问题": "fix(apps): 修复应用注册服务返回类型不匹配问题",
    "🐛 修复 list_applications API的 'NoneType' object is not iterable 错误": "fix(api): 修复应用列表API数据类型错误",
    "🐛 修复登录时 'NoneType' object is not iterable 错误": "fix(auth): 修复登录时数据类型错误",
    "🗑️ 完全删除已停用应用的所有数据": "chore(data): 清理已停用应用数据",
    "📚 添加已停用APP数据表备份说明文档": "docs(backup): 添加应用数据备份说明文档",
    "🐛 修复 get_installed_applications SQL 查询错误": "fix(api): 修复已安装应用查询错误",
    "🔧 修复前端应用加载错误": "fix(frontend): 修复应用加载错误",
    "📁 后端服务文件按业务领域重新组织": "refactor(backend): 重新组织后端服务文件结构",
    "🐛 修复插件管理页面API导入路径问题": "fix(frontend): 修复插件管理页面导入路径问题",
    "🚀 实现动态插件管理系统": "feat(plugins): 实现动态插件管理系统",
    "🔧 项目文件结构整理与组件重组": "refactor(structure): 项目文件结构整理与组件重组",
    "🚀 快速上线模式：停用所有业务APP，只保留主数据管理": "feat(quick-launch): 快速上线模式：停用所有业务APP，只保留主数据管理",
    "🔧 修复后端硬编码导入问题": "fix(backend): 修复后端硬编码导入问题",
}

# 直接映射查找
commit_msg_stripped = commit_msg.strip()
if commit_msg_stripped in message_map:
    sys.stdout.write(message_map[commit_msg_stripped] + '\n')
    sys.exit(0)

# 正则表达式替换（通用规则）
# Emoji开头的commit
commit_msg = re.sub(r'^🐛 (.+)$', r'fix: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^🏗️ (.+)$', r'feat: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^🔄 (.+)$', r'refactor: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^🛠️ (.+)$', r'fix: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^🗑️ (.+)$', r'chore: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^📚 (.+)$', r'docs: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^🔧 (.+)$', r'fix: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^📁 (.+)$', r'refactor: \1', commit_msg, flags=re.MULTILINE)
commit_msg = re.sub(r'^🚀 (.+)$', r'feat: \1', commit_msg, flags=re.MULTILINE)

# 处理没有规范化标记的commit - 基于内容智能分类
content_based_mapping = [
    # 修复类
    (r'.*(修复|修正|解决|fix).*(问题|错误|bug).*', 'fix: '),
    (r'.*(优化|改进|完善|增强).*', 'feat: '),
    (r'.*(重构|重构|refactor).*', 'refactor: '),
    (r'.*(完成|实现|添加|新增|新建).*', 'feat: '),
    (r'.*(删除|移除|清理|clean).*', 'chore: '),
    (r'.*(文档|说明|readme|更新文档).*', 'docs: '),
    (r'.*(样式|UI|界面|布局).*', 'fix(ui): '),
    (r'.*(路由|导航).*', 'fix(routing): '),
    (r'.*(API|接口).*', 'fix(api): '),
    (r'.*(数据库|DB|ORM).*', 'fix(orm): '),
    (r'.*(前端|frontend).*', 'fix(frontend): '),
    (r'.*(后端|backend).*', 'fix(backend): '),
    (r'.*(架构|architecture).*', 'feat(architecture): '),
    (r'.*(构建|build|编译).*', 'fix(build): '),
    (r'.*(测试|test).*', 'test: '),
    (r'.*(性能|优化|perf).*', 'perf: '),
    (r'.*(CI|CD|部署|发布).*', 'ci: '),
    (r'.*(代码格式|格式化|lint).*', 'style: '),
    # 默认归类为feat
]

# 如果没有规范化标记，基于内容智能分类
if not re.match(r'^(feat|fix|docs|style|refactor|test|chore|perf|build|ci|revert)', commit_msg):
    for pattern, replacement in content_based_mapping:
        if re.search(pattern, commit_msg, re.IGNORECASE):
            commit_msg = replacement + commit_msg
            break
    else:
        # 默认归类为feat
        commit_msg = 'feat: ' + commit_msg

# 进一步规范化scope
additional_replacements = [
    (r'^fix: 修复平台级页面布局问题', r'fix(ui): 修复平台级页面布局问题'),
    (r'^fix: 修复平台级页面路由', r'fix(routing): 修复平台级页面路由'),
    (r'^fix: 修复层间隔离架构', r'fix(architecture): 修复层间隔离架构'),
    (r'^feat: 深度优化平台层、系统层、应用层隔离架构', r'refactor(architecture): 深度优化平台层、系统层、应用层隔离架构'),
    (r'^refactor: 重构应用管理系统', r'refactor(apps): 重构应用管理系统'),
    (r'^fix: 修复登录500错误', r'fix(orm): 修复登录500错误'),
    (r'^fix: 重构 applications API 端点', r'fix(api): 重构 applications API 端点'),
    (r'^fix: 移除不存在的应用详情页面路由', r'fix(routing): 移除不存在的应用详情页面路由'),
    (r'^fix: 修复路由组件命名冲突错误', r'fix(components): 修复路由组件命名冲突错误'),
    (r'^feat: 实现系统层与应用层完全隔离架构', r'feat(architecture): 实现系统层与应用层完全隔离架构'),
    (r'^fix: 修复 scan_and_register_plugins 返回类型不匹配问题', r'fix(apps): 修复应用注册服务返回类型不匹配问题'),
    (r'^fix: 修复 list_applications API的', r'fix(api): 修复应用列表API的'),
    (r'^fix: 修复登录时', r'fix(auth): 修复登录时'),
    (r'^chore: 完全删除已停用应用的所有数据', r'chore(data): 清理已停用应用数据'),
    (r'^docs: 添加已停用APP数据表备份说明文档', r'docs(backup): 添加应用数据备份说明文档'),
    (r'^fix: 修复 get_installed_applications SQL 查询错误', r'fix(api): 修复已安装应用查询错误'),
    (r'^fix: 修复前端应用加载错误', r'fix(frontend): 修复应用加载错误'),
    (r'^refactor: 后端服务文件按业务领域重新组织', r'refactor(backend): 重新组织后端服务文件结构'),
    (r'^fix: 修复插件管理页面API导入路径问题', r'fix(frontend): 修复插件管理页面导入路径问题'),
    (r'^feat: 实现动态插件管理系统', r'feat(plugins): 实现动态插件管理系统'),
    (r'^refactor: 项目文件结构整理与组件重组', r'refactor(structure): 项目文件结构整理与组件重组'),
    (r'^feat: 快速上线模式：停用所有业务APP，只保留主数据管理', r'feat(quick-launch): 快速上线模式：停用所有业务APP，只保留主数据管理'),
    (r'^fix: 修复后端硬编码导入问题', r'fix(backend): 修复后端硬编码导入问题'),
]

for pattern, replacement in additional_replacements:
    commit_msg = re.sub(re.escape(pattern) + r'(.*)', replacement + r'\1', commit_msg)

# 返回处理后的commit信息
sys.stdout.write(commit_msg)
