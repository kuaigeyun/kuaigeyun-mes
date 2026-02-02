import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { invoiceService } from '../../../services/finance/invoice';
import { Invoice, InvoiceListParams } from '../../../types/finance/invoice';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const InvoiceList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTabKey, setActiveTabKey] = useState<string>('all');

  const columns: ProColumns<Invoice>[] = [
    {
      title: t('app.kuaizhizao.common.code', { defaultValue: 'Code' }),
      dataIndex: 'invoice_code',
      width: 150,
      fixed: 'left',
      render: (dom, entity) => (
        <a onClick={() => navigate(`/apps/kuaizhizao/finance-management/invoices/${entity.invoice_code}`)}>{dom}</a>
      ),
    },
    {
      title: '发票号码',
      dataIndex: 'invoice_number',
      copyable: true,
      width: 150,
    },
    {
      title: '业务类型',
      dataIndex: 'category',
      valueEnum: {
        IN: { text: '进项(采购)', status: 'Processing' },
        OUT: { text: '销项(销售)', status: 'Success' },
      },
      width: 100,
    },
    {
      title: '往来单位',
      dataIndex: 'partner_name',
      width: 200,
    },
    {
      title: '价税合计',
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 120,
    },
    {
      title: '开票日期',
      dataIndex: 'invoice_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        DRAFT: { text: '草稿', status: 'Default' },
        CONFIRMED: { text: '已确认', status: 'Processing' },
        VERIFIED: { text: '已认证', status: 'Success' },
        CANCELLED: { text: '已作废', status: 'Error' },
      },
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 150,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <a key="edit" onClick={() => navigate(`/apps/kuaizhizao/finance-management/invoices/${record.invoice_code}`)}>编辑</a>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={async () => {
              await invoiceService.deleteInvoice(record.invoice_code);
              message.success('删除成功');
              actionRef.current?.reload();
            }}
          >
            <a key="delete" style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      header={{
        title: '发票台账',
        breadcrumb: {},
      }}
    >
      <ProTable<Invoice, InvoiceListParams>
        headerTitle="发票列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button
            key="button"
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              navigate('/apps/kuaizhizao/finance-management/invoices/new');
            }}
          >
            新建发票
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await invoiceService.listInvoices({
            skip: ((current || 1) - 1) * (pageSize || 20),
            limit: pageSize || 20,
            category: activeTabKey === 'all' ? undefined : activeTabKey as 'IN' | 'OUT',
            ...rest,
          });
          return {
            data: res.items,
            total: res.total,
            success: true,
          };
        }}
        columns={columns}
        toolbar={{
          menu: {
            activeKey: activeTabKey,
            items: [
              { key: 'all', label: '全部发票' },
              { key: 'OUT', label: '销项发票(销售)' },
              { key: 'IN', label: '进项发票(采购)' },
            ],
            onChange: (key) => {
              setActiveTabKey(key as string);
              actionRef.current?.reload();
            },
          },
        }}
      />
    </PageContainer>
  );
};

export default InvoiceList;
