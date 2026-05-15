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
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error((e as Error).message || t('app.haoligo.equipment.patrolRoutes.loadStepsFailed'));
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
      title: t('app.haoligo.equipment.patrolRoutes.deleteTitle'),
      content: t('app.haoligo.equipment.patrolRoutes.deleteContent', { name: record.name, code: record.code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePatrolRoute(record.id);
          messageApi.success(t('app.haoligo.equipment.deleteSuccess'));
          actionRef.current?.reload();
          if (activeRoute?.id === record.id) {
            setDrawerOpen(false);
            setActiveRoute(null);
            setStepDrafts([]);
          }
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.deleteFailed'));
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
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        const payload: PatrolRouteCreatePayload = {
          code: String(values.code ?? '').trim(),
          name: String(values.name ?? '').trim(),
          workshop_id,
        };
        await createPatrolRoute(payload);
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
      if (activeRoute && isEdit && editId === activeRoute.id) {
        const name = String(values.name ?? '').trim();
        setActiveRoute((r) => (r ? { ...r, name, workshop_id } : r));
      }
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
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
      messageApi.warning(t('app.haoligo.equipment.patrolRoutes.stepWarnPickOrRemove'));
      return;
    }
    const ids = withEquip.map((r) => r.equipment_id as number);
    if (ids.length > 0 && new Set(ids).size !== ids.length) {
      messageApi.error(t('app.haoligo.equipment.patrolRoutes.stepErrDuplicateEquipment'));
      return;
    }
    const payload = ids.map((equipment_id, sequence) => ({ equipment_id, sequence }));
    setStepsSaving(true);
    try {
      await replacePatrolSteps(activeRoute.id, payload);
      messageApi.success(t('app.haoligo.equipment.patrolRoutes.stepsSaved'));
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
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setStepsSaving(false);
    }
  };

  const stepColumns: ColumnsType<StepDraft> = useMemo(
    () => [
      {
        title: t('app.haoligo.equipment.patrolRoutes.stepColSeq'),
        width: 64,
        render: (_, __, i) => i + 1,
      },
      {
        title: t('app.haoligo.equipment.patrolRoutes.stepColEquipment'),
        render: (_, row) => (
          <Select
            style={{ width: '100%', minWidth: 260 }}
            showSearch
            allowClear
            placeholder={t('app.haoligo.equipment.patrolRoutes.stepEquipmentPh')}
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
        title: t('app.haoligo.equipment.patrolRoutes.stepColActions'),
        width: 200,
        render: (_, row, index) => (
          <Space wrap>
            <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveStep(index, -1)}>
              {t('app.haoligo.equipment.patrolRoutes.moveUp')}
            </Button>
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index >= stepDrafts.length - 1}
              onClick={() => moveStep(index, 1)}
            >
              {t('app.haoligo.equipment.patrolRoutes.moveDown')}
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeStepAt(index)}>
              {t('app.haoligo.equipment.patrolRoutes.stepDelete')}
            </Button>
          </Space>
        ),
      },
    ],
    [t, equipmentSelectOptions, stepDrafts, moveStep, removeStepAt],
  );

  const columns: ProColumns<PatrolRouteTableRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.patrolRoutes.colCode'), dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
      { title: t('app.haoligo.equipment.patrolRoutes.colName'), dataIndex: 'name', width: 200, ellipsis: true },
      {
        title: t('app.haoligo.equipment.patrolRoutes.colWorkshop'),
        dataIndex: 'workshop_id',
        width: 160,
        hideInTable: true,
        valueType: 'select',
        fieldProps: { options: workshopOptions, allowClear: true, placeholder: t('app.haoligo.equipment.patrolRoutes.workshopFilterPh') },
      },
      {
        title: t('app.haoligo.equipment.patrolRoutes.colWorkshop'),
        dataIndex: 'workshop_id',
        width: 180,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) => {
          if (r.workshop_id == null) return t('app.haoligo.equipment.ledger.commonDash');
          const w = wsMap.get(r.workshop_id);
          return w ? `${w.code} · ${w.name}` : r.workshop_id;
        },
      },
      {
        title: t('app.haoligo.equipment.patrolRoutes.colStepCount'),
        dataIndex: 'stepCount',
        width: 88,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.haoligo.equipment.patrolRoutes.colActions'),
        valueType: 'option',
        width: 260,
        fixed: 'right',
        render: (_, record) => (
          <Space wrap>
            <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => void openConfigureSteps(record)}>
              {t('app.haoligo.equipment.patrolRoutes.actionEditSteps')}
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditHeader(record)}>
              {t('app.haoligo.equipment.patrolRoutes.actionEdit')}
            </Button>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRoute(record)}>
              {t('app.haoligo.equipment.patrolRoutes.actionDelete')}
            </Button>
          </Space>
        ),
      },
    ],
    [t, workshopOptions, wsMap],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<PatrolRouteTableRow>
          headerTitle={t('app.haoligo.equipment.patrolRoutes.title')}
          columnPersistenceId="apps.haoligo.pages.equipment.patrol-routes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('app.haoligo.equipment.patrolRoutes.createBtn')}
          onCreate={handleCreate}
          showImportButton={false}
          showSyncButton
          onSync={() => {
            messageApi.info(t('app.haoligo.equipment.patrolRoutes.syncMobilePlaceholder'));
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
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 960 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.haoligo.equipment.patrolRoutes.modalEdit') : t('app.haoligo.equipment.patrolRoutes.modalCreate')}
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
          label={t('app.haoligo.equipment.patrolRoutes.formCode')}
          placeholder={t('app.haoligo.equipment.patrolRoutes.formCodePh')}
          disabled={isEdit}
          rules={[{ required: true, message: t('app.haoligo.equipment.patrolRoutes.formCodeReq') }]}
        />
        <ProFormText
          name="name"
          label={t('app.haoligo.equipment.patrolRoutes.formName')}
          placeholder={t('app.haoligo.equipment.patrolRoutes.formNamePh')}
          rules={[{ required: true, message: t('app.haoligo.equipment.patrolRoutes.formNameReq') }]}
        />
        <ProFormSelect
          name="workshop_id"
          label={t('app.haoligo.equipment.patrolRoutes.formWorkshop')}
          options={workshopOptions}
          allowClear
          showSearch
          fieldProps={{ optionFilterProp: 'label' }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
          <Link to="/apps/master-data/factory/workshops">{t('app.haoligo.equipment.ledger.linkMasterDataWorkshops')}</Link>
        </Typography.Text>
      </FormModalTemplate>

      <Drawer
        title={
          activeRoute
            ? t('app.haoligo.equipment.patrolRoutes.drawerTitleWithRoute', { code: activeRoute.code, name: activeRoute.name })
            : t('app.haoligo.equipment.patrolRoutes.drawerTitle')
        }
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
              {t('app.haoligo.equipment.patrolRoutes.addStep')}
            </Button>
            <Button type="primary" size="small" loading={stepsSaving} disabled={!activeRoute} onClick={() => void handleSaveSteps()}>
              {t('app.haoligo.equipment.patrolRoutes.saveSteps')}
            </Button>
          </Space>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {t('app.haoligo.equipment.patrolRoutes.drawerHint')}
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
