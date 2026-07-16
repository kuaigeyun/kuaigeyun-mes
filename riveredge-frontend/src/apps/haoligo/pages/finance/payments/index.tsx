/**
 * 好力 GO — 付款记录
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { haoligoDocumentCreatorColumn, resolveHaoligoDocumentCreatorName } from '../../../utils/documentTableColumns';
import {
  deleteFinancePayment,
  listFinanceInvoices,
  listFinancePayments,
  listFinanceSuppliers,
  updateFinancePayment,
  type FinanceInvoiceRow,
  type FinancePaymentCreatePayload,
  type FinancePaymentRow,
  type FinanceSupplierRow,
} from '../../../services/haoligo';

const HAOLIGO_FINANCE_PAYMENTS_RESOURCE = 'haoligo:finance-payments';

const PAYMENT_METHOD_OPTIONS = [
  { label: '银行转账', value: '银行转账' as const },
  { label: '承兑汇票', value: '承兑汇票' as const },
  { label: '现金', value: '现金' as const },
  { label: '支票', value: '支票' as const },
  { label: '其他', value: '其他' as const },
];

const FinancePaymentsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [suppliers, setSuppliers] = useState<FinanceSupplierRow[]>([]);
  const [invoicesBySupplier, setInvoicesBySupplier] = useState<FinanceInvoiceRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<FinancePaymentRow | null>(null);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ label: s.supplier_name, value: s.id })),
    [suppliers],
  );

  const loadSuppliers = useCallback(async () => {
    try {
      setSuppliers(await listFinanceSuppliers({ is_active: true }));
    } catch {
      setSuppliers([]);
    }
  }, []);

  const loadInvoicesForSupplier = useCallback(async (supplierId: number) => {
    try {
      const rows = await listFinanceInvoices({ supplier_id: supplierId, limit: 200 });
      setInvoicesBySupplier(rows.filter((r) => r.status !== '已拒收'));
    } catch {
      setInvoicesBySupplier([]);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setInvoicesBySupplier([]);
    setInitialValues({
      payment_date: dayjs(),
      payment_method: '银行转账',
    });
    setModalOpen(true);
  };

  const handleEdit = (record: FinancePaymentRow) => {
    setIsEdit(true);
    setEditId(record.id);
    void loadInvoicesForSupplier(record.supplier_id);
    setInitialValues({
      supplier_id: record.supplier_id,
      payment_date: record.payment_date ? dayjs(record.payment_date) : dayjs(),
      amount: record.amount,
      payment_method: record.payment_method,
      contract_no: record.contract_no ?? undefined,
      remark: record.remark ?? undefined,
      invoice_id: record.invoice_id ?? undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = (record: FinancePaymentRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除 ${record.supplier_name} 的付款记录（${Number(record.amount).toFixed(2)}）？`,
      okType: 'danger',
      onOk: async () => {
        await deleteFinancePayment(record.id);
        messageApi.success('已删除');
        actionRef.current?.reload();
      },
    });
  };

  const submitForm = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      const payload: FinancePaymentCreatePayload = {
        supplier_id: Number(values.supplier_id),
        payment_date: dayjs(values.payment_date as dayjs.Dayjs).format('YYYY-MM-DD'),
        amount: Number(values.amount),
        payment_method: values.payment_method as FinancePaymentCreatePayload['payment_method'],
        contract_no: String(values.contract_no ?? '').trim() || null,
        remark: String(values.remark ?? '').trim() || null,
        invoice_id: values.invoice_id != null && values.invoice_id !== '' ? Number(values.invoice_id) : null,
        acceptance_id: null,
      };
      if (isEdit && editId != null) {
        await updateFinancePayment(editId, payload);
        messageApi.success('已更新');
      } else {
        await createFinancePayment(payload);
        messageApi.success('已登记');
      }
      setModalOpen(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<FinancePaymentRow>[] = [
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '付款日期', dataIndex: 'payment_date' },
    { title: '金额', dataIndex: 'amount', render: (_, r) => Number(r.amount).toFixed(2) },
    { title: '付款方式', dataIndex: 'payment_method' },
    { title: '合同号', dataIndex: 'contract_no', render: (_, r) => r.contract_no || '—' },
    { title: '关联发票', dataIndex: 'invoice_no', render: (_, r) => r.invoice_no || '—' },
    { title: '备注', dataIndex: 'remark', render: (_, r) => r.remark || '—' },
    { title: '创建人', dataIndex: 'creator_name', render: (_, r) => resolveHaoligoDocumentCreatorName(r) },
  ];

  const columns: ProColumns<FinancePaymentRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '合同号 / 备注 / 付款方式' },
    },
    {
      title: '付款日期',
      dataIndex: 'payment_date',
      width: 110,
      fixed: 'left',
      valueType: 'dateRange',
      search: {
        transform: (v) => ({
          payment_date_from: v?.[0],
          payment_date_to: v?.[1],
        }),
      },
      render: (_, r) => r.payment_date,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.amount).toFixed(2),
    },
    { title: '付款方式', dataIndex: 'payment_method', width: 100, hideInSearch: true },
    { title: '合同号', dataIndex: 'contract_no', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '关联发票',
      dataIndex: 'invoice_no',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.invoice_no || '—',
    },
    haoligoDocumentCreatorColumn<FinancePaymentRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => [
        <Button
          key="view"
          {...rowActionKind('read')}
          onClick={() => {
            setDetailRecord(record);
            setDetailOpen(true);
          }}
        />,
        <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
        <Button key="del" {...rowActionKind('delete')} onClick={() => handleDelete(record)} />,
      ],
    },
  ];

  const invoiceOptions = invoicesBySupplier.map((inv) => ({
    label: `${inv.invoice_no} - ${Number(inv.total_amount).toFixed(2)}`,
    value: inv.id,
  }));

  return (
    <>
      <ListPageTemplate>
        <UniTable<FinancePaymentRow>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          permissionResource={HAOLIGO_FINANCE_PAYMENTS_RESOURCE}
          showAdvancedSearch
          showCreateButton
          createButtonText="登记付款"
          onCreate={handleCreate}
          request={async (params) => {
            const rows = await listFinancePayments({
              keyword: String(params.keyword ?? '').trim() || undefined,
              payment_date_from: params.payment_date_from as string | undefined,
              payment_date_to: params.payment_date_to as string | undefined,
            });
            return { data: rows, success: true, total: rows.length };
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑付款' : '登记付款'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        formRef={formRef}
        initialValues={initialValues}
        loading={formLoading}
        onFinish={submitForm}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="supplier_id"
          label="供应商"
          rules={[{ required: true }]}
          options={supplierOptions}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            onChange: (v) => {
              formRef.current?.setFieldValue('invoice_id', undefined);
              if (typeof v === 'number') void loadInvoicesForSupplier(v);
              else setInvoicesBySupplier([]);
            },
          }}
        />
        <ProFormDatePicker name="payment_date" label="付款日期" rules={[{ required: true }]} width="md" />
        <ProFormDigit name="amount" label="金额" min={0.01} rules={[{ required: true }]} fieldProps={{ precision: 2 }} />
        <ProFormSelect name="payment_method" label="付款方式" rules={[{ required: true }]} options={PAYMENT_METHOD_OPTIONS} />
        <ProFormText name="contract_no" label="合同号" />
        <ProFormDependency name={['supplier_id']}>
          {({ supplier_id }) =>
            supplier_id ? (
              <ProFormSelect
                name="invoice_id"
                label="关联发票（可选）"
                options={invoiceOptions}
                showSearch
                allowClear
                fieldProps={{ optionFilterProp: 'label' }}
              />
            ) : null
          }
        </ProFormDependency>
        <ProFormTextArea name="remark" label="备注" />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={detailRecord ? `付款详情 - ${Number(detailRecord.amount).toFixed(2)}` : '付款详情'}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        columns={detailColumns}
        dataSource={detailRecord ?? undefined}
      />
    </>
  );
};

export default FinancePaymentsPage;
