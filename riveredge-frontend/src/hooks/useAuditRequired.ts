import { useQuery } from '@tanstack/react-query';
import { getAuditRequiredMap } from '../services/businessConfig';

export function useAuditRequiredMap() {
  return useQuery({
    queryKey: ['businessConfigAuditRequiredMap'],
    queryFn: getAuditRequiredMap,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuditRequired(nodeKey: string, defaultValue = false): boolean {
  const { data } = useAuditRequiredMap();
  if (!nodeKey) return defaultValue;
  const val = data?.[nodeKey];
  return typeof val === 'boolean' ? val : defaultValue;
}

/**
 * 是否启用**人工**审批流。
 * false = 审核关闭（自动通过模式）：提交后后端写入已通过，UI 仍展示 audit.phase，不提供人工审/反审按钮。
 */
export function useManualAuditRequired(nodeKey: string, defaultValue = false): boolean {
  return useAuditRequired(nodeKey, defaultValue);
}
