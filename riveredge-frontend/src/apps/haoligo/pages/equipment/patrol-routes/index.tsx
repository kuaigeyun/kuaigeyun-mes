/**
 * 好力 GO — 巡检路线
 *
 * 路线头：编码、名称、可选车间（与后端 PatrolRoute 对齐）；步骤在抽屉中按顺序配置设备，保存时整体覆盖 PUT steps。
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Drawer, Modal, Select, Space, Table, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  createPatrolRoute,
  deletePatrolRoute,
  listEquipments,
  listPatrolRoutes,
  listPatrolSteps,
  listWorkshops,
  replacePatrolSteps,
  updatePatrolRoute,
  type EquipmentRow,
  type PatrolRouteCreatePayload,
  type PatrolRouteRow,
  type PatrolRouteUpdatePayload,
  type WorkshopRow,
} from '../../../services/haoligo';

const { Text } = Typography;

type PatrolRouteTableRow = PatrolRouteRow & { stepCount: number };

type StepDraft = { key: string; equipment_id?: number };

async function fetchAllEquipments(): Promise<EquipmentRow[]> {
  const out: EquipmentRow[] = [];
  let skip = 0;
  const limit = 200;
  while (true) {
    const res = await listEquipments({ skip, limit });
    out.push(...res.items);
    if (res.items.length === 0 || out.length >= res.total) break;
    skip += limit;
  }
  return out;
}

function newDraftKey(): string {
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const EquipmentPatrolRoutesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<PatrolRouteRow | null>(null);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsSaving, setStepsSaving] = useState(false);
  const configuringRouteIdRef = useRef<number | null>(null);

  const workshopOptions = useMemo(
    () => workshops.map((w) => ({ label: `${w.code} · ${w.name}`, value: w.id })),
    [workshops],
  );
  const wsMap = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);

  const equipmentSelectOptions = useMemo(
    () => equipments.map((e) => ({ label: `${e.asset_code} · ${e.name}`, value: e.id })),
    [equipments],
  );

  const openConfigureSteps = async (record: PatrolRouteRow) => {
    configuringRouteIdRef.current = record.id;
    setActiveRoute(record);
    setDrawerOpen(true);
    setStepsLoading(true);
    try {
      const [eqList, steps] = await Promise.all([fetchAllEquipments(), listPatrolSteps(record.id)]);
      setEquipments(eqList);
      setStepDrafts(
        steps.length
          ? steps.map((s) => ({ key: `s-${s.id}`, equipment_id: s.equipment_id }))
          : [{ key: newDraftKey(), equipment_id: undefined }],
      );
    } catch (e) {
      messageApi.error((e as Error).message || '加载步骤失败');
      setStepDrafts([]);
    } finally {
      setStepsLoading(false);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  const handleEditHeader = (record: PatrolRouteRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({
      code: record.code,
      name: record.name,
      workshop_id: record.workshop_id ?? undefined,
    });
    setModalVisible(true);
  };

  const handleDeleteRoute = (record: PatrolRouteRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除巡检路线「${record.name}」（${record.code}）吗？步骤将一并作废。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePatrolRoute(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
          if (activeRoute?.id === record.id) {
            setDrawerOpen(false);
            setActiveRoute(null);
            setStepDrafts([]);
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
      const workshop_id =
        values.workshop_id != null && values.workshop_id !== '' ? Number(values.workshop_id) : null;
      if (isEdit && editId != null) {
        const patch: PatrolRouteUpdatePayload = {
          name: String(values.name ?? '').trim(),
          workshop_id,
        };
        await updatePatrolRoute(editId, patch);
        messageApi.success('已保存');
      } else {
        const payload: PatrolRouteCreatePayload = {
          code: String(values.code ?? '').trim(),
          name: String(values.name ?? '').trim(),
          workshop_id,
        };
        await createPatrolRoute(payload);
        messageApi.success('已创建');
      }
      setModalVisible(false);
      actionRef.current?.reload();
      if (activeRoute && isEdit && editId === activeRoute.id) {
        const name = String(values.name ?? '').trim();
        setActiveRoute((r) => (r ? { ...r, name, workshop_id } : r));
      }
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= stepDrafts.length) return;
    const next = [...stepDrafts];
    [next[index], next[j]] = [next[j], next[index]];
    setStepDrafts(next);
  };

  const removeStepAt = (index: number) => {
    setStepDrafts((rows) => {
      if (rows.length <= 1) return [{ key: newDraftKey(), equipment_id: undefined }];
      return rows.filter((_, i) => i !== index);
    });
  };

  const handleSaveSteps = async () => {
    if (!activeRoute) return;
    const withEquip = stepDrafts.filter((r) => r.equipment_id != null);
    const emptyRows = stepDrafts.filter((r) => r.equipment_id == null);
    if (emptyRows.length > 0 && withEquip.length > 0) {
      messageApi.warning('请为每一行选择设备，或删除空行后再保存');
      return;
    }
    const ids = withEquip.map((r) => r.equipment_id as number);
    if (ids.length > 0 && new Set(ids).size !== ids.length) {
      messageApi.error('同一路线中不能重复选择同一台设备');
      return;
    }
    const payload = ids.map((equipment_id, sequence) => ({ equipment_id, sequence }));
    setStepsSaving(true);
    try {
      await replacePatrolSteps(activeRoute.id, payload);
      messageApi.success('步骤已保存');
      actionRef.current?.reload();
      const rid = configuringRouteIdRef.current;
      if (rid) {
        const steps = await listPatrolSteps(rid);
        setStepDrafts(
          steps.length
            ? steps.map((s) => ({ key: `s-${s.id}`, equipment_id: s.equipment_id }))
            : [{ key: newDraftKey(), equipment_id: undefined }],
        );
      }
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
    } finally {
      setStepsSaving(false);
    }
  };

  const stepColumns: ColumnsType<StepDraft> = [
    {
      title: '顺序',
      width: 64,
      render: (_, __, i) => i + 1,
    },
    {
      title: '设备',
      render: (_, row) => (
        <Select
          style={{ width: '100%', minWidth: 260 }}
          showSearch
          allowClear
          placeholder="选择台账设备"
          options={equipmentSelectOptions}
          value={row.equipment_id}
          optionFilterProp="label"
          onChange={(v) => {
            setStepDrafts((prev) =>
              prev.map((p) => (p.key === row.key ? { ...p, equipment_id: v ?? undefined } : p)),
            );
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 200,
      render: (_, row, index) => (
        <Space wrap>
          <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveStep(index, -1)}>
            上移
          </Button>
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index >= stepDrafts.length - 1}
            onClick={() => moveStep(index, 1)}
          >
            下移
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeStepAt(index)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const columns: ProColumns<PatrolRouteTableRow>[] = [
    { title: '路线编码', dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '路线名称', dataIndex: 'name', width: 200, ellipsis: true },
    {
      title: '车间',
      dataIndex: 'workshop_id',
      width: 160,
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: workshopOptions, allowClear: true, placeholder: '全部车间' },
    },
    {
      title: '车间',
      dataIndex: 'workshop_id',
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_, r) => {
        if (r.workshop_id == null) return '—';
        const w = wsMap.get(r.workshop_id);
        return w ? `${w.code} · ${w.name}` : r.workshop_id;
      },
    },
    {
      title: '步骤数',
      dataIndex: 'stepCount',
      width: 88,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => void openConfigureSteps(record)}>
            编辑步骤
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditHeader(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRoute(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<PatrolRouteTableRow>
          headerTitle="巡检路线"
          columnPersistenceId="apps.haoligo.pages.equipment.patrol-routes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新建路线"
          onCreate={handleCreate}
          showImportButton={false}
          showSyncButton
          onSync={() => {
            messageApi.info('与移动端模板同步能力接入后将在此执行；已刷新列表。');
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const [routes, ws] = await Promise.all([listPatrolRoutes(), listWorkshops()]);
              setWorkshops(ws);
              const stepLists = await Promise.all(routes.map((r) => listPatrolSteps(r.id)));
              const enriched: PatrolRouteTableRow[] = routes.map((r, i) => ({
                ...r,
                stepCount: stepLists[i]?.length ?? 0,
              }));
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              const wsFilter = searchFormValues?.workshop_id;
              let rows = enriched;
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.name.toLowerCase().includes(nameQ));
              if (wsFilter != null && wsFilter !== '') {
                const wid = Number(wsFilter);
                rows = rows.filter((r) => r.workshop_id === wid);
              }
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
          scroll={{ x: 960 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑巡检路线' : '新建巡检路线'}
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
          label="路线编码"
          placeholder="如 LINE-A-MORNING"
          disabled={isEdit}
          rules={[{ required: true, message: '请输入路线编码' }]}
        />
        <ProFormText name="name" label="路线名称" placeholder="如 A 线早班巡检" rules={[{ required: true, message: '请输入路线名称' }]} />
        <ProFormSelect
          name="workshop_id"
          label="关联车间"
          options={workshopOptions}
          allowClear
          showSearch
          fieldProps={{ optionFilterProp: 'label' }}
        />
      </FormModalTemplate>

      <Drawer
        title={activeRoute ? `编辑步骤：${activeRoute.code} · ${activeRoute.name}` : '编辑步骤'}
        width={Math.min(920, typeof window !== 'undefined' ? window.innerWidth - 48 : 920)}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setActiveRoute(null);
          setStepDrafts([]);
          setEquipments([]);
          configuringRouteIdRef.current = null;
        }}
        destroyOnClose
        extra={
          <Space>
            <Button
              size="small"
              icon={<PlusOutlined />}
              disabled={!activeRoute}
              onClick={() => setStepDrafts((prev) => [...prev, { key: newDraftKey(), equipment_id: undefined }])}
            >
              添加步骤
            </Button>
            <Button type="primary" size="small" loading={stepsSaving} disabled={!activeRoute} onClick={() => void handleSaveSteps()}>
              保存步骤
            </Button>
          </Space>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          按现场行走顺序排列设备；保存时将覆盖服务器上的步骤列表。设备来自「设备台账」。
        </Text>
        <Table<StepDraft>
          rowKey="key"
          loading={stepsLoading}
          columns={stepColumns}
          dataSource={stepDrafts}
          pagination={false}
        />
      </Drawer>
    </>
  );
};

export default EquipmentPatrolRoutesPage;
