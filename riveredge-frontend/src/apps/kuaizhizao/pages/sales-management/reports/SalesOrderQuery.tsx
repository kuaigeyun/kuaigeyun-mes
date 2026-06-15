/**

 * 销售订单综合查询报表

 */

import React, { useMemo } from 'react';

import { ProColumns } from '@ant-design/pro-components';

import { Tag } from 'antd';

import { useTranslation } from 'react-i18next';

import KuaizhizaoReport from '../../../components/KuaizhizaoReport';



const SalesOrderQuery: React.FC = () => {

  const { t } = useTranslation();

  const columns: ProColumns[] = useMemo(

    () => [

      {

        title: t('app.kuaizhizao.reports.orderDateRange'),

        dataIndex: 'order_date_range',

        valueType: 'dateRange',

        hideInTable: true,

        search: { order: 10 } as any,

      },

      {

        title: t('app.kuaizhizao.reports.orderCode'),

        dataIndex: 'order_code',

        copyable: true,

        fixed: 'left',

        width: 150,

      },

      {

        title: t('app.kuaizhizao.reports.orderDate'),

        dataIndex: 'order_date',

        valueType: 'date',

        sorter: true,

        width: 120,

      },

      {

        title: t('app.kuaizhizao.reports.customerName'),

        dataIndex: 'customer_name',

        ellipsis: true,

        width: 150,

      },

      {

        title: t('app.kuaizhizao.reports.deliveryDateCol'),

        dataIndex: 'delivery_date',

        valueType: 'date',

        width: 120,

      },

      {

        title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),

        dataIndex: 'total_amount',

        valueType: 'money',

        width: 120,

      },

      {

        title: t('app.kuaizhizao.salesOrder.status'),

        dataIndex: 'status',

        width: 100,

        valueEnum: {

          DRAFT: { text: t('app.kuaizhizao.reports.orderStatusDraft'), status: 'Default' },

          CONFIRMED: { text: t('app.kuaizhizao.reports.orderStatusConfirmed'), status: 'Processing' },

          AUDITED: { text: t('app.kuaizhizao.reports.orderStatusAudited'), status: 'Success' },

          COMPLETED: { text: t('app.kuaizhizao.reports.orderStatusCompleted'), status: 'Success' },

          CANCELLED: { text: t('app.kuaizhizao.reports.orderStatusCancelled'), status: 'Error' },

        },

      },

      {

        title: t('app.kuaizhizao.salesOrder.reviewStatus'),

        dataIndex: 'review_status',

        width: 100,

        render: (_, record) => {

          const status = record.review_status;

          if (status === 'APPROVED' || status === '审核通过') {

            return <Tag color="success">{t('reviewStatus.approved')}</Tag>;

          }

          if (status === 'REJECTED' || status === '驳回') {

            return <Tag color="error">{t('reviewStatus.rejected')}</Tag>;

          }

          if (status === 'PENDING' || status === '待审核') {

            return <Tag color="warning">{t('reviewStatus.pending')}</Tag>;

          }

          return <Tag>{status}</Tag>;

        },

      },

      {

        title: t('app.kuaizhizao.reports.salesman'),

        dataIndex: 'salesman_name',

        width: 100,

      },

      {

        title: t('app.kuaizhizao.reports.notes'),

        dataIndex: 'notes',

        ellipsis: true,

      },

    ],

    [t],

  );



  return (

    <KuaizhizaoReport

      title={t('app.kuaizhizao.menu.reports.sales-order-query')}

      reportType="summary"

      dateRangeKeys={['order_date_range', 'date_range', 'dateRange']}

      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalesOrderQuery"

      columns={columns}

    />

  );

};



export default SalesOrderQuery;

