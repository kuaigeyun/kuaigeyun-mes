/**
 * 好力 GO — 模具台账
 *
 * 列表页模板对齐快制造模具页：ListPageTemplate + UniTable + FormModalTemplate。
 * 表单字段对齐产品「新增」模具台账弹窗。
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, AutoComplete, Button, Col, Modal, Row, Space, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  createMold,
  deleteMold,
  getMold,
  listMolds,
  updateMold,
  type MoldCreatePayload,
  type MoldRow,
} from '../../../services/haoligo';
import { supplierApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import type { Supplier } from '../../../../master-data/types/supply-chain';
import { batchImport } from '../../../../../utils/batchOperations';

const MOLD_STATUS = ['在用', '在修', '停用', '待用', '报废', '待启用'] as const;

const statusValueEnum = MOLD_STATUS.reduce<Record<string, { text: string }>>((acc, s) => {
  acc[s] = { text: s };
  return acc;
}, {});

const statusColors: Record<string, string> = {
  在用: 'green',
  在修: 'orange',
  停用: 'default',
  待用: 'blue',
  报废: 'red',
  待启用: 'geekblue',
};

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function decStrOrUndef(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return String(v);
}

function omitMoldLedgerKeys(obj: MoldCreatePayload): Record<string, unknown> {
  const { mold_code: _code, total_manufacture_qty: _qty, ...rest } = obj;
  void _code;
  void _qty;
  return rest as Record<string, unknown>;
}

function parseBoolCell(v: unknown): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (['是', 'true', '1', 'yes', 'y'].includes(s)) return true;
  if (['否', 'false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

const MoldLedgerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await supplierApi.list({ limit: 1000, isActive: true });
        const list = unwrapSupplyPagedList<Supplier>(res);
        if (cancelled) return;
        setSupplierOptions(
          list.map((s) => ({
            key: s.uuid,
            value: s.name,
            label: s.code ? `${s.code} · ${s.name}` : s.name,
          })),
        );
      } catch {
        if (!cancelled) setSupplierOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      status: '待用',
      allow_repeated_borrow: true,
      mold_capacity: undefined,
      unit: undefined,
    });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldRow) => {
    try {
      const detail = await getMold(record.id);
      setIsEdit(true);
      setEditId(detail.id);
      setFormInitialValues({
        mold_code: detail.mold_code,
        name: detail.name,
        unit: detail.unit || '',
        mold_capacity: detail.mold_capacity != null ? Number(detail.mold_capacity) : undefined,
        processing_time_min: detail.processing_time_min ?? undefined,
        service_life_years: detail.service_life_years ?? undefined,
        usable_times: detail.usable_times ?? undefined,
        usable_yield: detail.usable_yield != null ? Number(detail.usable_yield) : undefined,
        maintenance_cycle_by_yield:
          detail.maintenance_cycle_by_yield != null ? Number(detail.maintenance_cycle_by_yield) : undefined,
        maintenance_cycle_by_days: detail.maintenance_cycle_by_days ?? undefined,
        allow_repeated_borrow: detail.allow_repeated_borrow ?? true,
        purchase_vendor_name: detail.purchase_vendor_name ?? undefined,
        status: detail.status,
        remark: detail.remark ?? undefined,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载模具失败');
    }
  };

  const handleDeleteOne = (record: MoldRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除模具「${record.name}」（${record.mold_code}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMold(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const buildPayload = (values: Record<string, unknown>): MoldCreatePayload => ({
    mold_code: String(values.mold_code ?? '').trim(),
    name: String(values.name ?? '').trim(),
    unit: String(values.unit ?? '').trim(),
    mold_capacity: values.mold_capacity != null && values.mold_capacity !== '' ? Number(values.mold_capacity) : 0,
    processing_time_min: numOrUndef(values.processing_time_min),
    service_life_years: numOrUndef(values.service_life_years),
    usable_times: numOrUndef(values.usable_times),
    usable_yield: decStrOrUndef(values.usable_yield),
    maintenance_cycle_by_yield: decStrOrUndef(values.maintenance_cycle_by_yield),
    maintenance_cycle_by_days: numOrUndef(values.maintenance_cycle_by_days),
    allow_repeated_borrow: Boolean(values.allow_repeated_borrow),
    purchase_vendor_name: String(values.purchase_vendor_name ?? '').trim() || null,
    status: String(values.status ?? '待用'),
    total_manufacture_qty: 0,
    remark: String(values.remark ?? '').trim() || null,
  });

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        const full = buildPayload(values);
        await updateMold(editId, omitMoldLedgerKeys(full));
        messageApi.success('已保存');
      } else {
        await createMold(buildPayload(values));
        messageApi.success('已创建');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<MoldRow>[] = [
    { title: '模具代号', dataIndex: 'mold_code', width: 120, ellipsis: true, fixed: 'left' },
    { title: '模具名称', dataIndex: 'name', width: 180, ellipsis: true },
    { title: '单位', dataIndex: 'unit', width: 72, hideInSearch: true },
    { title: '模具产能', dataIndex: 'mold_capacity', width: 100, hideInSearch: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      valueType: 'select',
      valueEnum: statusValueEnum,
      render: (_, r) => <Tag color={statusColors[r.status] || 'default'}>{r.status}</Tag>,
    },
    {
      title: '允许重复领用',
      dataIndex: 'allow_repeated_borrow',
      width: 120,
      hideInSearch: true,
      render: (_, r) => <Tag color={r.allow_repeated_borrow ? 'blue' : 'default'}>{r.allow_repeated_borrow ? '是' : '否'}</Tag>,
    },
    { title: '总制造数量', dataIndex: 'total_manufacture_qty', width: 108, hideInSearch: true },
    { title: '购买厂商', dataIndex: 'purchase_vendor_name', width: 140, ellipsis: true, hideInSearch: true },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => void handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldRow>
          headerTitle="模具台账"
          columnPersistenceId="apps.haoligo.pages.molds.ledger"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          showImportButton
          importHeaders={[
            '*模具代号',
            '*模具名称',
            '*单位',
            '*模具产能',
            '状态',
            '允许重复领用',
            '加工时间(分钟)',
            '可用年限',
            '可用次数',
            '可用产量',
            '维修周期(依产量)',
            '维修周期(依天数)',
            '购买厂商',
            '备注',
          ]}
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入数据为空或格式不正确');
              return;
            }
            const headers = (data[0] || []).map((h: unknown) => String(h ?? '').trim());
            const getIdx = (...keys: string[]) => {
              for (const k of keys) {
                const i = headers.findIndex(
                  (h: string) => h.includes(k) || h.replace(/\*/g, '').toLowerCase().includes(k.toLowerCase()),
                );
                if (i >= 0) return i;
              }
              return -1;
            };
            const codeIdx = getIdx('模具代号', '代号', 'code');
            const nameIdx = getIdx('模具名称', '名称', 'name');
            const unitIdx = getIdx('单位', 'unit');
            const capIdx = getIdx('模具产能', '产能', 'capacity');
            if (codeIdx < 0 || nameIdx < 0 || unitIdx < 0 || capIdx < 0) {
              messageApi.error('导入表头需包含：模具代号、模具名称、单位、模具产能');
              return;
            }
            const statusIdx = getIdx('状态', 'status');
            const borrowIdx = getIdx('允许重复领用', '重复领用');
            const procIdx = getIdx('加工时间', 'processing');
            const yearsIdx = getIdx('可用年限', '年限');
            const timesIdx = getIdx('可用次数', '次数');
            const yieldIdx = getIdx('可用产量', '产量');
            const maintYIdx = getIdx('维修周期(依产量)', '依产量', 'maintenance_cycle_by_yield');
            const maintDIdx = getIdx('维修周期(依天数)', '依天数', 'maintenance_cycle_by_days');
            const vendorIdx = getIdx('购买厂商', '厂商');
            const remarkIdx = getIdx('备注', 'remark');

            const items: MoldCreatePayload[] = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i] as unknown[];
              if (!row || row.length === 0) continue;
              const mold_code = String(row[codeIdx] ?? '').trim();
              const name = String(row[nameIdx] ?? '').trim();
              const unit = String(row[unitIdx] ?? '').trim();
              const capRaw = row[capIdx];
              const mold_capacity =
                capRaw !== null && capRaw !== undefined && capRaw !== '' ? Number(capRaw) : Number.NaN;
              if (!mold_code || !name || !unit || !Number.isFinite(mold_capacity)) continue;
              const allowCell = borrowIdx >= 0 ? parseBoolCell(row[borrowIdx]) : undefined;
              items.push({
                mold_code,
                name,
                unit,
                mold_capacity,
                processing_time_min: procIdx >= 0 ? numOrUndef(row[procIdx]) : undefined,
                service_life_years: yearsIdx >= 0 ? numOrUndef(row[yearsIdx]) : undefined,
                usable_times: timesIdx >= 0 ? numOrUndef(row[timesIdx]) : undefined,
                usable_yield: yieldIdx >= 0 ? decStrOrUndef(row[yieldIdx]) : undefined,
                maintenance_cycle_by_yield: maintYIdx >= 0 ? decStrOrUndef(row[maintYIdx]) : undefined,
                maintenance_cycle_by_days: maintDIdx >= 0 ? numOrUndef(row[maintDIdx]) : undefined,
                allow_repeated_borrow: allowCell ?? true,
                purchase_vendor_name:
                  vendorIdx >= 0 ? String(row[vendorIdx] ?? '').trim() || null : null,
                status:
                  statusIdx >= 0 && String(row[statusIdx] ?? '').trim()
                    ? String(row[statusIdx]).trim()
                    : '待用',
                total_manufacture_qty: 0,
                remark: remarkIdx >= 0 ? String(row[remarkIdx] ?? '').trim() || null : null,
              });
            }
            if (items.length === 0) {
              messageApi.warning('没有可导入的有效数据（请检查必填列是否完整）');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createMold(item),
              title: '导入模具台账',
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(`成功导入 ${result.successCount} 条`);
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(`部分失败 ${result.failureCount} 条`);
            }
          }}
          showSyncButton
          onSync={() => {
            messageApi.info('与 ERP / 数据集的主数据同步能力接入后将在此执行；已刷新当前列表。');
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listMolds({
                skip,
                limit: pageSize,
                status: typeof searchFormValues?.status === 'string' ? searchFormValues.status : undefined,
              });
              return {
                data: res.items,
                success: true,
                total: res.total,
              };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑' : '新增'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="mold_code"
              label="模具代号"
              placeholder="请输入模具代号"
              disabled={isEdit}
              rules={[{ required: true, message: '请输入模具代号' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label="模具名称"
              placeholder="请输入模具名称"
              rules={[{ required: true, message: '请输入模具名称' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="unit" label="单位" placeholder="请输入单位" rules={[{ required: true, message: '请输入单位' }]} />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="mold_capacity"
              label="模具产能"
              placeholder="请输入模具产能"
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
              rules={[{ required: true, message: '请输入模具产能' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="processing_time_min"
              label="加工时间(分钟)"
              placeholder="请输入加工时间(分钟)"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="service_life_years"
              label="可用年限"
              placeholder="请输入可用年限"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="usable_times"
              label="可用次数"
              placeholder="请输入可用次数"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="usable_yield"
              label="可用产量"
              placeholder="请输入可用产量"
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="maintenance_cycle_by_yield"
              label="维修周期(依产量)"
              placeholder="请输入维修周期(依产量)"
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="maintenance_cycle_by_days"
              label="维修周期(依天数)"
              placeholder="请输入维修周期(依天数)"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label="状态"
              placeholder="请选择状态"
              rules={[{ required: true, message: '请选择状态' }]}
              options={MOLD_STATUS.map((s) => ({ label: s, value: s }))}
            />
          </Col>
          <Col span={12}>
            <ProForm.Item name="purchase_vendor_name" label="购买厂商">
              <AutoComplete
                options={supplierOptions}
                placeholder="请选择或输入购买厂商"
                allowClear
                filterOption={(input, option) => {
                  const q = input.trim().toLowerCase();
                  if (!q) return true;
                  const label = String(option?.label ?? '').toLowerCase();
                  const value = String(option?.value ?? '').toLowerCase();
                  return label.includes(q) || value.includes(q);
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label="备注" placeholder="请输入备注" fieldProps={{ rows: 3 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="allow_repeated_borrow" label="允许重复领用" />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default MoldLedgerPage;
