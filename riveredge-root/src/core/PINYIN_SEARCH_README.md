# 拼音首字母搜索功能说明

## 📋 概述

拼音首字母搜索功能允许用户使用拼音首字母（如 "ZS"）来搜索中文内容（如 "张三"），提升中文搜索体验。

## 🎯 功能特性

1. **自动识别拼音首字母**：系统会自动识别用户输入是否为拼音首字母格式
2. **智能匹配**：支持文本匹配和拼音首字母匹配两种方式
3. **向后兼容**：如果未安装拼音库，会自动降级为普通文本搜索
4. **性能优化**：拼音匹配在应用层进行，不影响数据库查询性能

## 📦 依赖安装

### 后端依赖

```bash
pip install pypinyin>=0.51.0
```

### 前端依赖

```bash
npm install pinyin-pro@^3.19.0
```

## 🔧 使用方法

### 后端使用

#### 1. 使用 `list_with_search` 函数（推荐）

`list_with_search` 函数已自动支持拼音首字母搜索，无需额外配置：

```python
from core.search_utils import list_with_search
from models.tenant import Tenant

async def list_tenants(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None
) -> Dict[str, Any]:
    """获取组织列表（支持拼音首字母搜索）"""
    return await list_with_search(
        model=Tenant,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['name', 'domain'],  # 要搜索的字段
        allowed_sort_fields=['name', 'created_at']
    )
```

#### 2. 使用拼音工具函数

```python
from core.pinyin_utils import (
    get_pinyin_initials,
    match_pinyin_initials,
    is_pinyin_keyword
)

# 获取拼音首字母
initials = get_pinyin_initials("张三")  # 返回: "ZS"

# 检查是否匹配
matched = match_pinyin_initials("张三", "ZS")  # 返回: True

# 判断是否为拼音首字母格式
is_pinyin = is_pinyin_keyword("ZS")  # 返回: True
```

### 前端使用

#### 1. 在自动完成中使用

自动完成组件已自动支持拼音首字母搜索，无需额外配置：

```typescript
import { getTenantList } from '@/services/tenant';

const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      autoCompleteApi: async (keyword: string) => {
        if (!keyword || keyword.length < 2) return [];
        const result = await getTenantList({ 
          page: 1, 
          page_size: 20, 
          keyword 
        });
        return result.items.map((tenant) => ({
          label: `${tenant.name} (${tenant.domain})`,
          value: tenant.name,
        }));
      },
    },
  },
];
```

#### 2. 使用拼音工具函数

```typescript
import { 
  getPinyinInitials, 
  matchPinyinInitials, 
  filterByPinyinInitials 
} from '@/utils/pinyin';

// 获取拼音首字母
const initials = getPinyinInitials("张三"); // 返回: "ZS"

// 检查是否匹配
const matched = matchPinyinInitials("张三", "ZS"); // 返回: true

// 过滤选项数组
const options = [
  { label: "张三", value: "zhangsan" },
  { label: "李四", value: "lisi" }
];
const filtered = filterByPinyinInitials(options, "ZS");
// 返回: [{ label: "张三", value: "zhangsan" }]
```

## 📝 使用示例

### 示例 1：搜索组织名称

**用户输入**：`ZS`

**匹配结果**：
- ✅ "张三公司" (拼音首字母: ZS)
- ✅ "赵四企业" (拼音首字母: ZS)
- ❌ "李四公司" (拼音首字母: LS)

### 示例 2：搜索用户姓名

**用户输入**：`LS`

**匹配结果**：
- ✅ "李四" (拼音首字母: LS)
- ✅ "刘三" (拼音首字母: LS)
- ❌ "张三" (拼音首字母: ZS)

### 示例 3：混合搜索

**用户输入**：`张三`

**匹配结果**：
- ✅ "张三" (文本匹配)
- ✅ "张三公司" (文本匹配)
- ✅ "ZS" (如果数据库中有 "ZS" 这个值，也会匹配)

## ⚠️ 注意事项

1. **性能考虑**：
   - 拼音首字母匹配在应用层进行，对于大数据量可能影响性能
   - 建议在生产环境中为需要拼音搜索的字段添加拼音首字母索引字段

2. **多音字处理**：
   - 当前实现使用 `pypinyin` 的默认多音字处理
   - 对于特殊的多音字，可能需要手动处理

3. **可选依赖**：
   - 如果未安装 `pypinyin`（后端）或 `pinyin-pro`（前端），功能会自动降级为普通文本搜索
   - 不会影响现有功能

4. **数据库优化建议**：
   - 对于需要频繁拼音搜索的字段，建议在数据库中添加拼音首字母字段
   - 在数据插入/更新时自动填充拼音首字母
   - 在数据库层面进行拼音首字母匹配，性能更好

## 🔍 实现原理

### 后端实现

1. **识别拼音首字母**：使用 `is_pinyin_keyword()` 判断输入是否为拼音首字母格式
2. **文本匹配**：首先进行普通的文本匹配（数据库查询）
3. **拼音匹配**：如果识别为拼音首字母，在应用层进行二次过滤
4. **结果合并**：返回文本匹配和拼音匹配的结果

### 前端实现

1. **识别拼音首字母**：使用 `isPinyinKeyword()` 判断输入是否为拼音首字母格式
2. **文本匹配**：首先进行普通的文本匹配
3. **拼音匹配**：如果识别为拼音首字母，使用 `matchPinyinInitials()` 进行拼音匹配
4. **结果合并**：返回文本匹配和拼音匹配的结果

## 📚 相关文档

- [search_utils.py](./search_utils.py) - 通用搜索工具
- [pinyin_utils.py](./pinyin_utils.py) - 拼音工具模块
- [SEARCH_UTILS_README.md](./SEARCH_UTILS_README.md) - 搜索工具使用指南

## 🎯 总结

拼音首字母搜索功能已集成到通用搜索工具中，**无需额外配置即可使用**。只需：

1. 安装依赖：`pypinyin`（后端）和 `pinyin-pro`（前端）
2. 使用 `list_with_search` 函数（后端）或自动完成组件（前端）
3. 输入拼音首字母即可搜索中文内容

**示例**：输入 "ZS" 可以搜索到 "张三"、"赵四" 等拼音首字母为 "ZS" 的内容。

