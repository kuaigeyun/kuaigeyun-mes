/**
 * 检验四单据详情抽屉：与来料检验一致的字段顺序片段。
 * 本单号 / 关联单号不要 dummy render，交给 detailDrawerDescriptionItems 挂链。
 * 单据 status 由协作区生命周期展示，基本信息只保留质量结果类徽章。
 */

import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import {
  renderQualityQualityStatusTag,
  renderQualityResultTag,
} from './qualityMeta';

export function buildQualityInspectionDetailCodeColumn<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
    dataIndex: 'inspection_code',
  };
}

export function buildQualityInspectionDetailMaterialColumns<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T>[] {
  return [
    { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'material_code' },
    { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name' },
  ];
}

export function buildQualityInspectionDetailQuantityStatusColumns<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T>[] {
  const renderQtyWithUnit = (qty: unknown, record: T) =>
    formatQuantityWithUnit(qty, (record as { material_unit?: string }).material_unit);

  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
      dataIndex: 'inspection_quantity',
      render: (_, r) => renderQtyWithUnit(r.inspection_quantity, r),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
      dataIndex: 'qualified_quantity',
      render: (_, r) => renderQtyWithUnit(r.qualified_quantity, r),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      render: (_, r) => renderQtyWithUnit(r.unqualified_quantity, r),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
      dataIndex: 'quality_status',
      render: (_, r) => renderQualityQualityStatusTag(t, String(r.quality_status ?? '')),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
      dataIndex: 'inspection_result',
      render: (_, r) => renderQualityResultTag(t, String(r.inspection_result ?? '')),
    },
  ];
}

export function buildQualityInspectionDetailPeopleColumns<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T>[] {
  return [
    { title: t('app.kuaizhizao.quality.common.columns.inspector'), dataIndex: 'inspector_name' },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionTime'),
      dataIndex: 'inspection_time',
      valueType: 'dateTime',
    },
    { title: t('app.kuaizhizao.quality.common.columns.reviewer'), dataIndex: 'reviewer_name' },
    {
      title: t('app.kuaizhizao.quality.common.columns.reviewTime'),
      dataIndex: 'review_time',
      valueType: 'dateTime',
    },
  ];
}

export function buildQualityInspectionDetailNotesColumn<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionNotes'),
    dataIndex: 'notes',
    span: 2,
  };
}
