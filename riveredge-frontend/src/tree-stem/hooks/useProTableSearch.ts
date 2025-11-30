/**
 * ProTable 搜索参数管理 Hook
 * 
 * 用于管理 ProTable 的搜索参数，解决 search={false} 时表单值更新时机问题
 * 
 * @example
 * ```tsx
 * const SuperAdminTenantList: React.FC = () => {
 *   const { searchParamsRef, formRef, actionRef } = useProTableSearch();
 *   
 *   return (
 *     <ProTable
 *       formRef={formRef}
 *       actionRef={actionRef}
 *       search={false}
 *       request={async (params, sort, filter) => {
 *         // 使用 searchParamsRef.current 获取搜索参数
 *         const searchFormValues = searchParamsRef.current || formRef.current?.getFieldsValue() || {};
 *         const mergedParams = { ...params, ...searchFormValues };
 *         // ... 处理搜索参数
 *       }}
 *     />
 *   );
 * };
 * ```
 */

import { useRef } from 'react';
import type { ActionType, ProFormInstance } from '@ant-design/pro-components';

/**
 * ProTable 搜索参数管理 Hook 返回值
 */
export interface UseProTableSearchReturn {
  /**
   * 搜索参数存储 ref（用于直接传递搜索参数，避免表单值更新时机问题）
   */
  searchParamsRef: React.MutableRefObject<Record<string, any> | undefined>;
  /**
   * ProTable 的 formRef
   */
  formRef: React.MutableRefObject<ProFormInstance | undefined>;
  /**
   * ProTable 的 actionRef
   */
  actionRef: React.MutableRefObject<ActionType | undefined>;
}

/**
 * ProTable 搜索参数管理 Hook
 * 
 * 提供统一的搜索参数管理机制，解决 search={false} 时表单值更新时机问题
 * 
 * @returns {UseProTableSearchReturn} 搜索参数管理相关的 ref
 */
export function useProTableSearch(): UseProTableSearchReturn {
  const searchParamsRef = useRef<Record<string, any> | undefined>(undefined);
  const formRef = useRef<ProFormInstance>();
  const actionRef = useRef<ActionType>();

  return {
    searchParamsRef,
    formRef,
    actionRef,
  };
}

