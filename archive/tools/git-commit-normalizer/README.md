# Git Commit信息规范化工具

这个工具用于将项目的Git提交信息规范化，按照Angular commit message规范进行格式化。

## 🎯 功能特性

- **智能识别**: 自动识别各种类型的commit信息（emoji、特殊字符、无标记等）
- **规范化转换**: 将各种格式的commit信息转换为标准的Angular commit message格式
- **内容分析**: 基于commit内容智能推断合适的type标记
- **批量处理**: 支持通过git filter-branch/git filter-repo进行批量处理

## 📋 支持的规范化规则

### Type标记映射

| 原始格式 | 规范化格式 | 示例 |
|---------|-----------|------|
| 🐛 开头 | `fix:` | `🐛 修复bug` → `fix: 修复bug` |
| 🚀 开头 | `feat:` | `🚀 新功能` → `feat: 新功能` |
| 🔄 开头 | `refactor:` | `🔄 重构代码` → `refactor: 重构代码` |
| 🛠️ 开头 | `fix:` | `🛠️ 修复问题` → `fix: 修复问题` |
| 🗑️ 开头 | `chore:` | `🗑️ 清理代码` → `chore: 清理代码` |
| 📚 开头 | `docs:` | `📚 更新文档` → `docs: 更新文档` |
| � 开头 | `fix:` | `� 特殊字符` → `fix: 特殊字符` |

### 内容智能分类

| 关键词模式 | 自动分配的type |
|-----------|----------------|
| 修复、修正、解决、fix + 问题/错误/bug | `fix:` |
| 优化、改进、完善、增强 | `feat:` |
| 重构、重构、refactor | `refactor:` |
| 完成、实现、添加、新增、新建 | `feat:` |
| 删除、移除、清理、clean | `chore:` |
| 文档、说明、readme、更新文档 | `docs:` |
| 样式、UI、界面、布局 | `fix(ui):` |
| 路由、导航 | `fix(routing):` |
| API、接口 | `fix(api):` |
| 数据库、DB、ORM | `fix(orm):` |
| 前端、frontend | `fix(frontend):` |
| 后端、backend | `fix(backend):` |
| 架构、architecture | `feat(architecture):` |
| 其他情况 | `feat:` (默认) |

### Scope自动识别

脚本会根据commit内容自动添加适当的scope：

- `(ui)`: 界面相关
- `(routing)`: 路由相关
- `(api)`: API相关
- `(orm)`: 数据库相关
- `(frontend)`: 前端相关
- `(backend)`: 后端相关
- `(architecture)`: 架构相关
- `(apps)`: 应用相关

## 🚀 使用方法

### 方法1: 使用git filter-branch（推荐用于已存在的项目）

```bash
# 确保在项目根目录
cd /path/to/your/project

# 使用filter-branch进行批量处理
git filter-branch --force --msg-filter '
python tools/git-commit-normalizer/git_commit_normalizer.py
' -- --all
```

### 方法2: 使用git filter-repo（更现代的工具）

```bash
# 安装git-filter-repo (如果还没有安装)
pip install git-filter-repo

# 使用filter-repo
git filter-repo --message-callback '
import sys
exec(open("tools/git-commit-normalizer/git_commit_normalizer.py").read())
'
```

### 方法3: 手动处理单个commit

```bash
# 查看当前commit信息
git log --format=%B -n 1 HEAD

# 手动修改
git commit --amend -m "fix(ui): 新的commit信息"
```

## 📝 示例

### 处理前
```
889aa01 完成所有APP模块的前后端建设
🐛 修复平台级页面布局问题 - 添加BasicLayout包装
🏗️ 深度优化平台层、系统层、应用层隔离架构
� UMI前端配置问题
更新代码和文档：添加多个应用模块、最佳实践文档和数据库迁移
```

### 处理后
```
feat: 完成所有APP模块的前后端建设
fix(ui): 修复平台级页面布局问题 - 添加BasicLayout包装
refactor(architecture): 深度优化平台层、系统层、应用层隔离架构
fix: UMI前端配置问题
feat: 更新代码和文档：添加多个应用模块、最佳实践文档和数据库迁移
```

## ⚠️ 重要提醒

1. **备份**: 修改历史前务必备份分支
   ```bash
   git branch backup-before-normalize
   ```

2. **推送**: 修改历史后需要强制推送
   ```bash
   git push origin main --force-with-lease
   ```

3. **团队同步**: 通知团队成员历史已重写

4. **测试**: 处理前先在测试commit上验证脚本
   ```bash
   echo "测试commit信息" | python tools/git-commit-normalizer/git_commit_normalizer.py
   ```

## 🔧 自定义配置

如果需要自定义规范化规则，可以修改脚本中的：

- `message_map`: 直接映射特殊commit信息
- `content_based_mapping`: 基于内容的智能分类规则
- `additional_replacements`: scope自动识别规则

## 📚 相关规范

- [Angular Commit Message Format](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit-message-format)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 🐛 故障排除

### 问题1: 脚本执行失败
```bash
# 检查Python环境
python --version
python tools/git-commit-normalizer/git_commit_normalizer.py < test_input.txt
```

### 问题2: git filter-branch路径问题
```bash
# 使用绝对路径
git filter-branch --msg-filter 'python /full/path/to/tools/git-commit-normalizer/git_commit_normalizer.py' -- --all
```

### 问题3: 特殊字符处理
脚本已内置处理特殊字符（如�），如果遇到新的特殊字符，可以添加到脚本的特殊处理逻辑中。

## 📞 维护说明

- **版本**: v1.0.0
- **最后更新**: 2025-12-25
- **适用范围**: RiverEdge项目Git历史规范化
- **维护者**: 项目维护团队

如有问题或需要改进，请联系项目维护者。
