/**
 * 发票列表页（销项/进项统一，从快制造迁移）
 *
 * 路由与筛选对应关系：
 * - /finance-management/invoices         -> 全部发票
 * - /finance-management/sales-invoices   -> 销项发票(销售)
 * - /finance-management/purchase-invoices -> 进项发票(采购)
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Typography } from 'antd';
import { FileTextOutlined, AccountBookOutlined, PayCircleOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '../../../services/finance/invoice';
import { Invoice, InvoiceCreateData } from '../../../types/finance/invoice';
import { batchImport } from '../../../../../utils/batchOperations';
import { apiRequest } from '../../../../../services/api';
import { useTranslation } from 'react-i18next';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { useNavigate, useLocation } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { getUnifiedInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { buildUnifiedInvoiceStatusEnum } from '../../../utils/financeSharedOptions';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaicaiwu.invoice';

const InvoiceList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { message: messageApi } = App.useApp();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const invoiceImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'invoiceNo',
            required: true,
            labelKey: 'app.kuaicaiwu.invoice.import.invoiceNo',
            aliases: ['发票号码'],
          },
          { field: 'type', labelKey: 'app.kuaicaiwu.invoice.import.type', aliases: ['类型(IN/OUT)', '类型'] },
          {
            field: 'partner',
            required: true,
            labelKey: 'app.kuaicaiwu.invoice.import.partner',
            aliases: ['往来单位'],
          },
          {
            field: 'totalAmount',
            required: true,
            labelKey: 'app.kuaicaiwu.invoice.import.totalAmount',
            aliases: ['价税合计'],
          },
          { field: 'taxRate', labelKey: 'app.kuaicaiwu.invoice.import.taxRate', aliases: ['税率'] },
          { field: 'invoiceDate', labelKey: 'app.kuaicaiwu.invoice.import.invoiceDate', aliases: ['开票日期'] },
        ],
        [
          t('app.kuaicaiwu.invoice.importExample.invoiceNo'),
          t('app.kuaicaiwu.invoice.importExample.type'),
          t('app.kuaicaiwu.invoice.importExample.partner'),
          t('app.kuaicaiwu.invoice.importExample.totalAmount'),
          t('app.kuaicaiwu.invoice.importExample.taxRate'),
          t('app.kuaicaiwu.invoice.importExample.invoiceDate'),
        ],
      ),
    [t, i18n.language],
  );
  const location = useLocation();
  const queryClient = useQueryClient();

  const invalidateInvoiceStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['invoiceStatistics'] });
  };

  const { data: invoiceStatistics } = useQuery({
    queryKey: ['invoiceStatistics'],
    queryFn: () => invoiceService.getStatistics(),
  });

  const initialTab = location.pathname.includes('sales-invoices') ? 'OUT' : location.pathname.includes('purchase-invoices') ? 'IN' : 'all';
  const [activeTabKey, setActiveTabKey] = useState<string>(initialTab);
  const headerTitle = useMemo(() => {
    if (location.pathname.includes('sales-invoices')) return t(`${P}.pageTitleSales`);
    if (location.pathname.includes('purchase-invoices')) return t(`${P}.pageTitlePurchase`);
    return t(`${P}.pageTitleAll`);
  }, [location.pathname, t]);

  useEffect(() => {
    const tab = location.pathname.includes('sales-invoices') ? 'OUT' : location.pathname.includes('purchase-invoices') ? 'IN' : 'all';
    setActiveTabKey(tab);
    actionRef.current?.reload();
  }, [location.pathname]);

  const columns: ProColumns<Invoice>[] = useMemo(
    () => [
      {
        title: t('app.kuaicaiwu.common.code'),
        dataIndex: 'invoice_code',
        width: 168,
        fixed: 'left',
        render: (_, entity) => (
          <Typography.Text copyable={{ text: String(entity.invoice_code ?? '') }} ellipsis>
            <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/invoices/${entity.invoice_code}`)}>
              {entity.invoice_code}
            </a>
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.col.invoiceNumber`),
        dataIndex: 'invoice_number',
        copyable: true,
        width: 150,
      },
      {
        title: t(`${P}.col.category`),
        dataIndex: 'category',
        valueEnum: {
          IN: { text: t(`${P}.category.in`), status: 'Processing' },
          OUT: { text: t(`${P}.category.out`), status: 'Success' },
        },
        width: 100,
      },
      {
        title: t(`${P}.col.partner`),
        dataIndex: 'partner_name',
        width: 200,
      },
      {
        title: t(`${P}.col.totalAmount`),
        dataIndex: 'total_amount',
        valueType: 'money',
        align: 'right',
        width: 120,
      },
      {
        title: t('app.kuaicaiwu.common.invoiceDate'),
        dataIndex: 'invoice_date',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueEnum: buildUnifiedInvoiceStatusEnum(t),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaicaiwu.common.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        width: 120,
        hideInSearch: true,
        render: (_, record) => {
          const lc = getUnifiedInvoiceLifecycle(record as unknown as Record<string, unknown>, t);
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
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        width: 200,
        render: (_, record) => [
          <Button {...rowActionKind('read')}
            key="det"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/invoices/${record.invoice_code}`)}
          >
            {t('common.detail')}
          </Button>,
          <Button {...rowActionKind('update')}
            key="ed"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/apps/kuaicaiwu/finance-management/invoices/${record.invoice_code}`)}
          >
            {t('common.edit')}
          </Button>,
          <Popconfirm {...rowActionKind('delete')}
            key="del"
            title={t('common.confirmDelete')}
            onConfirm={async () => {
              await invoiceService.deleteInvoice(record.invoice_code);
              messageApi.success(t('common.deleteSuccess'));
              invalidateInvoiceStatistics();
              actionRef.current?.reload();
            }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [t, navigate, messageApi],
  );

  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      for (const code of keys) {
        await invoiceService.deleteInvoice(String(code));
      }
      messageApi.success(t(`${P}.batchDeleteSuccess`, { count: keys.length }));
      setSelectedRowKeys([]);
      invalidateInvoiceStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.deleteFailed'));
    }
  };

  const statCards: StatCard[] = useMemo(() => {
    const s = invoiceStatistics;
    if (!s) {
      return [
        { title: t(`${P}.stat.total`), value: 0, prefix: <FileTextOutlined />, valueStyle: { color: '#1890ff' } },
        {
          title: t(`${P}.stat.inAmount`),
          value: 0,
          prefix: <AccountBookOutlined />,
          valueStyle: { color: '#52c41a' },
          precision: 2,
        },
        {
          title: t(`${P}.stat.outAmount`),
          value: 0,
          prefix: <AccountBookOutlined />,
          valueStyle: { color: '#faad14' },
          precision: 2,
        },
        {
          title: t(`${P}.stat.pendingVerify`),
          value: 0,
          prefix: <PayCircleOutlined />,
          suffix: t(`${P}.stat.unit`),
          valueStyle: { color: '#f5222d' },
        },
      ];
    }
    return [
      { title: t(`${P}.stat.total`), value: s.total_count, prefix: <FileTextOutlined />, valueStyle: { color: '#1890ff' } },
      {
        title: t(`${P}.stat.inAmount`),
        value: s.in_total_amount,
        prefix: <AccountBookOutlined />,
        valueStyle: { color: '#52c41a' },
        precision: 2,
      },
      {
        title: t(`${P}.stat.outAmount`),
        value: s.out_total_amount,
        prefix: <AccountBookOutlined />,
        valueStyle: { color: '#faad14' },
        precision: 2,
      },
      {
        title: t(`${P}.stat.pendingVerify`),
        value: s.pending_verification_count,
        prefix: <PayCircleOutlined />,
        suffix: t(`${P}.stat.unit`),
        valueStyle: { color: '#f5222d' },
      },
    ];
  }, [invoiceStatistics, t]);

  return (
    <ListPageTemplate statCards={statCards}>
      <UniTable<Invoice>
        headerTitle={headerTitle}
        actionRef={actionRef}
        rowKey="invoice_code"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.invoices"
        scroll={{ x: 1680 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton
        createButtonText={t(`${P}.createTitle`)}
        onCreate={() => navigate('/apps/kuaicaiwu/finance-management/invoices/new')}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        deleteButtonText={t('common.batchDelete')}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t(`${P}.batchDeleteConfirm`, { count })}
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
            messageApi.warning(t('app.kuaicaiwu.common.importEmpty'));
            return;
          }
          const headers = (data[0] || []).map((h: any) => String(h || '').trim());
          const headerIndexMap = resolveFactoryImportHeaderIndexMap(
            headers,
            invoiceImportTemplate.importHeaderMap,
          );
          if (
            headerIndexMap.invoiceNo === undefined ||
            headerIndexMap.partner === undefined ||
            headerIndexMap.totalAmount === undefined
          ) {
            messageApi.error(t(`${P}.importHeaderError`));
            return;
          }
          const [customers, suppliers] = await Promise.all([
            apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 5000 } }),
            apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 5000 } }),
          ]);
          const custList = Array.isArray(customers) ? customers : (customers as any)?.items ?? [];
          const suppList = Array.isArray(suppliers) ? suppliers : (suppliers as any)?.items ?? [];
          const items: InvoiceCreateData[] = [];
          const importRows = data.slice(2).filter((row: any[]) =>
            row?.some((c: any) => c != null && String(c).trim() !== ''),
          );
          for (const row of importRows) {
            const invNum = String(row[headerIndexMap.invoiceNo] ?? '').trim();
            const category = (
              headerIndexMap.type !== undefined
                ? String(row[headerIndexMap.type] ?? '').trim().toUpperCase()
                : 'OUT'
            ) as 'IN' | 'OUT';
            const partnerName = String(row[headerIndexMap.partner] ?? '').trim();
            const total = Number(row[headerIndexMap.totalAmount]) || 0;
            const taxRate =
              headerIndexMap.taxRate !== undefined ? Number(row[headerIndexMap.taxRate]) || 0.13 : 0.13;
            const invDate =
              headerIndexMap.invoiceDate !== undefined && row[headerIndexMap.invoiceDate]
                ? String(row[headerIndexMap.invoiceDate]).slice(0, 10)
                : new Date().toISOString().slice(0, 10);
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
              items: [{ item_name: t(`${P}.importLineItem`), amount: amountExcl, tax_rate: taxRate, tax_amount: taxAmount }],
            });
          }
          if (items.length === 0) {
            messageApi.warning(t(`${P}.importNoValidRows`));
            return;
          }
          const result = await batchImport({
            items,
            importFn: async (item) => invoiceService.createInvoice(item),
            title: t(`${P}.importTitle`),
            concurrency: 5,
          });
          if (result.successCount > 0) {
            messageApi.success(t(`${P}.importSuccess`, { count: result.successCount }));
            invalidateInvoiceStatistics();
            actionRef.current?.reload();
          }
          if (result.failureCount > 0) {
            messageApi.warning(t('app.kuaicaiwu.common.importPartialFail', { count: result.failureCount }));
          }
        }}
        importHeaders={invoiceImportTemplate.importHeaders}
        importExampleRow={invoiceImportTemplate.importExampleRow}
        importFieldMap={invoiceImportTemplate.importHeaderMap}
        showExportButton
        onExport={async (type, keys, pageData) => {
          try {
            const res = await invoiceService.listInvoices({ skip: 0, limit: 10000, category: activeTabKey === 'all' ? undefined : activeTabKey as 'IN' | 'OUT' });
            let items = res.items || [];
            if (type === 'currentPage' && pageData?.length) items = pageData;
            else if (type === 'selected' && keys?.length) items = items.filter((d: Invoice) => d.invoice_code && keys.includes(d.invoice_code));
            if (items.length === 0) {
              messageApi.warning(t('common.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoices-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (error: any) {
            messageApi.error(error?.message || t('common.exportFailed'));
          }
        }}
        toolbar={{
          menu: {
            activeKey: activeTabKey,
            items: [
              { key: 'all', label: t(`${P}.tabAll`) },
              { key: 'OUT', label: t(`${P}.tabSales`) },
              { key: 'IN', label: t(`${P}.tabPurchase`) },
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
