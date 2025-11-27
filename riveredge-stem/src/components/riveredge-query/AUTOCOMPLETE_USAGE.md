# 搜索条件自动完成功能使用指南

## 📋 概述

搜索组件已集成 **Ant Design 原生的 AutoComplete 组件**，支持在搜索条件中提供自动完成功能，提升用户体验。

## 🚀 快速开始

### 方式 1：静态选项（推荐用于固定选项）

```typescript
const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      // 静态自动完成选项
      autoCompleteOptions: [
        { label: '测试组织1', value: '测试组织1' },
        { label: '测试组织2', value: '测试组织2' },
        { label: '生产组织', value: '生产组织' },
      ],
    },
  },
];
```

### 方式 2：异步 API 获取选项（推荐用于动态数据）

```typescript
import { getTenantList } from '@/services/tenant';

const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      // 异步获取自动完成选项
      autoCompleteApi: async (keyword: string) => {
        const result = await getTenantList({
          page: 1,
          page_size: 20,
          keyword: keyword,
        });
        // 返回选项数组
        return result.items.map((tenant) => ({
          label: tenant.name,
          value: tenant.name,
        }));
      },
    },
  },
];
```

### 方式 3：完全自定义配置

```typescript
const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      // 直接配置 AutoComplete 的所有属性
      autoComplete: {
        options: [
          { label: '选项1', value: 'value1' },
          { label: '选项2', value: 'value2' },
        ],
        onSearch: (keyword: string) => {
          // 自定义搜索逻辑
          console.log('搜索:', keyword);
        },
        filterOption: (inputValue, option) => {
          // 自定义过滤逻辑
          return option?.label?.toLowerCase().includes(inputValue.toLowerCase()) ?? false;
        },
      },
    },
  },
];
```

## 📖 配置说明

### 配置项优先级

1. **`autoComplete`** - 最高优先级，直接传递给 AutoComplete 组件
2. **`autoCompleteApi`** - 异步 API 获取选项
3. **`autoCompleteOptions`** - 静态选项数组

### 配置参数

#### `autoCompleteOptions` - 静态选项

```typescript
interface AutoCompleteOption {
  label: string;  // 显示文本
  value: string;  // 选项值
}

fieldProps: {
  autoCompleteOptions: AutoCompleteOption[];
}
```

**特点**：
- ✅ 简单快速，适合固定选项
- ✅ 支持本地过滤（根据输入关键词自动过滤）
- ❌ 选项数量有限，不适合大量数据

#### `autoCompleteApi` - 异步 API

```typescript
fieldProps: {
  autoCompleteApi: (keyword: string) => Promise<Array<{ label: string; value: string }>>;
}
```

**特点**：
- ✅ 支持大量数据
- ✅ 实时从后端获取选项
- ✅ 支持复杂搜索逻辑
- ⚠️ 需要后端 API 支持

**API 函数要求**：
- 接收一个 `keyword` 参数（搜索关键词）
- 返回 `Promise<Array<{ label: string; value: string }>>`
- 建议限制返回数量（如最多 20 条）

#### `autoComplete` - 完全自定义

```typescript
import type { AutoCompleteProps } from 'antd';

fieldProps: {
  autoComplete: AutoCompleteProps;
}
```

**特点**：
- ✅ 完全控制 AutoComplete 的行为
- ✅ 可以使用所有 Ant Design AutoComplete 的属性
- ⚠️ 需要手动处理所有逻辑

## 💡 完整示例

### 示例 1：组织列表 - 组织名称自动完成

```typescript
import { getTenantList } from '@/services/tenant';

const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      // 异步获取组织名称选项
      autoCompleteApi: async (keyword: string) => {
        if (!keyword || keyword.length < 2) {
          return []; // 至少输入 2 个字符才搜索
        }
        const result = await getTenantList({
          page: 1,
          page_size: 20,
          keyword: keyword,
        });
        return result.items.map((tenant) => ({
          label: `${tenant.name} (${tenant.domain})`,
          value: tenant.name,
        }));
      },
    },
  },
  {
    title: '域名',
    dataIndex: 'domain',
    fieldProps: {
      // 静态域名选项（示例）
      autoCompleteOptions: [
        { label: 'example.com', value: 'example' },
        { label: 'test.com', value: 'test' },
      ],
    },
  },
];
```

