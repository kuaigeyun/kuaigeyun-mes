/**
 * 好力 GO — 财务材料供应商台账
 *
 * 对齐模具台账：ListPageTemplate + UniTable + UniDetail；单价清单在详情抽屉内维护。
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import {
  DetailDrawerSection,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  changeFinanceSupplierPrice,
  batchDeleteFinanceSuppliers,
  createFinanceSupplier,
  createFinanceSupplierPrice,
  deleteFinanceSupplier,
  importFinanceSuppliers,
  listFinancePriceChangeLogs,
  listFinanceSupplierPrices,
  listFinanceSuppliers,
  updateFinanceSupplier,
  type FinancePriceChangeLogRow,
  type FinanceSupplierCreatePayload,
  type FinanceSupplierImportRowPayload,
  type FinanceSupplierPriceCreatePayload,
  type FinanceSupplierPriceRow,
  type FinanceSupplierRow,
} from '../../../services/haoligo';
import { formatDateTime } from '../../../../../utils/format';
import { formatFinanceUnitPrice } from '../../../utils/financeDecimal';
import { resolveFactoryImportHeaderIndexMap } from '../../../../../utils/spreadsheetImportTemplate';

const HAOLIGO_FINANCE_SUPPLIERS_RESOURCE = 'haoligo:finance-suppliers';

const SUPPLIER_IMPORT_TEMPLATE = {
  importHeaders: ['*代号', '*名称', '账期（天）', '结算方式', '税号', '联系人', '联系电话', '启用', '备注'],
  importExampleRow: ['SUP001', '示例供应商', '30', '月结', '91320000MA1XXXXXX', '张三', '13800138000', '是', ''],
  importHeaderMap: {
    '*代号': 'supplier_code',
    代号: 'supplier_code',
    supplier_code: 'supplier_code',
    '*名称': 'supplier_name',
    名称: 'supplier_name',
    supplier_name: 'supplier_name',
    '账期（天）': 'payment_terms_days',
    账期: 'payment_terms_days',
    payment_terms_days: 'payment_terms_days',
    结算方式: 'settlement_method',
    settlement_method: 'settlement_method',
    税号: 'tax_no',
    tax_no: 'tax_no',
    联系人: 'contact_name',
    contact_name: 'contact_name',
    联系电话: 'contact_phone',
    contact_phone: 'contact_phone',
    启用: 'is_active',
    is_active: 'is_active',
    备注: 'remark',
    remark: 'remark',
  },
} as const;

function parseImportActiveCell(value: unknown): boolean {
  if (value === null || value === undefined || String(value).trim() === '') {
    return true;
  }
  const raw = String(value).trim().toLowerCase();
  if (['是', 'yes', 'y', 'true', '1', '启用', 'on'].includes(raw)) {
    return true;
  }
  if (['否', 'no', 'n', 'false', '0', '停用', 'off'].includes(raw)) {
    return false;
  }
  return true;
}

function parseImportIntCell(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.round(n);
}

const PRICE_TYPE_OPTIONS = [
  { label: '含税', value: '含税' as const },
  { label: '不含税', value: '不含税' as const },
];

function activeTag(isActive: boolean) {
  return isActive ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>;
}

const FinanceSuppliersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const perms = useResourcePermissions(HAOLIGO_FINANCE_SUPPLIERS_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const supplierFormRef = useRef<ProFormInstance>(null);
  const priceFormRef = useRef<ProFormInstance>(null);
  const changePriceFormRef = useRef<ProFormInstance>(null);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierEditId, setSupplierEditId] = useState<number | null>(null);
  const [supplierFormLoading, setSupplierFormLoading] = useState(false);
  const [supplierInitialValues, setSupplierInitialValues] = useState<Record<string, unknown> | undefined>();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<FinanceSupplierRow | null>(null);
  const [priceRows, setPriceRows] = useState<FinanceSupplierPriceRow[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [changeLogs, setChangeLogs] = useState<FinancePriceChangeLogRow[]>([]);
  const [changeLogLoading, setChangeLogLoading] = useState(false);

  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [priceFormLoading, setPriceFormLoading] = useState(false);
  const [changePriceModalOpen, setChangePriceModalOpen] = useState(false);
  const [changePriceTarget, setChangePriceTarget] = useState<FinanceSupplierPriceRow | null>(null);
  const [changePriceLoading, setChangePriceLoading] = useState(false);

  const loadSupplierPrices = useCallback(async (supplierId: number) => {
    setPriceLoading(true);
    try {
      const rows = await listFinanceSupplierPrices(supplierId, { include_history: false });
      setPriceRows(rows);
    } catch (e) {
      messageApi.error((e as Error).message || '加载单价清单失败');
      setPriceRows([]);
    } finally {
      setPriceLoading(false);
    }
  }, [messageApi]);

  const loadChangeLogs = useCallback(async (supplierId: number) => {
    setChangeLogLoading(true);
    try {
      const rows = await listFinancePriceChangeLogs(supplierId);
      setChangeLogs(rows.slice(0, 50));
    } catch {
      setChangeLogs([]);
    } finally {
      setChangeLogLoading(false);
    }
  }, []);

  const openDetail = useCallback(
    async (record: FinanceSupplierRow) => {
      setDetailRecord(record);
      setDetailOpen(true);
      await Promise.all([loadSupplierPrices(record.id), loadChangeLogs(record.id)]);
    },
    [loadChangeLogs, loadSupplierPrices],
  );

  const handleCreateSupplier = () => {
    setSupplierEditId(null);
    setSupplierInitialValues({ is_active: true, payment_terms_days: 0, price_type: '含税' });
    setSupplierModalOpen(true);
  };

  const handleEditSupplier = (record: FinanceSupplierRow) => {
    setSupplierEditId(record.id);
    setSupplierInitialValues({
      supplier_code: record.supplier_code,
      supplier_name: record.supplier_name,
      tax_no: record.tax_no ?? undefined,
      contact_name: record.contact_name ?? undefined,
      contact_phone: record.contact_phone ?? undefined,
      payment_terms_days: record.payment_terms_days,
      settlement_method: record.settlement_method ?? undefined,
      is_active: record.is_active,
      remark: record.remark ?? undefined,
    });
    setSupplierModalOpen(true);
  };

  const handleDeleteSupplier = (record: FinanceSupplierRow) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      content: `确定删除供应商「${record.supplier_name}」？`,
      okType: 'danger',
      onOk: async () => {
        await deleteFinanceSupplier(record.id);
        messageApi.success('已删除');
        if (detailRecord?.id === record.id) {
          setDetailOpen(false);
          setDetailRecord(null);
        }
        actionRef.current?.reload();
      },
    });
  };

  const submitSupplier = async (values: Record<string, unknown>) => {
    setSupplierFormLoading(true);
    try {
      const payload: FinanceSupplierCreatePayload = {
        supplier_code: String(values.supplier_code ?? '').trim(),
        supplier_name: String(values.supplier_name ?? '').trim(),
        tax_no: String(values.tax_no ?? '').trim() || null,
        contact_name: String(values.contact_name ?? '').trim() || null,
        contact_phone: String(values.contact_phone ?? '').trim() || null,
        payment_terms_days: Number(values.payment_terms_days ?? 0),
        settlement_method: String(values.settlement_method ?? '').trim() || null,
        is_active: Boolean(values.is_active ?? true),
        remark: String(values.remark ?? '').trim() || null,
      };
      if (supplierEditId != null) {
        await updateFinanceSupplier(supplierEditId, payload);
        messageApi.success('已更新');
        if (detailRecord?.id === supplierEditId) {
          const refreshed = await listFinanceSuppliers({ keyword: payload.supplier_code });
          const hit = refreshed.find((r) => r.id === supplierEditId);
          if (hit) setDetailRecord(hit);
        }
      } else {
        await createFinanceSupplier(payload);
        messageApi.success('已创建');
      }
      setSupplierModalOpen(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setSupplierFormLoading(false);
    }
  };

  const openAddPrice = () => {
    priceFormRef.current?.resetFields();
    setPriceModalOpen(true);
  };

  const submitPrice = async (values: Record<string, unknown>) => {
    if (!detailRecord) return;
    setPriceFormLoading(true);
    try {
      const body: FinanceSupplierPriceCreatePayload = {
        material_code: String(values.material_code ?? '').trim(),
        material_name: String(values.material_name ?? '').trim(),
        spec: String(values.spec ?? '').trim() || null,
        unit: String(values.unit ?? '').trim() || null,
        unit_price: Number(values.unit_price),
        price_type: (values.price_type as '含税' | '不含税') ?? '含税',
        tax_rate: values.tax_rate != null && values.tax_rate !== '' ? Number(values.tax_rate) : null,
        remark: String(values.remark ?? '').trim() || null,
      };
      await createFinanceSupplierPrice(detailRecord.id, body);
      messageApi.success('单价已保存');
      setPriceModalOpen(false);
      await Promise.all([loadSupplierPrices(detailRecord.id), loadChangeLogs(detailRecord.id)]);
    } catch (e) {
      messageApi.error((e as Error).message || '保存单价失败');
      throw e;
    } finally {
      setPriceFormLoading(false);
    }
  };

  const openChangePrice = (row: FinanceSupplierPriceRow) => {
    setChangePriceTarget(row);
    changePriceFormRef.current?.setFieldsValue({ unit_price: row.unit_price, remark: row.remark });
    setChangePriceModalOpen(true);
  };

  const submitChangePrice = async (values: Record<string, unknown>) => {
    if (!detailRecord || !changePriceTarget) return;
    setChangePriceLoading(true);
    try {
      await changeFinanceSupplierPrice(changePriceTarget.id, {
        unit_price: Number(values.unit_price),
        remark: String(values.remark ?? '').trim() || null,
      });
      messageApi.success('改价成功（旧价已保留）');
      setChangePriceModalOpen(false);
      setChangePriceTarget(null);
      await Promise.all([loadSupplierPrices(detailRecord.id), loadChangeLogs(detailRecord.id)]);
    } catch (e) {
      messageApi.error((e as Error).message || '改价失败');
      throw e;
    } finally {
      setChangePriceLoading(false);
    }
  };

  const detailItems: ProDescriptionsItemProps<FinanceSupplierRow>[] = useMemo(
    () => [
      { title: '名称', dataIndex: 'supplier_name' },
      { title: '税号', dataIndex: 'tax_no', render: (_, r) => r.tax_no || '—' },
      { title: '联系人', dataIndex: 'contact_name', render: (_, r) => r.contact_name || '—' },
      { title: '联系电话', dataIndex: 'contact_phone', render: (_, r) => r.contact_phone || '—' },
      { title: '账期（天）', dataIndex: 'payment_terms_days' },
      { title: '结算方式', dataIndex: 'settlement_method', render: (_, r) => r.settlement_method || '—' },
      { title: '状态', dataIndex: 'is_active', render: (_, r) => activeTag(r.is_active) },
      { title: '备注', dataIndex: 'remark', span: 2, render: (_, r) => r.remark || '—' },
    ],
    [],
  );

  const handleBatchDeleteSuppliers = async (keys: React.Key[]) => {
    const ids = Array.from(new Set(keys.map((key) => Number(key)).filter((id) => Number.isFinite(id))));
    if (ids.length === 0) return;
    const result = await batchDeleteFinanceSuppliers(ids);
    if (detailRecord && ids.includes(detailRecord.id)) {
      setDetailOpen(false);
      setDetailRecord(null);
    }
    if (result.deleted_count > 0) {
      messageApi.success(`已删除 ${result.deleted_count} 条`);
      actionRef.current?.reload();
    }
    const skipped = ids.length - result.deleted_count;
    if (skipped > 0) {
      messageApi.warning(`${skipped} 条不存在或已删除`);
    }
  };

  const columns: ProColumns<FinanceSupplierRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '名称 / 税号 / 联系人' },
    },
    {
      title: '名称',
      dataIndex: 'supplier_name',
      width: 220,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '账期（天）',
      dataIndex: 'payment_terms_days',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '结算方式',
      dataIndex: 'settlement_method',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.settlement_method || '—',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      hideInSearch: true,
      render: (_, r) => activeTag(r.is_active),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => void openDetail(record)}>
          详情
        </Button>,
        perms.canUpdate ? (
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditSupplier(record)}>
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
            onClick={() => handleDeleteSupplier(record)}
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
        <UniTable<FinanceSupplierRow>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          permissionResource={HAOLIGO_FINANCE_SUPPLIERS_RESOURCE}
          showAdvancedSearch
          showCreateButton
          onCreate={handleCreateSupplier}
          enableRowSelection
          showDeleteButton
          onDelete={handleBatchDeleteSuppliers}
          deleteButtonText="批量删除"
          deleteConfirmTitle="批量删除供应商"
          deleteConfirmDescription={(count) => `确定删除选中的 ${count} 家供应商？关联价格明细将一并不可用。`}
          showImportButton
          importHeaders={SUPPLIER_IMPORT_TEMPLATE.importHeaders}
          importExampleRow={[...SUPPLIER_IMPORT_TEMPLATE.importExampleRow]}
          importFieldMap={{ ...SUPPLIER_IMPORT_TEMPLATE.importHeaderMap }}
          importTemplateName="供应商台账导入模板"
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入文件为空或缺少表头');
              return;
            }
            const headers = (data[0] || []).map((h: unknown) => String(h ?? '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              SUPPLIER_IMPORT_TEMPLATE.importHeaderMap,
            );
            if (headerIndexMap.supplier_code === undefined || headerIndexMap.supplier_name === undefined) {
              messageApi.error('缺少必填列：代号、名称');
              return;
            }
            const importRows = data.slice(2).filter((row: unknown[]) =>
              row?.some((cell) => cell != null && String(cell).trim() !== ''),
            );
            const rows: FinanceSupplierImportRowPayload[] = [];
            for (let i = 0; i < importRows.length; i++) {
              const row = importRows[i] as unknown[];
              const supplier_code = String(row[headerIndexMap.supplier_code] ?? '').trim();
              const supplier_name = String(row[headerIndexMap.supplier_name] ?? '').trim();
              if (!supplier_code && !supplier_name) continue;
              if (!supplier_code || !supplier_name) {
                messageApi.error(`第 ${i + 3} 行：代号与名称均为必填`);
                return;
              }
              rows.push({
                supplier_code,
                supplier_name,
                payment_terms_days:
                  headerIndexMap.payment_terms_days !== undefined
                    ? parseImportIntCell(row[headerIndexMap.payment_terms_days])
                    : 0,
                settlement_method:
                  headerIndexMap.settlement_method !== undefined
                    ? String(row[headerIndexMap.settlement_method] ?? '').trim() || null
                    : null,
                tax_no:
                  headerIndexMap.tax_no !== undefined
                    ? String(row[headerIndexMap.tax_no] ?? '').trim() || null
                    : null,
                contact_name:
                  headerIndexMap.contact_name !== undefined
                    ? String(row[headerIndexMap.contact_name] ?? '').trim() || null
                    : null,
                contact_phone:
                  headerIndexMap.contact_phone !== undefined
                    ? String(row[headerIndexMap.contact_phone] ?? '').trim() || null
                    : null,
                is_active:
                  headerIndexMap.is_active !== undefined
                    ? parseImportActiveCell(row[headerIndexMap.is_active])
                    : true,
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
            const result = await importFinanceSuppliers(rows);
            if (result.created_count > 0) {
              messageApi.success(`成功导入 ${result.created_count} 条`);
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
            const rows = await listFinanceSuppliers({ keyword });
            return { data: rows, success: true, total: rows.length };
          }}
          rowActionKind={rowActionKind.link}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={supplierEditId != null ? '编辑供应商' : '新建供应商'}
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        formRef={supplierFormRef}
        initialValues={supplierInitialValues}
        loading={supplierFormLoading}
        onFinish={submitSupplier}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText name="supplier_code" label="代号" rules={[{ required: true }]} />
        <ProFormText name="supplier_name" label="名称" rules={[{ required: true }]} />
        <ProFormText name="tax_no" label="税号" />
        <ProFormText name="contact_name" label="联系人" />
        <ProFormText name="contact_phone" label="联系电话" />
        <ProFormDigit name="payment_terms_days" label="账期（天）" min={0} fieldProps={{ precision: 0 }} />
        <ProFormText name="settlement_method" label="结算方式" />
        <ProFormSwitch name="is_active" label="启用" />
        <ProFormTextArea name="remark" label="备注" />
      </FormModalTemplate>

      <UniDetail
        title={detailRecord ? detailRecord.supplier_name : '供应商详情'}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
      >
        {detailRecord ? (
          <>
            <DetailDrawerSection title="基本信息">
              {detailDrawerDescriptionItems(detailItems, detailRecord)}
            </DetailDrawerSection>
            <DetailDrawerSection
              title={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>物料单价清单</span>
                  {perms.canCreate ? (
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddPrice}>
                      添加单价
                    </Button>
                  ) : null}
                </Space>
              }
            >
              <Table<FinanceSupplierPriceRow>
                size="small"
                rowKey="id"
                loading={priceLoading}
                dataSource={priceRows}
                pagination={false}
                scroll={{ x: 900 }}
                columns={[
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: '规格', dataIndex: 'spec', width: 100, render: (v) => v || '—' },
                  { title: '单位', dataIndex: 'unit', width: 60, render: (v) => v || '—' },
                  {
                    title: '单价',
                    dataIndex: 'unit_price',
                    width: 100,
                    render: (v) => formatFinanceUnitPrice(v),
                  },
                  { title: '价类', dataIndex: 'price_type', width: 72 },
                  {
                    title: '生效自',
                    dataIndex: 'effective_from',
                    width: 110,
                    render: (v) => v || '—',
                  },
                  {
                    title: '操作',
                    width: 80,
                    render: (_, row) =>
                      perms.canUpdate ? (
                        <Button type="link" size="small" onClick={() => openChangePrice(row)}>
                          改价
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </DetailDrawerSection>
            <DetailDrawerSection title="改价记录（最近 50 条）">
              <Table<FinancePriceChangeLogRow>
                size="small"
                rowKey="id"
                loading={changeLogLoading}
                dataSource={changeLogs}
                pagination={false}
                scroll={{ x: 800 }}
                columns={[
                  { title: '物料', dataIndex: 'material_code', width: 100 },
                  { title: '名称', dataIndex: 'material_name', width: 120, ellipsis: true },
                  {
                    title: '旧价',
                    dataIndex: 'old_unit_price',
                    width: 80,
                    render: (v) => (v != null ? formatFinanceUnitPrice(v) : '—'),
                  },
                  {
                    title: '新价',
                    dataIndex: 'new_unit_price',
                    width: 80,
                    render: (v) => formatFinanceUnitPrice(v),
                  },
                  { title: '来源', dataIndex: 'change_source', width: 100 },
                  { title: '操作人', dataIndex: 'operator_user_name', width: 80, render: (v) => v || '—' },
                  {
                    title: '时间',
                    dataIndex: 'created_at',
                    width: 150,
                    render: (v) => (v ? formatDateTime(String(v)) : '—'),
                  },
                ]}
              />
            </DetailDrawerSection>
          </>
        ) : (
          <Typography.Text type="secondary">请选择供应商</Typography.Text>
        )}
      </UniDetail>

      <FormModalTemplate
        title="添加物料单价"
        open={priceModalOpen}
        onClose={() => setPriceModalOpen(false)}
        formRef={priceFormRef}
        initialValues={{ price_type: '含税' }}
        loading={priceFormLoading}
        onFinish={submitPrice}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText name="material_code" label="物料编码" rules={[{ required: true }]} />
        <ProFormText name="material_name" label="物料名称" rules={[{ required: true }]} />
        <ProFormText name="spec" label="规格" />
        <ProFormText name="unit" label="单位" />
        <ProFormDigit name="unit_price" label="单价" min={0} rules={[{ required: true }]} fieldProps={{ precision: 4 }} />
        <ProFormSelect name="price_type" label="价类" options={PRICE_TYPE_OPTIONS} rules={[{ required: true }]} />
        <ProFormDigit name="tax_rate" label="税率（%）" min={0} fieldProps={{ precision: 2 }} />
        <ProFormTextArea name="remark" label="备注" />
      </FormModalTemplate>

      <FormModalTemplate
        title={changePriceTarget ? `改价 · ${changePriceTarget.material_code}` : '改价'}
        open={changePriceModalOpen}
        onClose={() => setChangePriceModalOpen(false)}
        formRef={changePriceFormRef}
        loading={changePriceLoading}
        onFinish={submitChangePrice}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Typography.Paragraph type="secondary">
          改价将关闭当前有效行并新增价格行，历史单价可在下方改价记录中查看。
        </Typography.Paragraph>
        <ProFormDigit name="unit_price" label="新单价" min={0} rules={[{ required: true }]} fieldProps={{ precision: 4 }} />
        <ProFormTextArea name="remark" label="备注" />
      </FormModalTemplate>
    </>
  );
};

export default FinanceSuppliersPage;
