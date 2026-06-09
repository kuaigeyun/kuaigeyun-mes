/**
 * 好力 GO — 巡检路线（类比点检方案：路线头 + 有序设备步骤，在同一弹窗建立与维护）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProForm,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Divider, Modal, Row, Space, Table, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  createPatrolRouteWithSteps,
  deletePatrolRoute,
  listEquipments,
  listPatrolRoutes,
  listPatrolSteps,
  listWorkshops,
  replacePatrolSteps,
  updatePatrolRoute,
  type EquipmentRow,
  type PatrolRouteRow,
  type PatrolStepRow,
  type WorkshopRow,
} from '../../../services/haoligo';

const { Text, Title } = Typography;

type PatrolRouteTableRow = PatrolRouteRow & { stepCount: number };

type LineRow = PatrolStepRow & {
  asset_code: string;
  equipment_name: string;
};

type PendingStep = {
  tempId: string;
  equipment_id: number;
  sequence: number;
  asset_code: string;
  equipment_name: string;
};

function newTempId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeWorkshopId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function fetchEquipmentsPaged(params?: { workshop_id?: number }): Promise<EquipmentRow[]> {
  const out: EquipmentRow[] = [];
  let skip = 0;
  const limit = 200;
  for (;;) {
    const res = await listEquipments({ skip, limit, ...params });
    const batch = res.items ?? [];
    out.push(...batch);
    if (batch.length === 0 || out.length >= res.total) break;
    skip += limit;
  }
  return out;
}

async function fetchAllEquipments(): Promise<EquipmentRow[]> {
  return fetchEquipmentsPaged();
}

const EquipmentPatrolRoutesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const editorFormRef = useRef<ProFormInstance>(null);
  const addEquipFormRef = useRef<ProFormInstance>(null);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [workshopsLoading, setWorkshopsLoading] = useState(false);
  const [allEquipments, setAllEquipments] = useState<EquipmentRow[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCreateMode, setEditorCreateMode] = useState(true);
  const [editorRouteId, setEditorRouteId] = useState<number | null>(null);
  const [editorRouteCode, setEditorRouteCode] = useState('');
  const [editorSaving, setEditorSaving] = useState(false);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [pendingLines, setPendingLines] = useState<PendingStep[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);

  const [addEquipOpen, setAddEquipOpen] = useState(false);
  const [addEquipOptions, setAddEquipOptions] = useState<{ label: string; value: number }[]>([]);
  const [addEquipLoading, setAddEquipLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<PatrolRouteRow | null>(null);
  const [detailSteps, setDetailSteps] = useState<LineRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadWorkshops = useCallback(async () => {
    setWorkshopsLoading(true);
    try {
      setWorkshops(await listWorkshops());
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      setWorkshops([]);
    } finally {
      setWorkshopsLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadWorkshops();
  }, [loadWorkshops]);

  const workshopOptions = useMemo(() => {
    const seenIds = new Set<number>();
    const seenCodes = new Set<string>();
    const out: { label: string; value: number }[] = [];
    for (const w of workshops) {
      const codeKey = (w.code || '').trim().toLowerCase();
      if (seenIds.has(w.id) || (codeKey && seenCodes.has(codeKey))) continue;
      seenIds.add(w.id);
      if (codeKey) seenCodes.add(codeKey);
      out.push({ label: `${w.code} · ${w.name}`, value: w.id });
    }
    return out;
  }, [workshops]);

  const wsMap = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);

  const loadEquipments = useCallback(async () => {
    const eq = await fetchAllEquipments();
    setAllEquipments(eq);
    return eq;
  }, []);

  const enrichSteps = useCallback((steps: PatrolStepRow[], equipments: EquipmentRow[]): LineRow[] => {
    return steps
      .map((st) => {
        const eq = equipments.find((x) => x.id === st.equipment_id);
        return {
          ...st,
          asset_code: eq?.asset_code ?? `#${st.equipment_id}`,
          equipment_name: eq?.name ?? '—',
        };
      })
      .sort((a, b) => a.sequence - b.sequence || a.id - b.id);
  }, []);

  const loadLines = useCallback(
    async (routeId: number) => {
      setLinesLoading(true);
      try {
        const [equipments, rawSteps] = await Promise.all([loadEquipments(), listPatrolSteps(routeId)]);
        setLines(enrichSteps(rawSteps, equipments));
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.patrolRoutes.loadStepsFailed'));
        setLines([]);
      } finally {
        setLinesLoading(false);
      }
    },
    [enrichSteps, loadEquipments, messageApi, t],
  );

  const openCreateEditor = async () => {
    setEditorCreateMode(true);
    setEditorRouteId(null);
    setEditorRouteCode('');
    setLines([]);
    setPendingLines([]);
    setEditorOpen(true);
    await Promise.all([loadWorkshops(), loadEquipments()]);
    setTimeout(() => editorFormRef.current?.resetFields(), 0);
  };

  const openEditEditor = async (record: PatrolRouteRow) => {
    setEditorCreateMode(false);
    setEditorRouteId(record.id);
    setEditorRouteCode(record.code);
    setPendingLines([]);
    setEditorOpen(true);
    await loadWorkshops();
    await loadLines(record.id);
    setTimeout(() => {
      editorFormRef.current?.setFieldsValue({
        code: record.code,
        name: record.name,
        workshop_id: record.workshop_id ?? undefined,
      });
    }, 0);
  };

  useNewShortcut(() => void openCreateEditor());

  const handleDetail = async (record: PatrolRouteRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailSteps([]);
    try {
      const [equipments, rawSteps] = await Promise.all([fetchAllEquipments(), listPatrolSteps(record.id)]);
      setDetailSteps(enrichSteps(rawSteps, equipments));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.patrolRoutes.loadStepsFailed'));
    } finally {
      setDetailLoading(false);
    }
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
          if (editorRouteId === record.id) {
            setEditorOpen(false);
            setEditorRouteId(null);
          }
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.deleteFailed'));
        }
      },
    });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorRouteId(null);
    setLines([]);
    setPendingLines([]);
  };

  const saveEditor = async () => {
    try {
      await editorFormRef.current?.validateFields();
    } catch {
      return;
    }
    const v = editorFormRef.current?.getFieldsValue() as {
      code?: string;
      name?: string;
      workshop_id?: number | string | null;
    };
    const name = String(v.name ?? '').trim();
    if (!name) {
      messageApi.warning(t('app.haoligo.equipment.patrolRoutes.formNameReq'));
      return;
    }
    const workshop_id =
      v.workshop_id != null && v.workshop_id !== '' ? Number(v.workshop_id) : null;

    if (editorCreateMode) {
      const code = String(v.code ?? '').trim();
      if (!code) {
        messageApi.warning(t('app.haoligo.equipment.patrolRoutes.formCodeReq'));
        return;
      }
      if (pendingLines.length === 0) {
        messageApi.warning(t('app.haoligo.equipment.patrolRoutes.atLeastOneStep'));
        return;
      }
      setEditorSaving(true);
      try {
        await createPatrolRouteWithSteps({
          code,
          name,
          workshop_id,
          steps: pendingLines.map((ln, i) => ({
            equipment_id: ln.equipment_id,
            sequence: i,
          })),
        });
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
        closeEditor();
        actionRef.current?.reload();
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
      } finally {
        setEditorSaving(false);
      }
      return;
    }

    if (editorRouteId == null) return;
    const stepPayload = lines.map((ln, i) => ({ equipment_id: ln.equipment_id, sequence: i }));
    setEditorSaving(true);
    try {
      await updatePatrolRoute(editorRouteId, { name, workshop_id });
      await replacePatrolSteps(editorRouteId, stepPayload);
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      closeEditor();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setEditorSaving(false);
    }
  };

  const usedEquipIdsCreate = useMemo(() => new Set(pendingLines.map((l) => l.equipment_id)), [pendingLines]);
  const usedEquipIdsEdit = useMemo(() => new Set(lines.map((l) => l.equipment_id)), [lines]);

  const buildAddableEquipmentOptions = useCallback(
    (equipments: EquipmentRow[], workshopId: number | null) => {
      const used = editorCreateMode ? usedEquipIdsCreate : usedEquipIdsEdit;
      return equipments
        .filter((eq) => !used.has(eq.id))
        .filter((eq) => workshopId == null || normalizeWorkshopId(eq.workshop_id) === workshopId)
        .map((eq) => ({ label: `${eq.asset_code} · ${eq.name}`, value: eq.id }));
    },
    [editorCreateMode, usedEquipIdsCreate, usedEquipIdsEdit],
  );

  const openAddEquipment = () => {
    void (async () => {
      const wsId = normalizeWorkshopId(editorFormRef.current?.getFieldValue('workshop_id'));
      setAddEquipLoading(true);
      try {
        const pool =
          wsId != null ? await fetchEquipmentsPaged({ workshop_id: wsId }) : await fetchAllEquipments();
        if (!wsId) setAllEquipments(pool);
        const options = buildAddableEquipmentOptions(pool, wsId);
        if (!options.length) {
          messageApi.info(t('app.haoligo.equipment.patrolRoutes.noEquipmentToAdd'));
          return;
        }
        setAddEquipOptions(options);
        setAddEquipOpen(true);
        setTimeout(() => addEquipFormRef.current?.resetFields(), 0);
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      } finally {
        setAddEquipLoading(false);
      }
    })();
  };

  const handleAddEquipmentSubmit = async (values: Record<string, unknown>) => {
    const raw = values.equipment_ids;
    const equipmentIds = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (!equipmentIds.length) {
      messageApi.warning(t('app.haoligo.equipment.patrolRoutes.pickEquipment'));
      return;
    }

    const rows = equipmentIds
      .map((equipment_id) => {
        const eq = allEquipments.find((x) => x.id === equipment_id);
        if (!eq) return null;
        return { equipment_id, eq };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
    if (!rows.length) {
      messageApi.warning(t('app.haoligo.equipment.patrolRoutes.pickEquipment'));
      return;
    }

    if (editorCreateMode) {
      setPendingLines((prev) => [
        ...prev,
        ...rows.map(({ equipment_id, eq }, i) => ({
          tempId: newTempId(),
          equipment_id,
          sequence: prev.length + i,
          asset_code: eq.asset_code,
          equipment_name: eq.name,
        })),
      ]);
      setAddEquipOpen(false);
      addEquipFormRef.current?.resetFields();
      return;
    }

    setLines((prev) => [
      ...prev,
      ...rows.map(({ equipment_id, eq }, i) => ({
        id: 0,
        equipment_id,
        sequence: prev.length + i,
        asset_code: eq.asset_code,
        equipment_name: eq.name,
      })),
    ]);
    setAddEquipOpen(false);
    addEquipFormRef.current?.resetFields();
  };

  const movePending = (index: number, delta: number) => {
    setPendingLines((prev) => {
      const arr = [...prev];
      const j = index + delta;
      if (j < 0 || j >= arr.length) return prev;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return arr.map((row, i) => ({ ...row, sequence: i }));
    });
  };

  const movePersisted = (index: number, delta: number) => {
    setLines((prev) => {
      const arr = [...prev];
      const j = index + delta;
      if (j < 0 || j >= arr.length) return prev;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return arr.map((row, i) => ({ ...row, sequence: i }));
    });
  };

  const removePending = (tempId: string) => {
    setPendingLines((prev) => prev.filter((x) => x.tempId !== tempId).map((row, i) => ({ ...row, sequence: i })));
  };

  const removePersisted = (equipmentId: number) => {
    setLines((prev) => prev.filter((x) => x.equipment_id !== equipmentId).map((row, i) => ({ ...row, sequence: i })));
  };

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => a.sequence - b.sequence || a.id - b.id),
    [lines],
  );

  const detailLineColumns: ColumnsType<LineRow> = [
    {
      title: t('app.haoligo.equipment.patrolRoutes.stepColSeq'),
      width: 56,
      render: (_, __, i) => i + 1,
    },
    {
      title: t('app.haoligo.equipment.patrolRoutes.stepColEquipment'),
      dataIndex: 'asset_code',
      render: (_, r) => `${r.asset_code} · ${r.equipment_name}`,
    },
  ];

  const detailColumns: ProDescriptionsItemProps<PatrolRouteRow>[] = [
    { title: t('app.haoligo.equipment.patrolRoutes.colCode'), dataIndex: 'code' },
    { title: t('app.haoligo.equipment.patrolRoutes.colName'), dataIndex: 'name' },
    {
      title: t('app.haoligo.equipment.patrolRoutes.colWorkshop'),
      dataIndex: 'workshop_id',
      render: (_, r) => {
        if (r.workshop_id == null) return t('app.haoligo.equipment.ledger.commonDash');
        const w = wsMap.get(r.workshop_id);
        return w ? `${w.code} · ${w.name}` : r.workshop_id;
      },
    },
  ];

  const stepColumnsBase: ColumnsType<PendingStep | LineRow> = [
    {
      title: t('app.haoligo.equipment.patrolRoutes.stepColSeq'),
      width: 56,
      render: (_, __, i) => i + 1,
    },
    {
      title: t('app.haoligo.equipment.patrolRoutes.stepColEquipment'),
      render: (_, r) => `${'asset_code' in r ? r.asset_code : ''} · ${'equipment_name' in r ? r.equipment_name : ''}`,
    },
  ];

  const pendingColumns: ColumnsType<PendingStep> = [
    ...stepColumnsBase,
    {
      title: t('app.haoligo.equipment.patrolRoutes.stepColActions'),
      width: 220,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_, r, index) => (
        <Space size={4} style={{ flexWrap: 'nowrap' }}>
          <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => movePending(index, -1)}>
            {t('app.haoligo.equipment.patrolRoutes.moveUp')}
          </Button>
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index >= pendingLines.length - 1}
            onClick={() => movePending(index, 1)}
          >
            {t('app.haoligo.equipment.patrolRoutes.moveDown')}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removePending(r.tempId)}>
            {t('app.haoligo.equipment.patrolRoutes.stepDelete')}
          </Button>
        </Space>
      ),
    },
  ];

  const persistedColumns: ColumnsType<LineRow> = [
    ...stepColumnsBase,
    {
      title: t('app.haoligo.equipment.patrolRoutes.stepColActions'),
      width: 220,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_, r, index) => (
        <Space size={4} style={{ flexWrap: 'nowrap' }}>
          <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => movePersisted(index, -1)}>
            {t('app.haoligo.equipment.patrolRoutes.moveUp')}
          </Button>
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index >= sortedLines.length - 1}
            onClick={() => movePersisted(index, 1)}
          >
            {t('app.haoligo.equipment.patrolRoutes.moveDown')}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removePersisted(r.equipment_id)}>
            {t('app.haoligo.equipment.patrolRoutes.stepDelete')}
          </Button>
        </Space>
      ),
    },
  ];

  const columns: ProColumns<PatrolRouteTableRow>[] = [
    { title: t('app.haoligo.equipment.patrolRoutes.colCode'), dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: t('app.haoligo.equipment.patrolRoutes.colName'), dataIndex: 'name', width: 200, ellipsis: true },
    {
      title: t('app.haoligo.equipment.patrolRoutes.colWorkshop'),
      dataIndex: 'workshop_id',
      width: 160,
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        options: workshopOptions,
        allowClear: true,
        placeholder: t('app.haoligo.equipment.patrolRoutes.workshopFilterPh'),
      },
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
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button key="view" {...rowActionKind('read')} onClick={() => void handleDetail(record)}>
            {t('common.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => void openEditEditor(record)}>
            {t('app.haoligo.equipment.patrolRoutes.actionEditRoute')}
          </Button>
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteRoute(record)}>
            {t('app.haoligo.equipment.patrolRoutes.actionDelete')}
          </Button>
        </Space>
      ),
    },
  ];

  const editorTitle = editorCreateMode
    ? t('app.haoligo.equipment.patrolRoutes.editorTitleNew')
    : t('app.haoligo.equipment.patrolRoutes.editorTitleEdit', { code: editorRouteCode });

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
          onCreate={() => void openCreateEditor()}
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
              const routes = await listPatrolRoutes();
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

      <Modal
        title={editorTitle}
        open={editorOpen}
        onCancel={closeEditor}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={null}
        styles={{ body: { maxHeight: MODAL_CONFIG.BODY_MAX_HEIGHT, overflowY: 'auto' } }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {t('app.haoligo.equipment.patrolRoutes.hintEditorShort')}
        </Text>
        <ProForm formRef={editorFormRef} submitter={false} layout="vertical" grid={false}>
          <Row gutter={16}>
            <Col span={8}>
              <ProFormText
                name="code"
                label={t('app.haoligo.equipment.patrolRoutes.formCode')}
                placeholder={t('app.haoligo.equipment.patrolRoutes.formCodePh')}
                disabled={!editorCreateMode}
                rules={[{ required: true, message: t('app.haoligo.equipment.patrolRoutes.formCodeReq') }]}
              />
            </Col>
            <Col span={8}>
              <ProFormText
                name="name"
                label={t('app.haoligo.equipment.patrolRoutes.formName')}
                placeholder={t('app.haoligo.equipment.patrolRoutes.formNamePh')}
                rules={[{ required: true, message: t('app.haoligo.equipment.patrolRoutes.formNameReq') }]}
              />
            </Col>
            <Col span={8}>
              <ProFormSelect
                name="workshop_id"
                label={t('app.haoligo.equipment.patrolRoutes.formWorkshop')}
                options={workshopOptions}
                allowClear
                showSearch
                fieldProps={{
                  optionFilterProp: 'label',
                  loading: workshopsLoading,
                }}
              />
            </Col>
          </Row>
        </ProForm>

        <Divider style={{ margin: '16px 0' }} />

        <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>
            {t('app.haoligo.equipment.patrolRoutes.sectionSequence')}
          </Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} loading={addEquipLoading} onClick={openAddEquipment}>
            {t('app.haoligo.equipment.patrolRoutes.btnAddEquipment')}
          </Button>
        </Space>

        {editorCreateMode ? (
          <Table<PendingStep>
            rowKey="tempId"
            size="small"
            pagination={false}
            columns={pendingColumns}
            dataSource={pendingLines}
            locale={{ emptyText: t('app.haoligo.equipment.patrolRoutes.emptySequence') }}
          />
        ) : (
          <Table<LineRow>
            rowKey={(r) => String(r.id || r.equipment_id)}
            size="small"
            loading={linesLoading}
            pagination={false}
            columns={persistedColumns}
            dataSource={sortedLines}
            locale={{ emptyText: t('app.haoligo.equipment.patrolRoutes.emptySequence') }}
          />
        )}

        <div style={{ marginTop: 12 }}>
          <Link to="/apps/haoligo/equipment/ledger">{t('app.haoligo.equipment.patrolRoutes.linkEquipmentLedger')}</Link>
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Space>
            <Button onClick={closeEditor}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
            <Button type="primary" loading={editorSaving} onClick={() => void saveEditor()}>
              {editorCreateMode
                ? t('app.haoligo.equipment.patrolRoutes.btnCreateRoute')
                : t('app.haoligo.equipment.patrolRoutes.btnSaveRoute')}
            </Button>
          </Space>
        </div>
      </Modal>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.code}`
            : t('app.haoligo.equipment.patrolRoutes.title')
        }
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
          setDetailSteps([]);
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailRecord}
        columns={detailColumns}
        linesTitle={t('app.haoligo.equipment.patrolRoutes.sectionSequence')}
        lines={
          <Table<LineRow>
            rowKey="id"
            size="small"
            pagination={false}
            columns={detailLineColumns}
            dataSource={detailSteps}
            locale={{ emptyText: t('app.haoligo.equipment.patrolRoutes.emptySequence') }}
          />
        }
      />

      <FormModalTemplate
        title={t('app.haoligo.equipment.patrolRoutes.addEquipmentTitle')}
        open={addEquipOpen}
        onClose={() => setAddEquipOpen(false)}
        onFinish={handleAddEquipmentSubmit}
        isEdit={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={addEquipFormRef}
        grid={false}
      >
        <ProFormSelect
          name="equipment_ids"
          label={t('app.haoligo.equipment.patrolRoutes.stepColEquipment')}
          placeholder={t('app.haoligo.equipment.patrolRoutes.stepEquipmentPh')}
          rules={[{ required: true, message: t('app.haoligo.equipment.patrolRoutes.pickEquipment') }]}
          options={addEquipOptions}
          showSearch
          fieldProps={{
            mode: 'multiple',
            optionFilterProp: 'label',
            maxTagCount: 'responsive',
          }}
        />
      </FormModalTemplate>
    </>
  );
};

export default EquipmentPatrolRoutesPage;
