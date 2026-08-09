/**
 * 检验四单据详情抽屉：与来料检验一致的字段顺序片段
 */

import React from 'react';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { Typography } from 'antd';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import {
  renderQualityDocStatusTag,
  renderQualityQualityStatusTag,
  renderQualityResultTag,
} from './qualityMeta';

export function buildQualityInspectionDetailCodeColumn<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
    dataIndex: 'inspection_code',
    render: (_, r) => (
      <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }}>
        {String(r.inspection_code ?? '-') }
      </Typography.Text>
    ),
  };
}

export function buildQualityInspectionDetailMaterialColumns<T extends Record<string, unknown>>(
  t: TFunction,
): ProDescriptionsItemProps<T>[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.materialCode'),
      dataIndex: 'material_code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.material_code ?? '') }}>
          {String(r.material_code ?? '-')}
        </Typography.Text>
      ),
    },
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
      title: t('app.kuaizhizao.quality.common.columns.inspectionStatus'),
      dataIndex: 'status',
      render: (_, r) => renderQualityDocStatusTag(t, String(r.status ?? '')),
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
    {
      title: t('app.kuaizhizao.quality.common.columns.reviewer'),
      dataIndex: 'reviewer_name',
      render: (val) => val || '-',
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.reviewTime'),
      dataIndex: 'review_time',
      valueType: 'dateTime',
      render: (val) => formatDateTimeBySiteSetting(val),
    },
  ];
}