### 示例 2：用户列表 - 用户名和邮箱自动完成

```typescript
import { getUserList } from '@/services/user';

const columns: ProColumns<User>[] = [
  {
    title: '用户名',
    dataIndex: 'username',
    fieldProps: {
      autoCompleteApi: async (keyword: string) => {
        if (!keyword || keyword.length < 2) {
          return [];
        }
        const result = await getUserList({
          page: 1,
          page_size: 20,
          keyword: keyword,
        });
        return result.items.map((user) => ({
          label: `${user.username} (${user.email || '无邮箱'})`,
          value: user.username,
        }));
      },
    },
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    fieldProps: {
      autoCompleteApi: async (keyword: string) => {
        if (!keyword || keyword.length < 2) {
          return [];
        }
        const result = await getUserList({
          page: 1,
          page_size: 20,
          keyword: keyword,
        });
        return result.items
          .filter((user) => user.email)
          .map((user) => ({
            label: user.email!,
            value: user.email!,
          }));
      },
    },
  },
];
```

### 示例 3：使用完全自定义配置

```typescript
const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      autoComplete: {
        options: [
          { label: '测试组织', value: 'test' },
          { label: '生产组织', value: 'prod' },
        ],
        onSearch: (keyword: string) => {
          console.log('搜索关键词:', keyword);
          // 自定义搜索逻辑
        },
        filterOption: (inputValue, option) => {
          // 自定义过滤逻辑
          return option?.label?.toLowerCase().includes(inputValue.toLowerCase()) ?? false;
        },
        placeholder: '请输入或选择组织名称',
        allowClear: true,
        style: { width: '100%' },
      },
    },
  },
];
```

## ⚙️ 高级用法

### 防抖优化（减少 API 调用）

```typescript
import { debounce } from 'lodash-es';

// 创建防抖的 API 函数
const debouncedSearch = debounce(async (keyword: string) => {
  const result = await getTenantList({
    page: 1,
    page_size: 20,
    keyword: keyword,
  });
  return result.items.map((tenant) => ({
    label: tenant.name,
    value: tenant.name,
  }));
}, 300); // 300ms 防抖

const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      autoCompleteApi: debouncedSearch,
    },
  },
];
```

### 缓存选项（提升性能）

```typescript
const optionCache = new Map<string, Array<{ label: string; value: string }>>();

const columns: ProColumns<Tenant>[] = [
  {
    title: '组织名称',
    dataIndex: 'name',
    fieldProps: {
      autoCompleteApi: async (keyword: string) => {
        // 检查缓存
        if (optionCache.has(keyword)) {
          return optionCache.get(keyword)!;
        }
        
        // 获取数据
        const result = await getTenantList({
          page: 1,
          page_size: 20,
          keyword: keyword,
        });
        const options = result.items.map((tenant) => ({
          label: tenant.name,
          value: tenant.name,
        }));
        
        // 缓存结果
        optionCache.set(keyword, options);
        return options;
      },
    },
  },
];
```

## 🎯 最佳实践

1. **使用异步 API**：对于动态数据，优先使用 `autoCompleteApi`
2. **限制返回数量**：API 返回的选项建议限制在 20 条以内
3. **最小输入长度**：建议至少输入 2 个字符才开始搜索
4. **防抖优化**：使用防抖减少 API 调用频率
5. **错误处理**：API 函数应该包含错误处理逻辑
6. **加载状态**：组件自动显示加载状态，无需手动处理

## 📝 注意事项

1. **选项格式**：选项必须包含 `label` 和 `value` 字段
2. **API 性能**：异步 API 应该快速响应，建议使用索引或缓存
3. **空值处理**：当输入为空时，`autoCompleteApi` 不会被调用
4. **错误处理**：API 函数应该处理错误，返回空数组而不是抛出异常

## 🔗 相关文档

- [Ant Design AutoComplete 文档](https://ant.design/components/auto-complete-cn/)
- [ProComponents 文档](https://procomponents.ant.design/)

