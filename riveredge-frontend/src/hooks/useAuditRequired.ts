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
