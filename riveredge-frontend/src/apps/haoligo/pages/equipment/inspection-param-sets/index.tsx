/**
 * 好力 GO — 点检方案（参数集）
 *
 * 列表与方案头维护同制造厂商模板；明细在抽屉中配置（排序、必检、增删点检项）。
 * 业务约定：先维护「点检项」主数据，再在方案中按需组合；同一参数不可重复加入同一方案。
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormInstance, ProFormSelect, ProFormSwitch, ProFormText } from '@ant-design/pro-components';
import { App, Button, Drawer, InputNumber, Modal, Popconfirm, Space, Switch, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  addInspectionParamSetItem,
  deleteInspectionParamSet,
  deleteInspectionParamSetItem,
  listInspectionParamSetItems,
  listInspectionParamSets,
  listInspectionParams,
  updateInspectionParamSetItem,
  createInspectionParamSet,
  updateInspectionParamSet,
  type InspectionParamRow,
  type InspectionParamSetCreatePayload,
  type InspectionParamSetItemRow,
  type InspectionParamSetRow,
} from '../../../services/haoligo';

const { Text } = Typography;

type LineRow = InspectionParamSetItemRow & {
  param_code: string;
  param_name: string;
  param_unit?: string | null;
  value_type?: string;
};

const InspectionParamSetsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const addItemFormRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSet, setActiveSet] = useState<InspectionParamSetRow | null>(null);
  const [allParams, setAllParams] = useState<InspectionParamRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);
  const configuringSetIdRef = useRef<number | null>(null);

  const loadLines = useCallback(
    async (setId: number) => {
      setLinesLoading(true);
      try {
        const [params, rawItems] = await Promise.all([listInspectionParams(), listInspectionParamSetItems(setId)]);
        setAllParams(params);
        const enriched: LineRow[] = rawItems
          .map((it) => {
            const p = params.find((x) => x.id === it.param_id);
            return {
              ...it,
              param_code: p?.code ?? `#${it.param_id}`,
              param_name: p?.name ?? '—',
              param_unit: p?.unit,
              value_type: p?.value_type,
            };
          })
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        setLines(enriched);
      } catch (e) {
        messageApi.error((e as Error).message || '加载方案明细失败');
        setLines([]);
      } finally {
        setLinesLoading(false);
      }
    },
    [messageApi],
  );

  const openConfigure = async (record: InspectionParamSetRow) => {
    configuringSetIdRef.current = record.id;
    setActiveSet(record);
    setDrawerOpen(true);
    await loadLines(record.id);
  };

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEditHeader = (record: InspectionParamSetRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({ code: record.code, name: record.name });
    setModalVisible(true);
  };

  const handleDeleteSet = (record: InspectionParamSetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除点检方案「${record.name}」（${record.code}）吗？若已被设备或类别引用将无法删除。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInspectionParamSet(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
          if (activeSet?.id === record.id) {
            setDrawerOpen(false);
            setActiveSet(null);
          }
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const handleSubmitHeader = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateInspectionParamSet(editId, { name: String(values.name ?? '').trim() });
        messageApi.success('已保存');
      } else {
        const payload: InspectionParamSetCreatePayload = {
          code: String(values.code ?? '').trim(),
          name: String(values.name ?? '').trim(),
        };
        await createInspectionParamSet(payload);
        messageApi.success('已创建');
      }
      setModalVisible(false);
      actionRef.current?.reload();
      if (activeSet && isEdit && editId === activeSet.id) {
        const name = String(values.name ?? '').trim();
        setActiveSet((s) => (s ? { ...s, name } : s));
      }
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const usedParamIds = useMemo(() => new Set(lines.map((l) => l.param_id)), [lines]);

  const addableParamOptions = useMemo(
    () =>
      allParams
        .filter((p) => !usedParamIds.has(p.id))
        .map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id })),
    [allParams, usedParamIds],
  );

  const handleAddItemSubmit = async (values: Record<string, unknown>) => {
    if (!activeSet) return;
    const param_id = Number(values.param_id);
    if (!Number.isFinite(param_id)) {
      messageApi.warning('请选择点检项');
      return;
    }
    setAddItemLoading(true);
    try {
      await addInspectionParamSetItem(activeSet.id, {
        param_id,
        sort_order: values.sort_order != null && values.sort_order !== '' ? Number(values.sort_order) : 0,
        is_required: values.is_required !== false,
      });
      messageApi.success('已添加');
      setAddItemOpen(false);
      addItemFormRef.current?.resetFields();
      const sid = configuringSetIdRef.current;
      if (sid) await loadLines(sid);
    } catch (e) {
      messageApi.error((e as Error).message || '添加失败');
      throw e;
    } finally {
      setAddItemLoading(false);
    }
  };

  const lineColumns: ColumnsType<LineRow> = [
    { title: '排序', dataIndex: 'sort_order', width: 100, render: (_, r) => (
        <InputNumber
          key={`${r.id}-${r.sort_order}`}
          min={0}
          size="small"
          defaultValue={r.sort_order}
          onBlur={async (ev) => {
            const v = Number((ev.target as HTMLInputElement).value);
            if (!Number.isFinite(v) || v === r.sort_order) return;
            try {
              await updateInspectionParamSetItem(r.id, { sort_order: v });
              messageApi.success('排序已更新');
              const sid = configuringSetIdRef.current;
              if (sid) await loadLines(sid);
            } catch (e) {
              messageApi.error((e as Error).message || '更新失败');
            }
          }}
        />
      ),
    },
    { title: '参数编码', dataIndex: 'param_code', width: 120, ellipsis: true },
    { title: '参数名称', dataIndex: 'param_name', ellipsis: true },
    { title: '单位', dataIndex: 'param_unit', width: 72, render: (u) => u ?? '—' },
    {
      title: '必检',
      dataIndex: 'is_required',
      width: 88,
      render: (_, r) => (
        <Switch
          checked={r.is_required}
          size="small"
          onChange={async (checked) => {
            try {
              await updateInspectionParamSetItem(r.id, { is_required: checked });
              messageApi.success('已更新');
              const sid = configuringSetIdRef.current;
              if (sid) await loadLines(sid);
            } catch (e) {
              messageApi.error((e as Error).message || '更新失败');
            }
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'op',
      width: 72,
      render: (_, r) => (
        <Popconfirm title="从方案中移除此点检项？" onConfirm={async () => {
            try {
              await deleteInspectionParamSetItem(r.id);
              messageApi.success('已移除');
              const sid = configuringSetIdRef.current;
              if (sid) await loadLines(sid);
            } catch (e) {
              messageApi.error((e as Error).message || '移除失败');
            }
          }}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const columns: ProColumns<InspectionParamSetRow>[] = [
    { title: '方案编码', dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '方案名称', dataIndex: 'name', width: 220, ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => void openConfigure(record)}>
            配置明细
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditHeader(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteSet(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<InspectionParamSetRow>
          headerTitle="点检方案"
          columnPersistenceId="apps.haoligo.pages.equipment.inspection-param-sets"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新建方案"
          onCreate={handleCreate}
          showImportButton={false}
          showSyncButton
          onSync={() => {
            messageApi.info('与模板库同步能力接入后将在此执行；已刷新当前列表。');
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const all = await listInspectionParamSets();
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              let rows = all;
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.name.toLowerCase().includes(nameQ));
              const start = (current - 1) * pageSize;
              return {
                data: rows.slice(start, start + pageSize),
                success: true,
                total: rows.length,
              };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 800 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑点检方案' : '新建点检方案'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        onFinish={handleSubmitHeader}
        isEdit={isEdit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <ProFormText
          name="code"
          label="方案编码"
          placeholder="如 CNC-DAILY"
          disabled={isEdit}
          rules={[{ required: true, message: '请输入方案编码' }]}
        />
        <ProFormText name="name" label="方案名称" placeholder="如 加工中心日点检" rules={[{ required: true, message: '请输入方案名称' }]} />
      </FormModalTemplate>

      <Drawer
        title={activeSet ? `配置明细：${activeSet.code} · ${activeSet.name}` : '配置明细'}
        width={720}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setActiveSet(null);
          setLines([]);
          configuringSetIdRef.current = null;
        }}
        destroyOnClose
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            disabled={!activeSet}
            onClick={() => {
              if (!addableParamOptions.length) {
                messageApi.info('暂无可添加的点检项（已全部加入或请先维护点检项主数据）');
                return;
              }
              setAddItemOpen(true);
            }}
          >
            添加点检项
          </Button>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          调整排序与是否必检后立即生效；请先在「点检项」中维护参数主数据。
        </Text>
        <Table<LineRow>
          rowKey="id"
          loading={linesLoading}
          columns={lineColumns}
          dataSource={lines}
          pagination={false}
          size="small"
        />
      </Drawer>

      <FormModalTemplate
        title="向方案添加点检项"
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onFinish={handleAddItemSubmit}
        isEdit={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={addItemFormRef}
        initialValues={{ sort_order: 0, is_required: true }}
        loading={addItemLoading}
        grid={false}
      >
        <ProFormSelect
          name="param_id"
          label="点检项"
          placeholder="请选择尚未加入本方案的点检项"
          rules={[{ required: true, message: '请选择点检项' }]}
          options={addableParamOptions}
          showSearch
          fieldProps={{ optionFilterProp: 'label' }}
        />
        <ProFormDigit
          name="sort_order"
          label="排序号"
          min={0}
          initialValue={0}
          fieldProps={{ precision: 0, style: { width: '100%' } }}
        />
        <ProFormSwitch name="is_required" label="是否必检" />
      </FormModalTemplate>
    </>
  );
};

export default InspectionParamSetsPage;
