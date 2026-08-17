import { useQuery } from '@tanstack/react-query';
import {
  getBusinessConfig,
  isDetailFullChainEnabled,
  isDetailOperationLogEnabled,
  resolveDetailFullChainMode,
  type DetailFullChainMode,
} from '../services/businessConfig';

export const DETAIL_DRAWER_FEATURES_QUERY_KEY = ['businessConfigDetailDrawerFeatures'] as const;

/** 读取详情抽屉展示开关（全链路 / 操作记录） */
export function useDetailDrawerFeaturesQuery() {
  return useQuery({
    queryKey: DETAIL_DRAWER_FEATURES_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export type DetailDrawerFeatures = {
  /** 全链路模式：off 隐藏 Tab；documents_only 展示单据图且不显示节点时间 */
  fullChainMode: DetailFullChainMode;
  fullChainEnabled: boolean;
  /** documents_only 时为 false（抽屉全链路不展示创建时间） */
  fullChainShowCreatedAt: boolean;
  operationLogEnabled: boolean;
};

/**
 * 详情抽屉能力开关。
 * 未加载完成时默认全链路为 documents_only、操作记录开启，避免配置未到时短暂隐藏。
 */
export function useDetailDrawerFeatures(): DetailDrawerFeatures {
  const { data } = useDetailDrawerFeaturesQuery();
  const fullChainMode = resolveDetailFullChainMode(data);
  return {
    fullChainMode,
    fullChainEnabled: isDetailFullChainEnabled(data),
    fullChainShowCreatedAt: false,
    operationLogEnabled: isDetailOperationLogEnabled(data),
  };
}
