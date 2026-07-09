/**
 * 好力 GO — 供应商价格明细
 *
 * 维护各供应商物料不含税单价，供领票/验票时与发票金额比对。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { resolveFactoryImportHeaderIndexMap } from '../../../../../utils/spreadsheetImportTemplate';
import {
  createFinanceSupplierPriceLedger,
  batchDeleteFinanceSupplierPriceLedger,
  deleteFinanceSupplierPriceLedger,
  importFinanceSupplierPrices,
  listFinanceSupplierPriceLedger,
  listFinanceSuppliers,
  updateFinanceSupplierPriceLedger,
  type FinanceSupplierPriceImportRowPayload,
  type FinanceSupplierPriceLedgerCreatePayload,
  type FinanceSupplierPriceLedgerRow,
  type FinanceSupplierRow,
} from '../../../services/haoligo';
import {
  formatFinanceUnitPrice,
  normalizeFinanceUnitPriceInput,
  parseFinanceUnitPriceCell,
} from '../../../utils/financeDecimal';

const HAOLIGO_FINANCE_SUPPLIER_PRICES_RESOURCE = 'haoligo:finance-supplier-prices';

const PRICE_TYPE_OPTIONS = [
  { label: '不含税', value: '不含税' as const },
  { label: '含税', value: '含税' as const },
];

const PRICE_IMPORT_TEMPLATE = {
  importHeaders: ['供应商', '规格', '不含税单价', '备注'],
  importExampleRow: ['示例供应商有限公司', '95*125标签', '0.3221238938053', ''],
  importHeaderMap: {
    供应商: 'supplier_name',
    supplier_name: 'supplier_name',
    规格: 'spec',
    spec: 'spec',
    不含税单价: 'unit_price',
    unit_price: 'unit_price',
    单价: 'unit_price',
    备注: 'remark',
    remark: 'remark',
    序号: 'serial_no',
  },
} as const;

const FinanceSupplierPricesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(HAOLIGO_FINANCE_SUPPLIER_PRICES_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [suppliers, setSuppliers] = useState<FinanceSupplierRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | undefined>();

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

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleCreate = () => {
    setEditId(null);
    setInitialValues({ price_type: '不含税' });
    setModalOpen(true);
  };

  const handleEdit = (record: FinanceSupplierPriceLedgerRow) => {
    setEditId(record.id);
    setInitialValues({
      supplier_id: record.supplier_id,
      spec: record.spec ?? record.material_code,
      unit_price: record.unit_price,
      price_type: record.price_type,
      unit: record.unit ?? undefined,
      tax_rate: record.tax_rate ?? undefined,
      remark: record.remark ?? undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = (record: FinanceSupplierPriceLedgerRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除「${record.supplier_name} · ${record.spec ?? record.material_code}」的价格明细？`,
      okType: 'danger',
      onOk: async () => {
        await deleteFinanceSupplierPriceLedger(record.id);
        messageApi.success('已删除');
        actionRef.current?.reload();
      },
    });
  };

  const submitForm = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (editId != null) {
        await updateFinanceSupplierPriceLedger(editId, {
          spec: String(values.spec ?? '').trim(),
          unit_price: normalizeFinanceUnitPriceInput(values.unit_price),
          price_type: (values.price_type as '含税' | '不含税') ?? '不含税',
          unit: String(values.unit ?? '').trim() || null,
          tax_rate: values.tax_rate != null && values.tax_rate !== '' ? Number(values.tax_rate) : null,
          remark: String(values.remark ?? '').trim() || null,
        });
        messageApi.success('已更新');
      } else {
        const body: FinanceSupplierPriceLedgerCreatePayload = {
          supplier_id: Number(values.supplier_id),
          spec: String(values.spec ?? '').trim(),
          unit_price: normalizeFinanceUnitPriceInput(values.unit_price),
          price_type: (values.price_type as '含税' | '不含税') ?? '不含税',
          unit: String(values.unit ?? '').trim() || null,
          tax_rate: values.tax_rate != null && values.tax_rate !== '' ? Number(values.tax_rate) : null,
          remark: String(values.remark ?? '').trim() || null,
        };
        await createFinanceSupplierPriceLedger(body);
        messageApi.success('已创建');
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

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = Array.from(new Set(keys.map((key) => Number(key)).filter((id) => Number.isFinite(id))));
    if (ids.length === 0) return;
    const result = await batchDeleteFinanceSupplierPriceLedger(ids);
    if (result.deleted_count > 0) {
      messageApi.success(`已删除 ${result.deleted_count} 条`);
      actionRef.current?.reload();
    }
    const skipped = ids.length - result.deleted_count;
    if (skipped > 0) {
      messageApi.warning(`${skipped} 条不存在或已删除`);
    }
  };

  const columns: ProColumns<FinanceSupplierPriceLedgerRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '供应商 / 规格' },
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 220,
      ellipsis: true,
      hideInSearch: true,
      fixed: 'left',
    },
    {
      title: '规格',
      dataIndex: 'spec',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.spec || r.material_code,
    },
    {
      title: '不含税单价',
      dataIndex: 'unit_price',
      width: 220,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        const text = formatFinanceUnitPrice(r.unit_price);
        return <span title={text === '—' ? undefined : text}>{text}</span>;
      },
    },
    {
      title: '价类',
      dataIndex: 'price_type',
      width: 72,
      hideInSearch: true,
      render: (_, r) =>
        r.price_type === '不含税' ? <Tag color="blue">不含税</Tag> : <Tag color="orange">含税</Tag>,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 64,
      hideInSearch: true,
      render: (_, r) => r.unit || '—',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.remark || '—',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, record) => [
        perms.canUpdate ? (
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
        ) : null,
        perms.canDelete ? (
          <Button
            key="delete"
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        ) : null,
      ].filter(Boolean),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<FinanceSupplierPriceLedgerRow>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          permissionResource={HAOLIGO_FINANCE_SUPPLIER_PRICES_RESOURCE}
          showAdvancedSearch
          showCreateButton
          onCreate={handleCreate}
          enableRowSelection
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
          deleteConfirmTitle="批量删除价格明细"
          deleteConfirmDescription={(count) => `确定删除选中的 ${count} 条价格明细？`}
          showImportButton
          importHeaders={[...PRICE_IMPORT_TEMPLATE.importHeaders]}
          importExampleRow={[...PRICE_IMPORT_TEMPLATE.importExampleRow]}
          importFieldMap={{ ...PRICE_IMPORT_TEMPLATE.importHeaderMap }}
          importTemplateName="供应商价格明细导入模板"
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入文件为空或缺少表头');
              return;
            }
            const headers = (data[0] || []).map((h: unknown) => String(h ?? '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              PRICE_IMPORT_TEMPLATE.importHeaderMap,
            );
            if (
              headerIndexMap.supplier_name === undefined ||
              headerIndexMap.spec === undefined ||
              headerIndexMap.unit_price === undefined
            ) {
              messageApi.error('缺少必填列：供应商、规格、不含税单价');
              return;
            }
            const importRows = data.slice(2).filter((row: unknown[]) =>
              row?.some((cell) => cell != null && String(cell).trim() !== ''),
            );
            const rows: FinanceSupplierPriceImportRowPayload[] = [];
            let lastSupplierName = '';
            for (let i = 0; i < importRows.length; i++) {
              const row = importRows[i] as unknown[];
              const supplierCell =
                headerIndexMap.supplier_name !== undefined
                  ? String(row[headerIndexMap.supplier_name] ?? '').trim()
                  : '';
              if (supplierCell) {
                lastSupplierName = supplierCell;
              }
              const supplier_name = lastSupplierName;
              const spec = String(row[headerIndexMap.spec] ?? '').trim();
              const unitPrice = parseFinanceUnitPriceCell(row[headerIndexMap.unit_price]);
              if (!supplier_name && !spec) continue;
              if (!supplier_name) {
                messageApi.error(`第 ${i + 3} 行：缺少供应商（合并单元格请填写首行供应商名称）`);
                return;
              }
              if (!spec) {
                messageApi.error(`第 ${i + 3} 行：规格不能为空`);
                return;
              }
              if (unitPrice == null) {
                messageApi.error(`第 ${i + 3} 行：不含税单价无效`);
                return;
              }
              rows.push({
                supplier_name,
                spec,
                unit_price: unitPrice,
                remark:
                  headerIndexMap.remark !== undefined
                    ? String(row[headerIndexMap.remark] ?? '').trim() || null
                    : null,
              });
            }
            if (rows.length === 0) {
              messageApi.warning('没有可导入的有效数据');
              return;
            }
            const result = await importFinanceSupplierPrices(rows);
            const parts: string[] = [];
            if (result.suppliers_created_count > 0) {
              parts.push(`新建供应商 ${result.suppliers_created_count} 家`);
            }
            if (result.created_count > 0) parts.push(`新建价格 ${result.created_count} 条`);
            if (result.updated_count > 0) parts.push(`更新价格 ${result.updated_count} 条`);
            if (parts.length > 0) {
              messageApi.success(parts.join('，'));
              actionRef.current?.reload();
            }
            if (result.failed_count > 0) {
              const preview = result.errors.slice(0, 5).join('；');
              messageApi.warning(
                `失败 ${result.failed_count} 条${preview ? `：${preview}${result.errors.length > 5 ? '…' : ''}` : ''}`,
              );
            }
          }}
          request={async (params) => {
            const keyword = String(params.keyword ?? '').trim() || undefined;
            const rows = await listFinanceSupplierPriceLedger({ keyword });
            return { data: rows, success: true, total: rows.length };
          }}
          rowActionKind={rowActionKind.link}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId != null ? '编辑价格明细' : '新建价格明细'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        formRef={formRef}
        initialValues={initialValues}
        loading={formLoading}
        onFinish={submitForm}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {editId == null ? (
          <ProFormSelect
            name="supplier_id"
            label="供应商"
            options={supplierOptions}
            rules={[{ required: true, message: '请选择供应商' }]}
            showSearch
            fieldProps={{ optionFilterProp: 'label' }}
          />
        ) : null}
        <ProFormText name="spec" label="规格" rules={[{ required: true }]} extra="与发票明细「规格」一致，用于单价比对" />
        <ProFormText
          name="unit_price"
          label="单价"
          rules={[{ required: true }]}
          fieldProps={{ placeholder: '按原始小数位数录入，如 0.3221238938053' }}
        />
        <ProFormSelect name="price_type" label="价类" options={PRICE_TYPE_OPTIONS} rules={[{ required: true }]} />
        <ProFormText name="unit" label="单位" />
        <ProFormDigit name="tax_rate" label="税率（%）" min={0} fieldProps={{ precision: 2 }} />
        <ProFormTextArea name="remark" label="备注" />
      </FormModalTemplate>
    </>
  );
};

export default FinanceSupplierPricesPage;
