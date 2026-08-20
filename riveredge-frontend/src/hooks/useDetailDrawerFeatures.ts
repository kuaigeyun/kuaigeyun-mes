import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBusinessConfig,
  isDetailBasicUpdatedAtEnabled,
  isDetailFullChainEnabled,
  isDetailFullChainShowCreatedAt,
  isDetailOperationLogEnabled,
  resolveDetailFullChainMode,
  resolveDetailTimeFieldHiddenMap,
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
  /** 全链路模式：off 隐藏 Tab；on 正常展示含时间；documents_only 仅单据节点 */
  fullChainMode: DetailFullChainMode;
  fullChainEnabled: boolean;
  /** 仅 on 时为 true（抽屉全链路展示节点创建时间） */
  fullChainShowCreatedAt: boolean;
  operationLogEnabled: boolean;
  /** 基本信息是否展示更新时间 */
  basicUpdatedAtEnabled: boolean;
  /** 单据时间字段隐藏表（true = 不显示） */
  timeFieldHidden: Record<string, boolean>;
};

/**
 * 详情抽屉能力开关。
 * 未加载完成时默认全链路为 documents_only、操作记录开启，避免配置未到时短暂隐藏。
 */
export function useDetailDrawerFeatures(): DetailDrawerFeatures {
  const { data } = useDetailDrawerFeaturesQuery();
  const fullChainMode = resolveDetailFullChainMode(data);
  const timeFieldHidden = useMemo(() => resolveDetailTimeFieldHiddenMap(data), [data]);
  return {
    fullChainMode,
    fullChainEnabled: isDetailFullChainEnabled(data),
    fullChainShowCreatedAt: isDetailFullChainShowCreatedAt(data),
    operationLogEnabled: isDetailOperationLogEnabled(data),
    basicUpdatedAtEnabled: isDetailBasicUpdatedAtEnabled(data),
    timeFieldHidden,
  };
}
