/**
 * 好力 GO — 设备台账
 *
 * 列表：ListPageTemplate + UniTable（服务端分页，支持车间 / 代号 / 名称筛选）。
 * 表单：类别、车间必填；制造厂商、点检方案、出厂日期、备注可选；设备代号创建后不可改。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Modal, Row, Space } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  listCategories,
  listEquipments,
  listInspectionParamSets,
  listManufacturers,
  listWorkshops,
  updateEquipment,
  type CategoryRow,
  type EquipmentCreatePayload,
  type EquipmentRow,
  type EquipmentUpdatePayload,
  type InspectionParamSetRow,
  type ManufacturerRow,
  type WorkshopRow,
} from '../../../services/haoligo';
import { batchImport } from '../../../../../utils/batchOperations';

function toIsoDate(v: unknown): string | null | undefined {
  if (v == null || v === '') return null;
  if (dayjs.isDayjs(v)) return v.format('YYYY-MM-DD');
  const s = String(v).trim();
  return s ? s.slice(0, 10) : null;
}

const EquipmentLedgerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [paramSets, setParamSets] = useState<InspectionParamSetRow[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);

  const loadLookups = useCallback(async () => {
    try {
      const [ws, cat, mfr, sets] = await Promise.all([
        listWorkshops(),
        listCategories(),
        listManufacturers(),
        listInspectionParamSets(),
      ]);
      setWorkshops(ws);
      setCategories(cat);
      setManufacturers(mfr);
      setParamSets(sets);
    } catch (e) {
      messageApi.error((e as Error).message || '加载主数据失败');
    }
  }, [messageApi]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const workshopOptions = useMemo(
    () => workshops.map((w) => ({ label: `${w.code} · ${w.name}`, value: w.id })),
    [workshops],
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: `${c.code} · ${c.name}`, value: c.id })),
    [categories],
  );
  const manufacturerOptions = useMemo(
    () => manufacturers.map((m) => ({ label: `${m.code} · ${m.name}`, value: m.id })),
    [manufacturers],
  );
  const paramSetOptions = useMemo(
    () => paramSets.map((s) => ({ label: `${s.code} · ${s.name}`, value: s.id })),
    [paramSets],
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const wsMap = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const mfrMap = useMemo(() => new Map(manufacturers.map((m) => [m.id, m])), [manufacturers]);
  const setMap = useMemo(() => new Map(paramSets.map((s) => [s.id, s])), [paramSets]);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  const handleEdit = async (record: EquipmentRow) => {
    try {
      const detail = await getEquipment(record.id);
      setIsEdit(true);
      setEditId(detail.id);
      setFormInitialValues({
        asset_code: detail.asset_code,
        name: detail.name,
        category_id: detail.category_id,
        workshop_id: detail.workshop_id,
        manufacturer_id: detail.manufacturer_id ?? undefined,
        inspection_param_set_id: detail.inspection_param_set_id ?? undefined,
        manufacture_date: detail.manufacture_date ? dayjs(detail.manufacture_date) : undefined,
        remark: detail.remark ?? '',
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载设备失败');
    }
  };

  const handleDeleteOne = (record: EquipmentRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除设备「${record.name}」（${record.asset_code}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEquipment(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const buildCreatePayload = (values: Record<string, unknown>): EquipmentCreatePayload => ({
    asset_code: String(values.asset_code ?? '').trim(),
    name: String(values.name ?? '').trim(),
    category_id: Number(values.category_id),
    workshop_id: Number(values.workshop_id),
    manufacturer_id:
      values.manufacturer_id != null && values.manufacturer_id !== '' ? Number(values.manufacturer_id) : null,
    inspection_param_set_id:
      values.inspection_param_set_id != null && values.inspection_param_set_id !== ''
        ? Number(values.inspection_param_set_id)
        : null,
    manufacture_date: toIsoDate(values.manufacture_date) ?? null,
    remark: String(values.remark ?? '').trim() || null,
  });

  const buildUpdatePayload = (values: Record<string, unknown>): EquipmentUpdatePayload => ({
    name: String(values.name ?? '').trim(),
    category_id: Number(values.category_id),
    workshop_id: Number(values.workshop_id),
    manufacturer_id:
      values.manufacturer_id != null && values.manufacturer_id !== '' ? Number(values.manufacturer_id) : null,
    inspection_param_set_id:
      values.inspection_param_set_id != null && values.inspection_param_set_id !== ''
        ? Number(values.inspection_param_set_id)
        : null,
    manufacture_date: toIsoDate(values.manufacture_date) ?? null,
    remark: String(values.remark ?? '').trim() || null,
  });

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateEquipment(editId, buildUpdatePayload(values));
        messageApi.success('已保存');
      } else {
        await createEquipment(buildCreatePayload(values));
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

  const columns: ProColumns<EquipmentRow>[] = [
    { title: '设备代号', dataIndex: 'asset_code', width: 120, ellipsis: true, fixed: 'left' },
    { title: '设备名称', dataIndex: 'name', width: 180, ellipsis: true },
    {
      title: '类别',
      dataIndex: 'category_id',
      width: 160,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => {
        const c = catMap.get(r.category_id);
        return c ? `${c.code} · ${c.name}` : r.category_id;
      },
    },
    {
      title: '车间',
      dataIndex: 'workshop_id',
      width: 140,
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: workshopOptions, allowClear: true, placeholder: '全部车间' },
    },
    {
      title: '车间',
      dataIndex: 'workshop_id',
      width: 160,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => {
        const w = wsMap.get(r.workshop_id);
        return w ? `${w.code} · ${w.name}` : r.workshop_id;
      },
    },
    {
      title: '制造厂商',
      dataIndex: 'manufacturer_id',
      width: 140,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => {
        if (r.manufacturer_id == null) return '—';
        const m = mfrMap.get(r.manufacturer_id);
        return m ? `${m.code} · ${m.name}` : r.manufacturer_id;
      },
    },
    {
      title: '点检方案',
      dataIndex: 'inspection_param_set_id',
      width: 160,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => {
        if (r.inspection_param_set_id == null) return '—';
        const s = setMap.get(r.inspection_param_set_id);
        return s ? `${s.code} · ${s.name}` : r.inspection_param_set_id;
      },
    },
    {
      title: '出厂日期',
      dataIndex: 'manufacture_date',
      width: 112,
      hideInSearch: true,
      render: (_, r) => (r.manufacture_date ? String(r.manufacture_date).slice(0, 10) : '—'),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, hideInSearch: true },
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

  const codeMap = useMemo(() => {
    const cat = new Map(categories.map((c) => [c.code.trim().toUpperCase(), c.id]));
    const ws = new Map(workshops.map((w) => [w.code.trim().toUpperCase(), w.id]));
    const mfr = new Map(manufacturers.map((m) => [m.code.trim().toUpperCase(), m.id]));
    const ps = new Map(paramSets.map((s) => [s.code.trim().toUpperCase(), s.id]));
    return { cat, ws, mfr, ps };
  }, [categories, workshops, manufacturers, paramSets]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentRow>
          headerTitle="设备台账"
          columnPersistenceId="apps.haoligo.pages.equipment.ledger"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          showImportButton
          importHeaders={[
            '*设备代号',
            '*设备名称',
            '*类别编码',
            '*车间编码',
            '制造厂商编码',
            '点检方案编码',
            '出厂日期',
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
            const acIdx = getIdx('设备代号', '代号', 'asset');
            const nameIdx = getIdx('设备名称', '名称', 'name');
            const catIdx = getIdx('类别编码', '类别', 'category');
            const wsIdx = getIdx('车间编码', '车间', 'workshop');
            const mfrIdx = getIdx('制造厂商编码', '厂商', 'manufacturer');
            const setIdx = getIdx('点检方案编码', '方案', 'param set', 'paramset');
            const dateIdx = getIdx('出厂日期', '日期', 'manufacture');
            const remarkIdx = getIdx('备注', 'remark');
            if (acIdx < 0 || nameIdx < 0 || catIdx < 0 || wsIdx < 0) {
              messageApi.error('导入表头需包含：设备代号、设备名称、类别编码、车间编码');
              return;
            }
            const items: EquipmentCreatePayload[] = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i] as unknown[];
              if (!row || row.length === 0) continue;
              const asset_code = String(row[acIdx] ?? '').trim();
              const name = String(row[nameIdx] ?? '').trim();
              const catCode = String(row[catIdx] ?? '').trim().toUpperCase();
              const wsCode = String(row[wsIdx] ?? '').trim().toUpperCase();
              if (!asset_code || !name || !catCode || !wsCode) continue;
              const category_id = codeMap.cat.get(catCode);
              const workshop_id = codeMap.ws.get(wsCode);
              if (category_id == null || workshop_id == null) continue;
              const mfrCode = mfrIdx >= 0 ? String(row[mfrIdx] ?? '').trim().toUpperCase() : '';
              const setCode = setIdx >= 0 ? String(row[setIdx] ?? '').trim().toUpperCase() : '';
              const manufacturer_id = mfrCode ? codeMap.mfr.get(mfrCode) ?? null : null;
              const inspection_param_set_id = setCode ? codeMap.ps.get(setCode) ?? null : null;
              if (mfrCode && manufacturer_id == null) continue;
              if (setCode && inspection_param_set_id == null) continue;
              const dateRaw = dateIdx >= 0 ? String(row[dateIdx] ?? '').trim() : '';
              const manufacture_date = dateRaw ? dateRaw.slice(0, 10) : null;
              items.push({
                asset_code,
                name,
                category_id,
                workshop_id,
                manufacturer_id,
                inspection_param_set_id,
                manufacture_date,
                remark: remarkIdx >= 0 ? String(row[remarkIdx] ?? '').trim() || null : null,
              });
            }
            if (items.length === 0) {
              messageApi.warning('没有可导入的有效数据（请检查编码是否与主数据一致）');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createEquipment(item),
              title: '导入设备台账',
              concurrency: 3,
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
            messageApi.info('与资产 / ERP 同步能力接入后将在此执行；已刷新当前列表。');
            void loadLookups();
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listEquipments({
                skip,
                limit: pageSize,
                workshop_id:
                  searchFormValues?.workshop_id != null && searchFormValues?.workshop_id !== ''
                    ? Number(searchFormValues.workshop_id)
                    : undefined,
                asset_code: typeof searchFormValues?.asset_code === 'string' ? searchFormValues.asset_code : undefined,
                name: typeof searchFormValues?.name === 'string' ? searchFormValues.name : undefined,
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
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑设备' : '新增设备'}
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
              name="asset_code"
              label="设备代号"
              placeholder="资产编号或内部编码"
              disabled={isEdit}
              rules={[{ required: true, message: '请输入设备代号' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="name" label="设备名称" placeholder="设备名称" rules={[{ required: true, message: '请输入设备名称' }]} />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="category_id"
              label="设备类别"
              options={categoryOptions}
              rules={[{ required: true, message: '请选择设备类别' }]}
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="workshop_id"
              label="所属车间"
              options={workshopOptions}
              rules={[{ required: true, message: '请选择车间' }]}
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="manufacturer_id"
              label="制造厂商"
              options={manufacturerOptions}
              allowClear
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="inspection_param_set_id"
              label="点检方案"
              options={paramSetOptions}
              allowClear
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker name="manufacture_date" label="出厂日期" fieldProps={{ style: { width: '100%' } }} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label="备注" fieldProps={{ rows: 3 }} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default EquipmentLedgerPage;
