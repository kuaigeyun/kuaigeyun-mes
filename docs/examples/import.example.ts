/**
 * 导入工具函数使用示例
 * 
 * 展示如何使用通用导入处理函数简化导入逻辑
 */

import { handleImport, ImportConfig } from './import';
import { generateImportConfigFromColumns } from '../components/uni-table';
import { ProColumns } from '@ant-design/pro-components';
import { apiRequest } from '../services/api';
import { ActionType } from '@ant-design/pro-components';

/**
 * 示例1：使用通用导入函数（推荐方式）
 * 
 * 这种方式可以大大简化导入逻辑，只需要配置字段映射和验证规则
 */
export async function exampleHandleImport1(
  rawData: any[][],
  actionRef: React.RefObject<ActionType>
) {
  // 定义导入配置
  const config: ImportConfig = {
    // 字段映射（从表头名称映射到字段名）
    fieldMap: {
      '组织名称': 'name',
      '*组织名称': 'name',
      '名称': 'name',
      '域名': 'domain',
      '*域名': 'domain',
      '套餐类型': 'plan',
      '状态': 'status',
      '最大用户数': 'max_users',
      '存储空间(MB)': 'max_storage',
      '过期时间': 'expires_at',
    },
    // 必需字段
    requiredFields: ['name', 'domain'],
    // 字段验证规则
    fieldRules: {
      domain: {
        required: true,
        validator: (value: any) => {
          const domainRegex = /^[a-zA-Z0-9_-]+$/;
          if (!domainRegex.test(value)) {
            return '域名格式不正确（只能包含字母、数字、下划线、连字符）';
          }
          return true;
        },
      },
      max_users: {
        transform: (value: any) => {
          return value ? parseInt(value, 10) : undefined;
        },
      },
      max_storage: {
        transform: (value: any) => {
          return value ? parseInt(value, 10) : undefined;
        },
      },
      expires_at: {
        transform: (value: any) => {
          if (!value) return undefined;
          const date = new Date(value);
          return !isNaN(date.getTime()) ? date.toISOString() : undefined;
        },
      },
    },
    // 枚举值映射
    enumMaps: {
      plan: {
        'trial': 'TRIAL',
        '体验套餐': 'TRIAL',
        '体验': 'TRIAL',
        'basic': 'BASIC',
        '基础版': 'BASIC',
        '基础': 'BASIC',
        'professional': 'PROFESSIONAL',
        '专业版': 'PROFESSIONAL',
        '专业': 'PROFESSIONAL',
        'enterprise': 'ENTERPRISE',
        '企业版': 'ENTERPRISE',
        '企业': 'ENTERPRISE',
      },
      status: {
        'active': 'ACTIVE',
        '激活': 'ACTIVE',
        'inactive': 'INACTIVE',
        '未激活': 'INACTIVE',
        'expired': 'EXPIRED',
        '已过期': 'EXPIRED',
        'suspended': 'SUSPENDED',
        '已暂停': 'SUSPENDED',
      },
    },
  };

  // 导入函数（单个数据项的导入逻辑）
  const importFn = async (data: any, rowIndex: number) => {
    return await apiRequest('/infra/tenants', {
      method: 'POST',
      data,
    });
  };

  // 使用通用导入函数
  await handleImport(rawData, config, importFn, {
    title: '正在导入组织数据',
    successMessage: '成功导入组织数据',
    onOk: () => {
      // 刷新表格
      actionRef.current?.reload();
    },
  });
}

/**
 * 示例2：结合自动生成配置（最简化方式）
 * 
 * 如果表格列定义完整，可以自动生成大部分配置
 */
export async function exampleHandleImport2(
  rawData: any[][],
  columns: ProColumns<any>[],
  actionRef: React.RefObject<ActionType>
) {
  // 自动生成基础配置
  const autoConfig = generateImportConfigFromColumns(columns, {
    excludeFields: ['id', 'created_at', 'updated_at'],
  });

  // 扩展配置（添加自定义验证和枚举映射）
  const config: ImportConfig = {
    fieldMap: autoConfig.fieldMap,
    requiredFields: ['name', 'domain'], // 从 fieldRules 中提取
    fieldRules: {
      ...autoConfig.fieldRules,
      domain: {
        required: true,
        validator: (value: any) => {
          const domainRegex = /^[a-zA-Z0-9_-]+$/;
          if (!domainRegex.test(value)) {
            return '域名格式不正确（只能包含字母、数字、下划线、连字符）';
          }
          return true;
        },
      },
    },
    enumMaps: {
      plan: {
        'trial': 'TRIAL',
        '体验套餐': 'TRIAL',
        'basic': 'BASIC',
        '基础版': 'BASIC',
        'professional': 'PROFESSIONAL',
        '专业版': 'PROFESSIONAL',
        'enterprise': 'ENTERPRISE',
        '企业版': 'ENTERPRISE',
      },
      status: {
        'active': 'ACTIVE',
        '激活': 'ACTIVE',
        'inactive': 'INACTIVE',
        '未激活': 'INACTIVE',
      },
    },
  };

  const importFn = async (data: any) => {
    return await apiRequest('/infra/tenants', {
      method: 'POST',
      data,
    });
  };

  await handleImport(rawData, config, importFn, {
    title: '正在导入组织数据',
    onOk: () => {
      actionRef.current?.reload();
    },
  });
}

/**
 * 示例3：分步骤使用（更灵活的控制）
 * 
 * 如果需要更细粒度的控制，可以分步骤使用各个函数
 */
export async function exampleHandleImport3(
  rawData: any[][],
  actionRef: React.RefObject<ActionType>
) {
  const config: ImportConfig = {
    fieldMap: {
      '组织名称': 'name',
      '域名': 'domain',
    },
    requiredFields: ['name', 'domain'],
  };

  // 步骤1：解析和验证数据
  const { parseImportData, showValidationErrors } = await import('./import');
  const { data, errors } = parseImportData(rawData, config);

  if (errors.length > 0) {
    showValidationErrors(errors);
    return;
  }

  // 步骤2：批量导入（可以自定义进度回调）
  const { batchImport } = await import('./import');
  const results = await batchImport(
    data,
    async (itemData) => {
      return await apiRequest('/infra/tenants', {
        method: 'POST',
        data: itemData,
      });
    },
    {
      title: '正在导入组织数据',
      onProgress: (current, total, success, fail) => {
        console.log(`进度: ${current}/${total}, 成功: ${success}, 失败: ${fail}`);
      },
    }
  );

  // 步骤3：显示结果
  const { showImportResults } = await import('./import');
  showImportResults(results, {
    onOk: () => {
      actionRef.current?.reload();
    },
  });
}

