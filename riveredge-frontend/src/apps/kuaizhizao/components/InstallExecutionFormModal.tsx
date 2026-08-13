/**
 * 安装执行单表单弹窗
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormDateTimePicker,
  ProFormDependency,
} from '@ant-design/pro-components';
import { App, Button, Col, Form, Space, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import {
  INSTALL_COST_TYPES,
  INSTALL_STAGE_STATUSES,
  INSTALL_SUPPLY_SOURCES,
  type InstallExecution,
  type InstallExecutionCostInput,
  type InstallExecutionCreatePayload,
  type InstallExecutionUpdatePayload,
} from '../services/install-execution';
import { listSalesOrders } from '../services/sales-order';
import { warehouseApi } from '../services/warehouse-execution';
import { customerApi, unwrapSupplyPagedList } from '../../master-data/services/supply-chain';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../services/dataDictionary';
import { mapSystemDictionaryItemOptions } from '../../../utils/systemDictionaryI18n';

const INSTALL_STAGE_DICT_CODE = 'INSTALL_EXECUTION_STAGE';

const FALLBACK_STAGE_OPTIONS = [
  { label: '到货确认', value: 'arrival_confirm' },
  { label: '就位安装', value: 'installation' },
  { label: '联调', value: 'commissioning' },
  { label: '试运行', value: 'trial_run' },
  { label: '客户验收', value: 'customer_acceptance' },
];

export interface InstallExecutionFormPreset {
  customer_id?: number;
  sales_order_id?: number;
  sales_delivery_id?: number;
  packing_binding_id?: number;
  supply_source?: string;
}

interface Props {
  open: boolean;
  editing?: InstallExecution | null;
  preset?: InstallExecutionFormPreset;
  onClose: () => void;
  onSaved: (row: InstallExecution) => void;
  onCreate: (payload: InstallExecutionCreatePayload) => Promise<InstallExecution>;
  onUpdate: (id: number, payload: InstallExecutionUpdatePayload) => Promise<InstallExecution>;
}

type StageRow = {
  key: string;
  stage_key: string;
  stage_name: string;
  status: string;
  planned_at?: string;
  actual_at?: string;
  notes?: string;
};

type CostRow = InstallExecutionCostInput & { key: string };

function stageOptionsForRow(
  row: StageRow,
  stageOptions: { label: string; value: string }[],
): { label: string; value: string }[] {
  if (!row.stage_key || stageOptions.some((opt) => opt.value === row.stage_key)) {
    return stageOptions;
  }
  return [{ label: row.stage_name || row.stage_key, value: row.stage_key }, ...stageOptions];
}

export const InstallExecutionFormModal: React.FC<Props> = ({
  open,
  editing,
  preset,
  onClose,
  onSaved,
  onCreate,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [stages, setStages] = useState<StageRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [customers, setCustomers] = useState<{ id: number; label: string }[]>([]);
  const [stageOptions, setStageOptions] = useState(FALLBACK_STAGE_OPTIONS);

  const isEdit = Boolean(editing?.id);

  const applyEditingToForm = (row: InstallExecution) => {
    form.setFieldsValue({
      customer_id: row.customer_id,
      supply_source: row.supply_source,
      site_address: row.site_address ?? undefined,
      owner_name: row.owner_name ?? undefined,
      notes: row.notes ?? undefined,
      sales_order_id: row.sales_order_id ?? undefined,
      sales_delivery_id: row.sales_delivery_id ?? undefined,
      packing_binding_id: row.packing_binding_id ?? undefined,
    });
    setStages(
      (row.stages ?? []).map((s, idx) => ({
        key: `${s.id ?? s.stage_key}-${idx}`,
        stage_key: s.stage_key,
        stage_name: s.stage_name,
        status: s.status,
        planned_at: s.planned_at ?? undefined,
        actual_at: s.actual_at ?? undefined,
        notes: s.notes ?? undefined,
      })),
    );
    setCosts(
      (row.costs ?? []).map((c, idx) => ({
        key: `${c.id ?? idx}`,
        cost_type: c.cost_type,
        amount: Number(c.amount),
        occurred_at: c.occurred_at,
        description: c.description ?? undefined,
      })),
    );
  };

  const applyCreateDefaults = (nextPreset?: InstallExecutionFormPreset) => {
    form.resetFields();
    form.setFieldsValue({
      supply_source: nextPreset?.supply_source ?? '自制',
      customer_id: nextPreset?.customer_id,
      sales_order_id: nextPreset?.sales_order_id,
      sales_delivery_id: nextPreset?.sales_delivery_id,
      packing_binding_id: nextPreset?.packing_binding_id,
    });
    setStages([]);
    setCosts([]);
  };

  const formInitialValues = useMemo(() => {
    if (editing) {
      return {
        customer_id: editing.customer_id,
        supply_source: editing.supply_source,
        site_address: editing.site_address ?? undefined,
        owner_name: editing.owner_name ?? undefined,
        notes: editing.notes ?? undefined,
        sales_order_id: editing.sales_order_id ?? undefined,
        sales_delivery_id: editing.sales_delivery_id ?? undefined,
        packing_binding_id: editing.packing_binding_id ?? undefined,
      };
    }
    return {
      supply_source: preset?.supply_source ?? '自制',
      customer_id: preset?.customer_id,
      sales_order_id: preset?.sales_order_id,
      sales_delivery_id: preset?.sales_delivery_id,
      packing_binding_id: preset?.packing_binding_id,
    };
  }, [editing, preset]);

  useEffect(() => {
    if (!open) return;
    void customerApi.list({ limit: 500, isActive: true }).then((res) => {
      const rows = unwrapSupplyPagedList(res);
      setCustomers(
        rows
          .map((c: any) => {
            const id = Number(c?.id ?? c?.customer_id);
            if (!Number.isFinite(id)) return null;
            const code = String(c?.code ?? c?.customer_code ?? '').trim();
            const name = String(c?.name ?? c?.customer_name ?? '').trim();
            return { id, label: [code, name].filter(Boolean).join(' ') || String(id) };
          })
          .filter(Boolean) as { id: number; label: string }[],
      );
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const dict = await getDataDictionaryByCode(INSTALL_STAGE_DICT_CODE);
        const items = await getDictionaryItemList(dict.uuid, true);
        setStageOptions(
          mapSystemDictionaryItemOptions(
            INSTALL_STAGE_DICT_CODE,
            items.sort((a, b) => a.sort_order - b.sort_order),
            t,
          ),
        );
      } catch {
        setStageOptions(FALLBACK_STAGE_OPTIONS);
      }
    })();
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      applyEditingToForm(editing);
      return;
    }
    applyCreateDefaults(preset);
  }, [open, editing, preset, form]);

  const costColumns = useMemo(
    () => [
      {
        title: '费用类型',
        dataIndex: 'cost_type',
        render: (_: unknown, row: CostRow, index: number) => (
          <ProFormSelect
            noStyle
            fieldProps={{
              value: row.cost_type,
              options: INSTALL_COST_TYPES.map((v) => ({ label: v, value: v })),
              onChange: (v) => {
                setCosts((prev) => {
                  const next = [...prev];
                  next[index] = { ...next[index], cost_type: String(v) };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '金额',
        dataIndex: 'amount',
        width: 120,
        render: (_: unknown, row: CostRow, index: number) => (
          <ProFormText
            noStyle
            fieldProps={{
              type: 'number',
              value: row.amount,
              onChange: (e) => {
                setCosts((prev) => {
                  const next = [...prev];
                  next[index] = { ...next[index], amount: Number(e.target.value) };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '发生时间',
        dataIndex: 'occurred_at',
        width: 200,
        render: (_: unknown, row: CostRow, index: number) => (
          <ProFormDateTimePicker
            noStyle
            fieldProps={{
              value: row.occurred_at ? dayjs(row.occurred_at) : undefined,
              style: { width: '100%' },
              onChange: (v) => {
                setCosts((prev) => {
                  const next = [...prev];
                  next[index] = {
                    ...next[index],
                    occurred_at: v ? v.format('YYYY-MM-DD HH:mm:ss') : '',
                  };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '说明',
        dataIndex: 'description',
        render: (_: unknown, row: CostRow, index: number) => (
          <ProFormText
            noStyle
            fieldProps={{
              value: row.description,
              onChange: (e) => {
                setCosts((prev) => {
                  const next = [...prev];
                  next[index] = { ...next[index], description: e.target.value };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '',
        width: 48,
        render: (_: unknown, row: CostRow) => (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setCosts((prev) => prev.filter((c) => c.key !== row.key))}
          />
        ),
      },
    ],
    [],
  );

  const stageColumns = useMemo(
    () => [
      {
        title: '阶段',
        dataIndex: 'stage_key',
        width: 160,
        render: (_: unknown, row: StageRow, index: number) => (
          <ProFormSelect
            noStyle
            fieldProps={{
              value: row.stage_key || undefined,
              options: stageOptionsForRow(row, stageOptions),
              placeholder: '请选择阶段',
              onChange: (v, option) => {
                const label =
                  option && typeof option === 'object' && 'label' in option
                    ? String(option.label ?? '')
                    : stageOptions.find((opt) => opt.value === v)?.label ?? String(v ?? '');
                setStages((prev) => {
                  const next = [...prev];
                  next[index] = {
                    ...next[index],
                    stage_key: String(v),
                    stage_name: label,
                  };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (_: unknown, row: StageRow, index: number) => (
          <ProFormSelect
            noStyle
            fieldProps={{
              value: row.status,
              options: INSTALL_STAGE_STATUSES.map((v) => ({ label: v, value: v })),
              onChange: (v) => {
                setStages((prev) => {
                  const next = [...prev];
                  next[index] = { ...next[index], status: String(v) };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '计划完成',
        dataIndex: 'planned_at',
        width: 200,
        render: (_: unknown, row: StageRow, index: number) => (
          <ProFormDateTimePicker
            noStyle
            fieldProps={{
              value: row.planned_at ? dayjs(row.planned_at) : undefined,
              style: { width: '100%' },
              onChange: (v) => {
                setStages((prev) => {
                  const next = [...prev];
                  next[index] = {
                    ...next[index],
                    planned_at: v ? v.format('YYYY-MM-DD HH:mm:ss') : undefined,
                  };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '实际完成',
        dataIndex: 'actual_at',
        width: 200,
        render: (_: unknown, row: StageRow, index: number) => (
          <ProFormDateTimePicker
            noStyle
            fieldProps={{
              value: row.actual_at ? dayjs(row.actual_at) : undefined,
              style: { width: '100%' },
              onChange: (v) => {
                setStages((prev) => {
                  const next = [...prev];
                  next[index] = {
                    ...next[index],
                    actual_at: v ? v.format('YYYY-MM-DD HH:mm:ss') : undefined,
                  };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '备注',
        dataIndex: 'notes',
        render: (_: unknown, row: StageRow, index: number) => (
          <ProFormText
            noStyle
            fieldProps={{
              value: row.notes,
              onChange: (e) => {
                setStages((prev) => {
                  const next = [...prev];
                  next[index] = { ...next[index], notes: e.target.value };
                  return next;
                });
              },
            }}
          />
        ),
      },
      {
        title: '',
        width: 48,
        render: (_: unknown, row: StageRow) => (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setStages((prev) => prev.filter((s) => s.key !== row.key))}
          />
        ),
      },
    ],
    [stageOptions],
  );

  return (
    <FormModalTemplate
      title={isEdit ? t('app.kuaizhizao.installExecution.editTitle') : t('app.kuaizhizao.installExecution.createTitle')}
      open={open}
      onClose={onClose}
      isEdit={isEdit}
      width={MODAL_CONFIG.LARGE_WIDTH}
      form={form}
      initialValues={formInitialValues}
      afterOpenChange={(visible) => {
        // destroyOnHidden 重挂载后，用 Form 实例再写一遍，避免只依赖 mount 前 formRef
        if (!visible) return;
        if (editing) {
          applyEditingToForm(editing);
          return;
        }
        applyCreateDefaults(preset);
      }}
      grid
      onFinish={async (values) => {
        if (!values.sales_order_id && !values.sales_delivery_id) {
          messageApi.error('请关联销售订单或销售出库单');
          throw new Error('missing source');
        }
        if (stages.some((s) => !s.stage_key)) {
          messageApi.error('请为每一行安装阶段选择阶段');
          throw new Error('missing stage');
        }
        const stageKeys = stages.map((s) => s.stage_key);
        if (new Set(stageKeys).size !== stageKeys.length) {
          messageApi.error('安装阶段不能重复');
          throw new Error('duplicate stage');
        }
        const payload = {
          customer_id: values.customer_id,
          supply_source: values.supply_source,
          site_address: values.site_address,
          owner_name: values.owner_name,
          notes: values.notes,
          sales_order_id: values.sales_order_id,
          sales_delivery_id: values.sales_delivery_id,
          packing_binding_id: values.packing_binding_id,
          stages: stages.map((s) => ({
            stage_key: s.stage_key,
            status: s.status,
            planned_at: s.planned_at,
            actual_at: s.actual_at,
            notes: s.notes,
          })),
          costs: costs.map((c) => ({
            cost_type: c.cost_type,
            amount: c.amount,
            occurred_at: c.occurred_at,
            description: c.description,
          })),
        };
        const saved = isEdit
          ? await onUpdate(editing!.id, payload)
          : await onCreate(payload);
        messageApi.success(isEdit ? '安装执行单已更新' : '安装执行单已创建');
        onSaved(saved);
        onClose();
      }}
    >
      <ProFormSelect
        name="customer_id"
        label="客户"
        rules={[{ required: true }]}
        colProps={{ span: 12 }}
        showSearch
        options={customers.map((c) => ({ label: c.label, value: c.id }))}
        fieldProps={{
          onChange: () => {
            form.setFieldsValue({
              sales_order_id: undefined,
              sales_delivery_id: undefined,
            });
          },
        }}
      />
      <ProFormSelect
        name="supply_source"
        label="供给来源"
        colProps={{ span: 12 }}
        options={INSTALL_SUPPLY_SOURCES.map((v) => ({ label: v, value: v }))}
        rules={[{ required: true }]}
      />
      <ProFormDependency name={['customer_id', 'sales_order_id']}>
        {({ customer_id, sales_order_id }) => (
          <>
            <ProFormSelect
              name="sales_order_id"
              label="关联销售订单"
              colProps={{ span: 12 }}
              showSearch
              debounceTime={300}
              dependencies={['customer_id']}
              disabled={!customer_id}
              placeholder={
                customer_id
                  ? undefined
                  : t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
              }
              request={async ({ keyWords }) => {
                const customerId = Number(customer_id);
                if (!Number.isFinite(customerId) || customerId <= 0) return [];
                const res = await listSalesOrders({
                  limit: 50,
                  keyword: keyWords,
                  view: 'options',
                  customer_id: customerId,
                  order_by: '-order_date',
                });
                const options = (res.data ?? []).map((o) => ({
                  label: `${o.order_code} ${o.customer_name ?? ''}`.trim(),
                  value: o.id,
                }));
                const linkedId = editing?.sales_order_id ?? preset?.sales_order_id;
                const linkedCode = editing?.sales_order_code;
                if (
                  linkedId != null &&
                  Number(editing?.customer_id ?? preset?.customer_id) === customerId &&
                  !options.some((opt) => opt.value === linkedId)
                ) {
                  options.unshift({
                    label: linkedCode || String(linkedId),
                    value: linkedId,
                  });
                }
                return options;
              }}
            />
            <ProFormSelect
              name="sales_delivery_id"
              label="关联销售出库"
              colProps={{ span: 12 }}
              showSearch
              debounceTime={300}
              dependencies={['customer_id', 'sales_order_id']}
              disabled={!customer_id}
              placeholder={
                customer_id
                  ? undefined
                  : t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
              }
              request={async ({ keyWords }) => {
                const customerId = Number(customer_id);
                if (!Number.isFinite(customerId) || customerId <= 0) return [];
                const res = await warehouseApi.salesDelivery.list({
                  limit: 50,
                  keyword: keyWords,
                  customer_id: customerId,
                  sales_order_id: sales_order_id ? Number(sales_order_id) : undefined,
                });
                const rows = (res as { items?: Array<{ id: number; delivery_code?: string; customer_name?: string }> })?.items ?? [];
                const options = rows.map(
                  (o: { id: number; delivery_code?: string; customer_name?: string }) => ({
                    label: `${o.delivery_code ?? o.id} ${o.customer_name ?? ''}`.trim(),
                    value: o.id,
                  }),
                );
                const linkedId = editing?.sales_delivery_id ?? preset?.sales_delivery_id;
                const linkedCode = editing?.sales_delivery_code;
                if (
                  linkedId != null &&
                  Number(editing?.customer_id ?? preset?.customer_id) === customerId &&
                  !options.some((opt) => opt.value === linkedId)
                ) {
                  options.unshift({
                    label: linkedCode || String(linkedId),
                    value: linkedId,
                  });
                }
                return options;
              }}
            />
          </>
        )}
      </ProFormDependency>
      <ProFormText name="site_address" label="现场地址" colProps={{ span: 12 }} />
      <ProFormText name="owner_name" label="负责人" colProps={{ span: 12 }} />

      <Col span={24}>
        <Space style={{ marginBottom: 8 }}>
          <strong>安装阶段</strong>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            disabled={stageOptions.length === 0}
            onClick={() => {
              const used = new Set(stages.map((s) => s.stage_key));
              const nextOpt = stageOptions.find((opt) => !used.has(opt.value)) ?? stageOptions[0];
              if (!nextOpt) return;
              setStages((prev) => [
                ...prev,
                {
                  key: `new-${Date.now()}`,
                  stage_key: nextOpt.value,
                  stage_name: nextOpt.label,
                  status: '待开始',
                },
              ]);
            }}
          >
            添加阶段
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/system/data-dictionaries')}>
            {t('app.kuaizhizao.quality.common.form.dataDictionaryManage')}
          </Button>
        </Space>
        <Table rowKey="key" size="small" pagination={false} columns={stageColumns} dataSource={stages} />
      </Col>

      <Col span={24} style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <strong>相关费用</strong>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() =>
              setCosts((prev) => [
                ...prev,
                {
                  key: `new-${Date.now()}`,
                  cost_type: '人工',
                  amount: 0,
                  occurred_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                },
              ])
            }
          >
            添加费用
          </Button>
        </Space>
        <Table rowKey="key" size="small" pagination={false} columns={costColumns} dataSource={costs} />
      </Col>

      <ProFormTextArea name="notes" label="备注" colProps={{ span: 24 }} fieldProps={{ rows: 2 }} />
    </FormModalTemplate>
  );
};

export function formatInstallStageLabel(stageKey?: string | null, stageName?: string | null) {
  return stageName || stageKey || '-';
}

export function formatInstallCostTotal(amount?: number | string | null) {
  if (amount == null || amount === '') return '-';
  return Number(amount).toFixed(2);
}
