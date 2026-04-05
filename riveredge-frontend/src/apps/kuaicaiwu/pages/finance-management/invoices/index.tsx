/**
 * 发票列表页（销项/进项统一，从快制造迁移）
 *
 * 路由与筛选对应关系：
 * - /finance-management/invoices         -> 全部发票
 * - /finance-management/sales-invoices   -> 销项发票(销售)
 * - /finance-management/purchase-invoices -> 进项发票(采购)
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Popconfirm, Typography } from 'antd';
import { FileTextOutlined, AccountBookOutlined, PayCircleOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '../../../services/finance/invoice';
import { usePageMetrics } from '../../../../../hooks/usePageMetrics';
import { Invoice, InvoiceCreateData } from '../../../types/finance/invoice';
import { batchImport } from '../../../../../utils/batchOperations';
import { apiRequest } from '../../../../../services/api';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { getUnifiedInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import dayjs from 'dayjs';

const InvoiceList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics(location.pathname);

  const invalidateInvoiceStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['invoiceStatistics'] });
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] });
  };

  const { data: invoiceStatistics } = useQuery({
    queryKey: ['invoiceStatistics'],
    queryFn: () => invoiceService.getStatistics(),
  });

  const initialTab = location.pathname.includes('sales-invoices') ? 'OUT' : location.pathname.includes('purchase-invoices') ? 'IN' : 'all';
  const [activeTabKey, setActiveTabKey] = useState<string>(initialTab);
  const headerTitle = location.pathname.includes('sales-invoices') ? '销售发票' : location.pathname.includes('purchase-invoices') ? '采购发票' : '发票列表';

  useEffect(() => {
    const tab = location.pathname.includes('sales-invoices') ? 'OUT' : location.pathname.includes('purchase-invoices') ? 'IN' : 'all';
    setActiveTabKey(tab);
    actionRef.current?.reload();
  }, [location.pathname]);

  const columns: ProColumns<Invoice>[] = [
    {
      title: t('common.code', { defaultValue: '编号' }),
      dataIndex: 'invoice_code',
      width: 168,
      fixed: 'left',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.invoice_code ?? '') }} ellipsis>
          <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/invoices/${entity.invoice_code}`)}>{entity.invoice_code}</a>
        </Typography.Text>
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
        IN: { text: '采购发票', status: 'Processing' },
        OUT: { text: '销售发票', status: 'Success' },
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
      hideInTable: true,
      valueEnum: {
        DRAFT: { text: '草稿' },
        CONFIRMED: { text: '已确认' },
        VERIFIED: { text: '已认证' },
        CANCELLED: { text: '已作废' },
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      fixed: 'right',
      align: 'left',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        const lc = getUnifiedInvoiceLifecycle(record as unknown as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lc.percent}
            stageName={lc.stageName}
            status={lc.status}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, record) =>
        renderRowActionsOverflow(
          [
            <Button
              key="det"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/apps/kuaicaiwu/finance-management/invoices/${record.invoice_code}`)}
            >
              详情
            </Button>,
            <Button
              key="ed"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/apps/kuaicaiwu/finance-management/invoices/${record.invoice_code}`)}
            >
              编辑
            </Button>,
            <Popconfirm
              key="del"
              title="确定要删除吗？"
              onConfirm={async () => {
                await invoiceService.deleteInvoice(record.invoice_code);
                messageApi.success('删除成功');
                invalidateInvoiceStatistics();
                actionRef.current?.reload();
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>,
          ],
          `inv-${record.invoice_code}`,
        ),
    },
  ];

  const statCards: StatCard[] = useMemo(() => {
    const s = invoiceStatistics;
    if (hasPageMetricConfig && pageMetricCards.length > 0) {
      return pageMetricCards.map((card) => {
        if (!s || !card.key) return card;
        const valueMap: Record<string, number | undefined> = {
          total_count: s.total_count,
          in_total_amount: s.in_total_amount,
          out_total_amount: s.out_total_amount,
          pending_verification_count: s.pending_verification_count,
        };
        const v = valueMap[card.key];
        if (v === undefined) return card;
        return { ...card, value: v };
      });
    }
    if (!s) {
      return [
        { title: '总发票数', value: 0, prefix: <FileTextOutlined />, valueStyle: { color: '#1890ff' } },
        { title: '进项金额', value: 0, prefix: <AccountBookOutlined />, valueStyle: { color: '#52c41a' }, precision: 2 },
        { title: '销项金额', value: 0, prefix: <AccountBookOutlined />, valueStyle: { color: '#faad14' }, precision: 2 },
        { title: '待认证', value: 0, prefix: <PayCircleOutlined />, suffix: '张', valueStyle: { color: '#f5222d' } },
      ];
    }
    return [
      { title: '总发票数', value: s.total_count, prefix: <FileTextOutlined />, valueStyle: { color: '#1890ff' } },
      {
        title: '进项金额',
        value: s.in_total_amount,
        prefix: <AccountBookOutlined />,
        valueStyle: { color: '#52c41a' },
        precision: 2,
      },
      {
        title: '销项金额',
        value: s.out_total_amount,
        prefix: <AccountBookOutlined />,
        valueStyle: { color: '#faad14' },
        precision: 2,
      },
      {
        title: '待认证',
        value: s.pending_verification_count,
        prefix: <PayCircleOutlined />,
        suffix: '张',
        valueStyle: { color: '#f5222d' },
      },
    ];
  }, [hasPageMetricConfig, pageMetricCards, invoiceStatistics]);

  return (
    <ListPageTemplate statCards={statCards}>
      <UniTable<Invoice>
        headerTitle={headerTitle}
        actionRef={actionRef}
        rowKey="invoice_code"
        columnPersistenceId="kuaicaiwu-finance-invoices"
        scroll={{ x: 1680 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton
        createButtonText="新建发票"
        onCreate={() => navigate('/apps/kuaicaiwu/finance-management/invoices/new')}
        enableRowSelection
        showDeleteButton
        deleteButtonText="批量删除"
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 张发票吗？`,
            onOk: async () => {
              try {
                for (const code of keys) {
                  await invoiceService.deleteInvoice(String(code));
                }
                messageApi.success(`成功删除 ${keys.length} 张发票`);
                invalidateInvoiceStatistics();
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error?.message || '删除失败');
              }
            },
          });
        }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await invoiceService.listInvoices({
            skip: ((current || 1) - 1) * (pageSize || 20),
            limit: pageSize || 20,
            category: activeTabKey === 'all' ? undefined : activeTabKey as 'IN' | 'OUT',
            ...rest,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        columns={columns}
        showImportButton
        onImport={async (data) => {
          if (!data || data.length < 2) {
            messageApi.warning('导入数据为空或格式不正确');
            return;
          }
          const headers = (data[0] || []).map((h: any) => String(h || '').trim());
          const getIdx = (...keys: string[]) => {
            for (const k of keys) {
              const i = headers.findIndex((h: string) => h.includes(k) || h.replace(/\*/g, '').toLowerCase().includes(k.toLowerCase()));
              if (i >= 0) return i;
            }
            return -1;
          };
          const numIdx = getIdx('发票号码', 'invoice_number');
          const catIdx = getIdx('类型', 'category');
          const partnerIdx = getIdx('往来', 'partner', '单位');
          const totalIdx = getIdx('价税', 'total', '金额');
          const rateIdx = getIdx('税率', 'tax_rate');
          const dateIdx = getIdx('开票', 'invoice_date', '日期');
          if (numIdx < 0 || partnerIdx < 0 || totalIdx < 0) {
            messageApi.error('导入表头需包含发票号码、往来单位、价税合计');
            return;
          }
          const [customers, suppliers] = await Promise.all([
            apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 5000 } }),
            apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 5000 } }),
          ]);
          const custList = Array.isArray(customers) ? customers : (customers as any)?.items ?? [];
          const suppList = Array.isArray(suppliers) ? suppliers : (suppliers as any)?.items ?? [];
          const items: InvoiceCreateData[] = [];
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            const invNum = String(row[numIdx] ?? '').trim();
            const category = (catIdx >= 0 ? String(row[catIdx] ?? '').trim().toUpperCase() : 'OUT') as 'IN' | 'OUT';
            const partnerName = String(row[partnerIdx] ?? '').trim();
            const total = Number(row[totalIdx]) || 0;
            const taxRate = rateIdx >= 0 ? Number(row[rateIdx]) || 0.13 : 0.13;
            const invDate = dateIdx >= 0 && row[dateIdx] ? String(row[dateIdx]).slice(0, 10) : new Date().toISOString().slice(0, 10);
            if (!invNum || !partnerName || total <= 0) continue;
            const list = category === 'IN' ? suppList : custList;
            const partner = list.find((p: any) => (p.name || p.customer_name || p.supplier_name || p.code || '').includes(partnerName) || partnerName.includes(p.name || p.customer_name || p.supplier_name || p.code || ''));
            const partnerId = partner?.id;
            if (!partnerId) continue;
            const taxAmount = total * (taxRate / (1 + taxRate));
            const amountExcl = total - taxAmount;
            items.push({
              invoice_number: invNum,
              category,
              invoice_type: '增值税专用发票',
              partner_id: partnerId,
              partner_name: partner?.name || partner?.customer_name || partner?.supplier_name || partnerName,
              amount_excluding_tax: Math.round(amountExcl * 100) / 100,
              tax_amount: Math.round(taxAmount * 100) / 100,
              total_amount: total,
              tax_rate: taxRate,
              invoice_date: invDate,
              status: 'DRAFT',
              items: [{ item_name: '导入明细', amount: amountExcl, tax_rate: taxRate, tax_amount: taxAmount }],
            });
          }
          if (items.length === 0) {
            messageApi.warning('没有可导入的有效数据（请确保往来单位在客户/供应商中存在）');
            return;
          }
          const result = await batchImport({
            items,
            importFn: async (item) => invoiceService.createInvoice(item),
            title: '导入发票',
            concurrency: 5,
          });
          if (result.successCount > 0) {
            messageApi.success(`成功导入 ${result.successCount} 张发票`);
            invalidateInvoiceStatistics();
            actionRef.current?.reload();
          }
          if (result.failureCount > 0) {
            messageApi.warning(`部分失败 ${result.failureCount} 张`);
          }
        }}
        importHeaders={['*发票号码', '类型(IN/OUT)', '*往来单位', '*价税合计', '税率', '开票日期']}
        showExportButton
        onExport={async (type, keys, pageData) => {
          try {
            const res = await invoiceService.listInvoices({ skip: 0, limit: 10000, category: activeTabKey === 'all' ? undefined : activeTabKey as 'IN' | 'OUT' });
            let items = res.items || [];
            if (type === 'currentPage' && pageData?.length) items = pageData;
            else if (type === 'selected' && keys?.length) items = items.filter((d: Invoice) => d.invoice_code && keys.includes(d.invoice_code));
            if (items.length === 0) {
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoices-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(`已导出 ${items.length} 条记录`);
          } catch (error: any) {
            messageApi.error(error?.message || '导出失败');
          }
        }}
        toolbar={{
          menu: {
            activeKey: activeTabKey,
            items: [
              { key: 'all', label: '全部发票' },
              { key: 'OUT', label: '销售发票' },
              { key: 'IN', label: '采购发票' },
            ],
            onChange: (key) => {
              setActiveTabKey(key as string);
              actionRef.current?.reload();
            },
          },
        }}
      />
    </ListPageTemplate>
  );
};

export default InvoiceList;
