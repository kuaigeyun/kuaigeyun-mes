/**
 * 快捷操作工具模块
 *
 * 提供常用操作的快捷方式，减少操作步骤，提升用户体验。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import { message } from 'antd';
import { history } from '@umijs/max';

/**
 * 快捷操作类型
 */
export type QuickActionType = 
  | 'create'           // 创建
  | 'edit'             // 编辑
  | 'delete'           // 删除
  | 'view'             // 查看
  | 'export'           // 导出
  | 'import'           // 导入
  | 'batch'            // 批量操作
  | 'copy'             // 复制
  | 'duplicate';       //  duplicate

/**
 * 快捷操作配置
 */
export interface QuickActionConfig {
  /** 操作类型 */
  type: QuickActionType;
  /** 操作名称 */
  name: string;
  /** 操作图标 */
  icon?: string;
  /** 操作描述 */
  description?: string;
  /** 是否显示在快捷菜单 */
  showInMenu?: boolean;
  /** 快捷键（如 'Ctrl+N'） */
  shortcut?: string;
  /** 操作处理函数 */
  handler: () => void | Promise<void>;
}

/**
 * 快捷操作助手类
 */
export class QuickActionHelper {
  private static actions: Map<string, QuickActionConfig> = new Map();
  private static history: Array<{ action: string; timestamp: number }> = [];

  /**
   * 注册快捷操作
   */
  static register(key: string, config: QuickActionConfig): void {
    this.actions.set(key, config);
  }

  /**
   * 执行快捷操作
   */
  static async execute(key: string): Promise<void> {
    const action = this.actions.get(key);
    if (!action) {
      message.warning(`快捷操作 "${key}" 不存在`);
      return;
    }

    try {
      await action.handler();
      // 记录操作历史
      this.history.push({
        action: key,
        timestamp: Date.now()
      });
      // 只保留最近100条记录
      if (this.history.length > 100) {
        this.history.shift();
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
      console.error('快捷操作执行失败:', error);
    }
  }

  /**
   * 获取快捷操作列表
   */
  static getActions(): QuickActionConfig[] {
    return Array.from(this.actions.values());
  }

  /**
   * 获取最近使用的操作
   */
  static getRecentActions(limit: number = 5): QuickActionConfig[] {
    const recent = this.history
      .slice(-limit)
      .reverse()
      .map(item => this.actions.get(item.action))
      .filter(Boolean) as QuickActionConfig[];
    
    return recent;
  }

  /**
   * 清除操作历史
   */
  static clearHistory(): void {
    this.history = [];
  }
}

/**
 * 智能表单填充工具
 */
export class SmartFormFill {
  /**
   * 基于历史数据智能填充表单
   */
  static fillFromHistory<T extends Record<string, any>>(
    formData: T,
    historyData: T[],
    fields: (keyof T)[]
  ): Partial<T> {
    if (!historyData || historyData.length === 0) {
      return {};
    }

    const filledData: Partial<T> = {};

    // 对于每个字段，使用最近一次非空值
    fields.forEach(field => {
      // 从最近的记录开始查找
      for (let i = historyData.length - 1; i >= 0; i--) {
        const value = historyData[i][field];
        if (value !== null && value !== undefined && value !== '') {
          filledData[field] = value;
          break;
        }
      }
    });

    return filledData;
  }

  /**
   * 基于用户偏好填充表单
   */
  static fillFromPreferences<T extends Record<string, any>>(
    formData: T,
    preferences: Partial<T>,
    fields: (keyof T)[]
  ): Partial<T> {
    const filledData: Partial<T> = {};

    fields.forEach(field => {
      if (preferences[field] !== undefined) {
        filledData[field] = preferences[field];
      }
    });

    return filledData;
  }

  /**
   * 基于模板填充表单
   */
  static fillFromTemplate<T extends Record<string, any>>(
    template: Partial<T>,
    formData: T
  ): Partial<T> {
    return { ...template };
  }
}

/**
 * 操作历史记录工具
 */
export class OperationHistory {
  private static storageKey = 'riveredge_operation_history';
  private static maxHistorySize = 50;

  /**
   * 记录操作
   */
  static record(operation: {
    type: string;
    module: string;
    action: string;
    data?: any;
  }): void {
    try {
      const history = this.getHistory();
      history.unshift({
        ...operation,
        timestamp: Date.now()
      });

      // 限制历史记录数量
      if (history.length > this.maxHistorySize) {
        history.splice(this.maxHistorySize);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('记录操作历史失败:', error);
    }
  }

  /**
   * 获取操作历史
   */
  static getHistory(): Array<{
    type: string;
    module: string;
    action: string;
    data?: any;
    timestamp: number;
  }> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('获取操作历史失败:', error);
      return [];
    }
  }

  /**
   * 获取最近的操作
   */
  static getRecent(module?: string, limit: number = 10): Array<{
    type: string;
    module: string;
    action: string;
    data?: any;
    timestamp: number;
  }> {
    const history = this.getHistory();
    let filtered = history;

    if (module) {
      filtered = history.filter(item => item.module === module);
    }

    return filtered.slice(0, limit);
  }

  /**
   * 清除操作历史
   */
  static clear(module?: string): void {
    try {
      if (module) {
        const history = this.getHistory();
        const filtered = history.filter(item => item.module !== module);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      } else {
        localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.error('清除操作历史失败:', error);
    }
  }
}

/**
 * 批量操作增强工具
 */
export class BatchOperationEnhancement {
  /**
   * 批量操作进度跟踪
   */
  static trackProgress(
    total: number,
    onProgress?: (current: number, total: number, success: number, fail: number) => void
  ) {
    let current = 0;
    let success = 0;
    let fail = 0;

    return {
      increment: (isSuccess: boolean = true) => {
        current++;
        if (isSuccess) {
          success++;
        } else {
          fail++;
        }
        if (onProgress) {
          onProgress(current, total, success, fail);
        }
      },
      getProgress: () => ({
        current,
        total,
        success,
        fail,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0
      })
    };
  }

  /**
   * 批量操作结果汇总
   */
  static summarizeResult(result: {
    success_count: number;
    failed_count: number;
    errors?: Array<{ index: number; error: string }>;
  }): string {
    const { success_count, failed_count, errors } = result;
    const total = success_count + failed_count;

    if (failed_count === 0) {
      return `全部成功：${success_count} 条记录`;
    } else if (success_count === 0) {
      return `全部失败：${failed_count} 条记录`;
    } else {
      const errorSummary = errors && errors.length > 0
        ? `\n失败详情：\n${errors.slice(0, 5).map(e => `  第${e.index + 1}条：${e.error}`).join('\n')}${errors.length > 5 ? `\n  ... 还有${errors.length - 5}条错误` : ''}`
        : '';
      return `部分成功：成功 ${success_count} 条，失败 ${failed_count} 条${errorSummary}`;
    }
  }
}

/**
 * 快速导航工具
 */
export class QuickNavigation {
  /**
   * 快速跳转到创建页面
   */
  static toCreate(module: string, params?: Record<string, any>): void {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    history.push(`/${module}/create${query}`);
  }

  /**
   * 快速跳转到编辑页面
   */
  static toEdit(module: string, id: string | number, params?: Record<string, any>): void {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    history.push(`/${module}/${id}/edit${query}`);
  }

  /**
   * 快速跳转到详情页面
   */
  static toDetail(module: string, id: string | number, params?: Record<string, any>): void {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    history.push(`/${module}/${id}${query}`);
  }

  /**
   * 快速跳转到列表页面
   */
  static toList(module: string, params?: Record<string, any>): void {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    history.push(`/${module}${query}`);
  }
}
