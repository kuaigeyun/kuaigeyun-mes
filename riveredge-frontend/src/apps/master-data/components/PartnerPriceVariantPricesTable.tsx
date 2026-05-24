/**
 * 价格本：属性 SKU 单价明细表（只读）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { scalarAttrDisplay } from './MaterialVariantCombinationsTable';
import { variantAttributeApi } from '../services/variant-attribute';
import type { PartnerPriceVariantLine } from '../types/partner-price-book';
import type { VariantAttributeDefinition } from '../types/variant-attribute';

export interface PartnerPriceVariantPricesTableProps {
  rows?: PartnerPriceVariantLine[];
  definitions?: VariantAttributeDefinition[];
  loading?: boolean;
}

export const PartnerPriceVariantPricesTable: React.FC<PartnerPriceVariantPricesTableProps> = ({
  rows = [],
  definitions: definitionsProp,
  loading: loadingProp,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [definitions, setDefinitions] = useState<VariantAttributeDefinition[]>(definitionsProp ?? []);
  const [loadingDefs, setLoadingDefs] = useState(false);

  useEffect(() => {
    if (definitionsProp) {
      setDefinitions(definitionsProp);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDefs(true);
      try {
        const list = await variantAttributeApi.list({ is_active: true });
        list.sort((a, b) => a.display_order - b.display_order);
        if (!cancelled) setDefinitions(list);
      } catch (error: any) {
        if (!cancelled) {
          messageApi.error(error?.message || t('app.master-data.materials.batchVariantLoadDefFailed'));
          setDefinitions([]);
        }
      } finally {
        if (!cancelled) setLoadingDefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [definitionsProp, messageApi, t]);

  const columns: ColumnsType<PartnerPriceVariantLine> = useMemo(
    () => [
      {
        title: '#',
        width: 48,
        align: 'center',
        render: (_value, _record, index) => index + 1,
      },
      ...definitions.map((def) => ({
        title: def.display_name,
        key: def.attribute_name,
        width: 110,
        ellipsis: true,
        render: (_: unknown, record: PartnerPriceVariantLine) => {
          const val = record.variantAttributes?.[def.attribute_name];
          const text = scalarAttrDisplay(val);
          return text || '—';
        },
      })),
      {
        title: t('app.master-data.priceBook.variantUnitPrice', 'SKU 单价'),
        dataIndex: 'unitPrice',
        width: 120,
        align: 'right' as const,
        render: (value: number | undefined) =>
          value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(4) : '—',
      },
    ],
    [definitions, t],
  );

  if (!loadingProp && !loadingDefs && definitions.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('app.master-data.materialForm.noVariantDef')}
      </Typography.Text>
    );
  }

  return (
    <Table<PartnerPriceVariantLine>
      size="small"
      bordered
      pagination={false}
      loading={loadingProp || loadingDefs}
      dataSource={rows}
      rowKey={(_, index) => String(index)}
      columns={columns}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: '—' }}
    />
  );
};
