import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, InputNumber, Space } from 'antd';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { managementReportService } from '../../../services/management-report';
import type { MarginReportRow } from '../../../types/management-report';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  marginReportCustomerSearchColumns,
  marginReportOrderSearchColumns,
  marginReportProductSearchColumns,
  resolveMarginReportListParams,
} from '../../../utils/managementListCore';

type Dimension = 'product' | 'customer' | 'order';

const MarginTable: React.FC<{ dimension: Dimension; days: number }> = ({ dimension, days }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});

  useEffect(() => {
    actionRef.current?.reload();
  }, [days]);

  const columns: ProColumns<MarginReportRow>[] = useMemo(() => {
    const marginRateCol: ProColumns<MarginReportRow> = {
      title: t('app.kuaicaiwu.marginReport.col.grossMarginRate'),
      dataIndex: 'gross_margin_rate',
      align: 'right',
      hideInSearch: true,
      sorter: true,
      render: (_, r) => `${((Number(r.gross_margin_rate) || 0) * 100).toFixed(2)}%`,
    };
    const sharedCols: ProColumns<MarginReportRow>[] = [
      {
        title: t('app.kuaicaiwu.marginReport.col.revenue'),
        dataIndex: 'revenue',
        valueType: 'money',
        align: 'right',
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.marginReport.col.cost'),
        dataIndex: 'cost',
        valueType: 'money',
        align: 'right',
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.marginReport.col.grossMargin'),
        dataIndex: 'gross_margin',
        valueType: 'money',
        align: 'right',
        hideInSearch: true,
        sorter: true,
      },
      marginRateCol,
    ];

    if (dimension === 'product') {
      return [
        ...marginReportProductSearchColumns({
          productCode: t('app.kuaicaiwu.marginReport.col.productCode'),
          productName: t('app.kuaicaiwu.marginReport.col.productName'),
        }),
        {
          title: t('app.kuaicaiwu.marginReport.col.productCode'),
          dataIndex: 'product_code',
          width: 120,
          minWidth: 120,
          uniTableKeepWidth: true,
          resizable: false,
          hideInSearch: true,
          sorter: true,
        },
        {
          title: t('app.kuaicaiwu.marginReport.col.productName'),
          dataIndex: 'product_name',
          ellipsis: true,
          hideInSearch: true,
          sorter: true,
        },
        ...sharedCols,
      ];
    }
    if (dimension === 'customer') {
      return [
        ...marginReportCustomerSearchColumns(t('app.kuaicaiwu.marginReport.col.customer')),
        {
          title: t('app.kuaicaiwu.marginReport.col.customer'),
          dataIndex: 'customer_name',
          ellipsis: true,
          hideInSearch: true,
          sorter: true,
        },
        ...sharedCols,
      ];
    }
    return [
      ...marginReportOrderSearchColumns({
        orderNo: t('app.kuaicaiwu.marginReport.col.orderNo'),
        deliveryNote: t('app.kuaicaiwu.marginReport.col.deliveryNote'),
      }),
      {
        title: t('app.kuaicaiwu.marginReport.col.orderNo'),
        dataIndex: 'sales_order_code',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.marginReport.col.deliveryNote'),
        dataIndex: 'delivery_code',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      ...sharedCols,
    ];
  }, [dimension, t]);

  return (
    <UniTable<MarginReportRow>
      actionRef={actionRef}
      rowKey={(r, i) => String(r.product_id ?? r.customer_id ?? r.delivery_id ?? i)}
      columnPersistenceId={`apps.kuaicaiwu.pages.management-analysis.margin-report.${dimension}.list-v1`}
      columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
      showAdvancedSearch
      skipFuzzyPinyinClientFilter
      toolBarRender={false}
      request={async (params, sort, _filter, searchFormValues) => {
        const listParams = resolveMarginReportListParams(searchFormValues, sort, dimension);
        lastListParamsRef.current = listParams;
        const skip = ((params.current ?? 1) - 1) * (params.pageSize ?? 20);
        const limit = params.pageSize ?? 20;
        try {
          const fetchParams = { days, skip, limit, ...listParams };
          const res =
            dimension === 'product'
              ? await managementReportService.getMarginByProduct(fetchParams)
              : dimension === 'customer'
                ? await managementReportService.getMarginByCustomer(fetchParams)
                : await managementReportService.getMarginByOrder(fetchParams);
          return { data: res.items, success: true, total: res.total };
        } catch (error: unknown) {
          const err = error as { message?: string };
          messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
          return { data: [], success: false, total: 0 };
        }
      }}
    />
  );
};

const MarginReportPage: React.FC = () => {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [dimension, setDimension] = useState<Dimension>('product');

  const tabBarExtraContent = useMemo(
    () => (
      <Space>
        <span>{t('app.kuaicaiwu.marginReport.statsDays')}</span>
        <InputNumber min={7} max={365} value={days} onChange={(v) => setDays(Number(v) || 30)} />
      </Space>
    ),
    [days, t],
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={dimension}
      onTabChange={(key) => setDimension(key as Dimension)}
      tabBarExtraContent={tabBarExtraContent}
      tabs={[
        { key: 'product', label: t('app.kuaicaiwu.marginReport.tab.product'), children: <MarginTable dimension="product" days={days} /> },
        { key: 'customer', label: t('app.kuaicaiwu.marginReport.tab.customer'), children: <MarginTable dimension="customer" days={days} /> },
        { key: 'order', label: t('app.kuaicaiwu.marginReport.tab.order'), children: <MarginTable dimension="order" days={days} /> },
      ]}
    />
  );
};

export default MarginReportPage;
