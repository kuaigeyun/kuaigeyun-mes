/**
 * 好力 GO — 点检方案（类比工艺路线：方案头 + 有序点检项，在同一界面建立与维护）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProForm,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Divider, Form, Modal, Popconfirm, Row, Space, Switch, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  addInspectionParamSetItem,
  createInspectionParamSetWithItems,
  deleteInspectionParamSet,
  deleteInspectionParamSetItem,
  importInspectionParamSets,
  listInspectionParamSetItems,
  listCategories,
  listInspectionParamSets,
  listInspectionParams,
  updateInspectionParamSet,
  updateInspectionParamSetItem,
  type InspectionParamRow,
  type InspectionParamSetImportRowPayload,
  type InspectionParamSetItemRow,
  type InspectionParamSetRow,
} from '../../../services/haoligo';
import { normalizeInspectionValueType } from '../../../utils/inspectionParamValueType';

const { Text, Title } = Typography;

type LineRow = InspectionParamSetItemRow & {
  param_code: string;
  param_name: string;
  param_level1_category?: string | null;
  param_unit?: string | null;
  value_type?: string;
};

type PendingLine = {
  tempId: string;
  param_id: number;
  sort_order: number;
  is_required: boolean;
  param_code: string;
  param_name: string;
  param_level1_category?: string | null;
  param_unit?: string | null;
  value_type?: string;
};

function newTempId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseOptionalNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseImportIsRequired(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return true;
  if (s.includes('否') || s === 'no' || s === 'false' || s === '0' || s === 'n') return false;
  return true;
}

function cellText(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).trim();
}

const InspectionParamSetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const editorFormRef = useRef<ProFormInstance>(null);
  const addItemFormRef = useRef<ProFormInstance>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCreateMode, setEditorCreateMode] = useState(true);
  const [editorSetId, setEditorSetId] = useState<number | null>(null);
  const [editorSetCode, setEditorSetCode] = useState('');
  const [editorSaving, setEditorSaving] = useState(false);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [allParams, setAllParams] = useState<InspectionParamRow[]>([]);
  const [equipmentCategories, setEquipmentCategories] = useState<Awaited<ReturnType<typeof listCategories>>>([]);
  const [paramPickerLevel1, setParamPickerLevel1] = useState<string>('__all__');

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InspectionParamSetRow | null>(null);
  const [detailLines, setDetailLines] = useState<LineRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadParams = useCallback(async () => {
    const [params, cats] = await Promise.all([listInspectionParams(), listCategories()]);
    setAllParams(params);
    setEquipmentCategories(cats);
    return params;
  }, []);

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
              param_level1_category: p?.level1_category,
              param_unit: p?.unit,
              value_type: p?.value_type,
            };
          })
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        setLines(enriched);
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.inspectionParamSets.loadLinesFailed'));
        setLines([]);
      } finally {
        setLinesLoading(false);
      }
    },
    [messageApi, t],
  );

  const level1SegmentOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: t('app.haoligo.equipment.ledger.categoryFilterAll'), value: '__all__' },
    ];
    const seen = new Set<string>();
    let hasUncategorized = false;
    for (const c of equipmentCategories) {
      const l1 = (c.level1_category ?? '').trim();
      if (!l1) {
        hasUncategorized = true;
        continue;
      }
      if (seen.has(l1)) continue;
      seen.add(l1);
      opts.push({ label: l1, value: l1 });
    }
    if (hasUncategorized) {
      opts.push({
        label: t('app.haoligo.equipment.ledger.categoryFilterUncategorized'),
        value: '__none__',
      });
    }
    return opts;
  }, [equipmentCategories, t]);

  const openCreateEditor = async () => {
    setEditorCreateMode(true);
    setEditorSetId(null);
    setEditorSetCode('');
    setLines([]);
    setPendingLines([]);
    setEditorOpen(true);
    await loadParams();
    setTimeout(() => {
      editorFormRef.current?.resetFields();
    }, 0);
  };

  const handleDetail = async (record: InspectionParamSetRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailLines([]);
    try {
      const [params, rawItems] = await Promise.all([listInspectionParams(), listInspectionParamSetItems(record.id)]);
      const enriched: LineRow[] = rawItems
        .map((it) => {
          const p = params.find((x) => x.id === it.param_id);
          return {
            ...it,
            param_code: p?.code ?? `#${it.param_id}`,
            param_name: p?.name ?? '—',
            param_level1_category: p?.level1_category,
            param_unit: p?.unit,
            value_type: p?.value_type,
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      setDetailLines(enriched);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.inspectionParamSets.loadLinesFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditEditor = async (record: InspectionParamSetRow) => {
    setEditorCreateMode(false);
    setEditorSetId(record.id);
    setEditorSetCode(record.code);
    setPendingLines([]);
    setEditorOpen(true);
    await loadLines(record.id);
    setTimeout(() => {
      editorFormRef.current?.setFieldsValue({ code: record.code, name: record.name });
    }, 0);
  };

  useNewShortcut(openCreateEditor);

  const handleDeleteSet = (record: InspectionParamSetRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.inspectionParamSets.deleteTitle'),
      content: t('app.haoligo.equipment.inspectionParamSets.deleteContent', { name: record.name, code: record.code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInspectionParamSet(record.id);
          messageApi.success(t('app.haoligo.equipment.updateSuccess'));
          actionRef.current?.reload();
          if (editorSetId === record.id) {
            setEditorOpen(false);
            setEditorSetId(null);
          }
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        }
      },
    });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorSetId(null);
    setLines([]);
    setPendingLines([]);
  };

  const saveEditor = async () => {
    try {
      await editorFormRef.current?.validateFields();
    } catch {
      return;
    }
    const v = editorFormRef.current?.getFieldsValue() as { code?: string; name?: string };
    const name = String(v.name ?? '').trim();
    if (!name) {
      messageApi.warning(t('app.haoligo.equipment.inspectionParamSets.nameRequired'));
      return;
    }

    if (editorCreateMode) {
      const code = String(v.code ?? '').trim();
      if (!code) {
        messageApi.warning(t('app.haoligo.equipment.inspectionParamSets.codeRequired'));
        return;
      }
      if (pendingLines.length === 0) {
        messageApi.warning(t('app.haoligo.equipment.inspectionParamSets.atLeastOneItem'));
        return;
      }
      setEditorSaving(true);
      try {
        await createInspectionParamSetWithItems({
          code,
          name,
          items: pendingLines.map((ln, i) => ({
            param_id: ln.param_id,
            sort_order: i,
            is_required: ln.is_required,
          })),
        });
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
        closeEditor();
        actionRef.current?.reload();
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      } finally {
        setEditorSaving(false);
      }
      return;
    }

    if (editorSetId == null) return;
    setEditorSaving(true);
    try {
      await updateInspectionParamSet(editorSetId, { name });
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      closeEditor();
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setEditorSaving(false);
    }
  };

  const usedParamIdsCreate = useMemo(() => new Set(pendingLines.map((l) => l.param_id)), [pendingLines]);
  const usedParamIdsEdit = useMemo(() => new Set(lines.map((l) => l.param_id)), [lines]);
  const addableParamOptions = useMemo(() => {
    const used = editorCreateMode ? usedParamIdsCreate : usedParamIdsEdit;
    return allParams
      .filter((p) => !used.has(p.id))
      .filter((p) => {
        if (paramPickerLevel1 === '__all__') return true;
        if (paramPickerLevel1 === '__none__') return !p.level1_category;
        return p.level1_category === paramPickerLevel1;
      })
      .map((p) => {
        const cat = p.level1_category ? ` · ${p.level1_category}` : '';
        return { label: `${p.code} · ${p.name}${cat}`, value: p.id };
      });
  }, [allParams, editorCreateMode, usedParamIdsCreate, usedParamIdsEdit, paramPickerLevel1]);

  const openAddItem = () => {
    const used = editorCreateMode ? usedParamIdsCreate : usedParamIdsEdit;
    const hasAny = allParams.some((p) => !used.has(p.id));
    if (!hasAny) {
      messageApi.info(t('app.haoligo.equipment.inspectionParamSets.noParamsToAdd'));
      return;
    }
    setParamPickerLevel1('__all__');
    setAddItemOpen(true);
    setTimeout(() => {
      addItemFormRef.current?.resetFields();
      addItemFormRef.current?.setFieldsValue({ sort_order: pendingLines.length || lines.length, is_required: true });
    }, 0);
  };

  const handleAddItemSubmit = async (values: Record<string, unknown>) => {
    const raw = values.param_ids;
    const paramIds = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (!paramIds.length) {
      messageApi.warning(t('app.haoligo.equipment.inspectionParamSets.pickParam'));
      return;
    }

    const baseSortRaw = values.sort_order;
    const baseSort =
      baseSortRaw != null && baseSortRaw !== '' ? Number(baseSortRaw) : editorCreateMode ? pendingLines.length : lines.length;
    const sortStart = Number.isFinite(baseSort) ? baseSort : 0;
    const isRequired = values.is_required !== false;

    if (editorCreateMode) {
      const rows = paramIds
        .map((param_id, i) => {
          const p = allParams.find((x) => x.id === param_id);
          if (!p) return null;
          return {
            tempId: newTempId(),
            param_id,
            sort_order: sortStart + i,
            is_required: isRequired,
            param_code: p.code,
            param_name: p.name,
            param_level1_category: p.level1_category,
            param_unit: p.unit,
            value_type: p.value_type,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
      if (!rows.length) {
        messageApi.warning(t('app.haoligo.equipment.inspectionParamSets.pickParam'));
        return;
      }
      setPendingLines((prev) => [...prev, ...rows]);
      setAddItemOpen(false);
      addItemFormRef.current?.resetFields();
      return;
    }

    if (editorSetId == null) return;
    setAddItemLoading(true);
    try {
      await Promise.all(
        paramIds.map((param_id, i) =>
          addInspectionParamSetItem(editorSetId, {
            param_id,
            sort_order: sortStart + i,
            is_required: isRequired,
          }),
        ),
      );
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      setAddItemOpen(false);
      addItemFormRef.current?.resetFields();
      await loadLines(editorSetId);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      throw e;
    } finally {
      setAddItemLoading(false);
    }
  };

  const movePending = (index: number, delta: number) => {
    setPendingLines((prev) => {
      const arr = [...prev];
      const j = index + delta;
      if (j < 0 || j >= arr.length) return prev;
      const t0 = arr[index];
      const t1 = arr[j];
      arr[index] = t1;
      arr[j] = t0;
      return arr.map((row, i) => ({ ...row, sort_order: i }));
    });
  };

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [lines],
  );

  const movePersisted = async (index: number, delta: number) => {
    if (editorSetId == null) return;
    const sorted = sortedLines;
    const j = index + delta;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[j];
    try {
      await Promise.all([
        updateInspectionParamSetItem(a.id, { sort_order: b.sort_order }),
        updateInspectionParamSetItem(b.id, { sort_order: a.sort_order }),
      ]);
      messageApi.success(t('app.haoligo.equipment.inspectionParamSets.orderUpdated'));
      await loadLines(editorSetId);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    }
  };

  const removePending = (tempId: string) => {
    setPendingLines((prev) => prev.filter((x) => x.tempId !== tempId).map((row, i) => ({ ...row, sort_order: i })));
  };

  const detailLineColumns: ColumnsType<LineRow> = [
    {
      title: t('app.haoligo.equipment.inspectionParamSets.columnSeq'),
      width: 56,
      render: (_, __, i) => i + 1,
    },
    { title: t('app.haoligo.equipment.inspectionParamSets.colParamCode'), dataIndex: 'param_code', width: 120, ellipsis: true },
    { title: t('app.haoligo.equipment.inspectionParamSets.colParamName'), dataIndex: 'param_name', ellipsis: true },
    {
      title: t('app.haoligo.equipment.inspectionParams.colCategory'),
      dataIndex: 'param_level1_category',
      width: 100,
      ellipsis: true,
      render: (v) => v || t('app.haoligo.equipment.inspectionParams.categoryUncategorized'),
    },
    { title: t('app.haoligo.equipment.inspectionParamSets.colUnit'), dataIndex: 'param_unit', width: 72, render: (u) => u ?? '—' },
    {
      title: t('app.haoligo.equipment.inspectionParamSets.colRequired'),
      dataIndex: 'is_required',
      width: 88,
      render: (_, r) => (r.is_required ? t('app.haoligo.equipment.inspectionParamSets.colRequired') : '—'),
    },
  ];

  const detailColumns: ProDescriptionsItemProps<InspectionParamSetRow>[] = [
    { title: t('app.haoligo.equipment.inspectionParamSets.colSetCode'), dataIndex: 'code' },
    { title: t('app.haoligo.equipment.inspectionParamSets.colSetName'), dataIndex: 'name' },
  ];

  const persistedColumns: ColumnsType<LineRow> = [
      {
        title: t('app.haoligo.equipment.inspectionParamSets.columnSeq'),
        width: 56,
        render: (_, __, i) => i + 1,
      },
      { title: t('app.haoligo.equipment.inspectionParamSets.colParamCode'), dataIndex: 'param_code', width: 120, ellipsis: true },
      { title: t('app.haoligo.equipment.inspectionParamSets.colParamName'), dataIndex: 'param_name', ellipsis: true },
      {
        title: t('app.haoligo.equipment.inspectionParams.colCategory'),
        dataIndex: 'param_level1_category',
        width: 100,
        ellipsis: true,
        render: (v) => v || t('app.haoligo.equipment.inspectionParams.categoryUncategorized'),
      },
      { title: t('app.haoligo.equipment.inspectionParamSets.colUnit'), dataIndex: 'param_unit', width: 72, render: (u) => u ?? '—' },
      {
        title: t('app.haoligo.equipment.inspectionParamSets.colRequired'),
        dataIndex: 'is_required',
        width: 88,
        render: (_, r) => (
          <Switch
            checked={r.is_required}
            size="small"
            onChange={async (checked) => {
              try {
                await updateInspectionParamSetItem(r.id, { is_required: checked });
                messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                if (editorSetId) await loadLines(editorSetId);
              } catch (e) {
                messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              }
            }}
          />
        ),
      },
      {
        title: t('app.haoligo.equipment.documents.colActions'),
        key: 'op',
        width: 220,
        onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (_, r, index) => (
          <Space size={4} style={{ flexWrap: 'nowrap' }}>
            <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => void movePersisted(index, -1)}>
              {t('app.haoligo.equipment.inspectionParamSets.moveUp')}
            </Button>
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index >= sortedLines.length - 1}
              onClick={() => void movePersisted(index, 1)}
            >
              {t('app.haoligo.equipment.inspectionParamSets.moveDown')}
            </Button>
            <Popconfirm
              title={t('app.haoligo.equipment.inspectionParamSets.removeConfirm')}
              onConfirm={async () => {
                try {
                  await deleteInspectionParamSetItem(r.id);
                  messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                  if (editorSetId) await loadLines(editorSetId);
                } catch (e) {
                  messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
                }
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.haoligo.equipment.inspectionParamSets.removeFromPlan')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

  const pendingColumns: ColumnsType<PendingLine> = [
      {
        title: t('app.haoligo.equipment.inspectionParamSets.columnSeq'),
        width: 56,
        render: (_, __, i) => i + 1,
      },
      { title: t('app.haoligo.equipment.inspectionParamSets.colParamCode'), dataIndex: 'param_code', width: 120, ellipsis: true },
      { title: t('app.haoligo.equipment.inspectionParamSets.colParamName'), dataIndex: 'param_name', ellipsis: true },
      {
        title: t('app.haoligo.equipment.inspectionParams.colCategory'),
        dataIndex: 'param_level1_category',
        width: 100,
        ellipsis: true,
        render: (v) => v || t('app.haoligo.equipment.inspectionParams.categoryUncategorized'),
      },
      { title: t('app.haoligo.equipment.inspectionParamSets.colUnit'), dataIndex: 'param_unit', width: 72, render: (u) => u ?? '—' },
      {
        title: t('app.haoligo.equipment.inspectionParamSets.colRequired'),
        dataIndex: 'is_required',
        width: 88,
        render: (_, r) => (
          <Switch
            checked={r.is_required}
            size="small"
            onChange={(checked) => {
              setPendingLines((prev) => prev.map((x) => (x.tempId === r.tempId ? { ...x, is_required: checked } : x)));
            }}
          />
        ),
      },
      {
        title: t('app.haoligo.equipment.documents.colActions'),
        key: 'op',
        width: 220,
        onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (_, r, index) => (
          <Space size={4} style={{ flexWrap: 'nowrap' }}>
            <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => movePending(index, -1)}>
              {t('app.haoligo.equipment.inspectionParamSets.moveUp')}
            </Button>
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index >= pendingLines.length - 1}
              onClick={() => movePending(index, 1)}
            >
              {t('app.haoligo.equipment.inspectionParamSets.moveDown')}
            </Button>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removePending(r.tempId)}>
              {t('app.haoligo.equipment.inspectionParamSets.removeFromPlan')}
            </Button>
          </Space>
        ),
      },
    ];

  const columns: ProColumns<InspectionParamSetRow>[] = [
    { title: t('app.haoligo.equipment.inspectionParamSets.colSetCode'), dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: t('app.haoligo.equipment.inspectionParamSets.colSetName'), dataIndex: 'name', width: 220, ellipsis: true },
    {
      title: t('app.haoligo.equipment.documents.colActions'),
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button key="view" {...rowActionKind('read')} onClick={() => void handleDetail(record)}>
            {t('common.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => void openEditEditor(record)}>
            {t('app.haoligo.equipment.inspectionParamSets.btnEditPlan')}
          </Button>
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteSet(record)}>
            {t('app.haoligo.equipment.documents.actionDelete')}
          </Button>
        </Space>
      ),
    },
  ];

  const editorTitle = editorCreateMode
    ? t('app.haoligo.equipment.inspectionParamSets.editorTitleNew')
    : t('app.haoligo.equipment.inspectionParamSets.editorTitleEdit', { code: editorSetCode });

  return (
    <>
      <ListPageTemplate>
        <UniTable<InspectionParamSetRow>
          headerTitle={t('app.haoligo.menu.equipment.inspection-param-sets')}
          columnPersistenceId="apps.haoligo.pages.equipment.inspection-param-sets"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('app.haoligo.equipment.inspectionParamSets.btnNewPlan')}
          onCreate={() => void openCreateEditor()}
          showImportButton
          importHeaders={[
            t('app.haoligo.equipment.inspectionParamSets.importColSetCode'),
            t('app.haoligo.equipment.inspectionParamSets.importColSetName'),
            t('app.haoligo.equipment.inspectionParamSets.importColParamCode'),
            t('app.haoligo.equipment.inspectionParamSets.importColParamName'),
            t('app.haoligo.equipment.inspectionParamSets.importColParamCategory'),
            t('app.haoligo.equipment.inspectionParamSets.importColRequirement'),
            t('app.haoligo.equipment.inspectionParamSets.importColValueType'),
            t('app.haoligo.equipment.inspectionParamSets.importColDefaultValue'),
            t('app.haoligo.equipment.inspectionParamSets.importColNumericMin'),
            t('app.haoligo.equipment.inspectionParamSets.importColNumericMax'),
            t('app.haoligo.equipment.inspectionParamSets.importColUnit'),
            t('app.haoligo.equipment.inspectionParamSets.importColRequired'),
          ]}
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('app.haoligo.equipment.importEmpty'));
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
            const setCodeIdx = getIdx('方案编码', 'set_code', 'code');
            const setNameIdx = getIdx('方案名称', 'set_name', 'name');
            const paramCodeIdx = getIdx('点检编号', 'param_code', 'inspection no');
            const paramNameIdx = getIdx('点检项名称', 'param_name', 'item name');
            const catIdx = getIdx('一级分类', '设备类别一级', 'level1', 'category');
            const reqIdx = getIdx('点检要求', 'requirement');
            const vtIdx = getIdx('取值类型', 'value_type', 'value type');
            const dvIdx = getIdx('默认值', 'default');
            const minIdx = getIdx('取值下限', 'numeric_min', 'min');
            const maxIdx = getIdx('取值上限', 'numeric_max', 'max');
            const unitIdx = getIdx('单位', 'unit');
            const requiredIdx = getIdx('是否必检', 'is_required', 'required');
            if (setCodeIdx < 0 || setNameIdx < 0 || paramNameIdx < 0) {
              messageApi.error(t('app.haoligo.equipment.inspectionParamSets.importErrorHeaders'));
              return;
            }

            const rows: InspectionParamSetImportRowPayload[] = [];
            let lastSetCode = '';
            let lastSetName = '';
            for (let i = 1; i < data.length; i++) {
              const row = data[i] as unknown[];
              if (!row || row.length === 0) continue;
              const explicitSetCode = cellText(row[setCodeIdx]);
              const explicitSetName = cellText(row[setNameIdx]);
              if (explicitSetCode) {
                if (explicitSetCode !== lastSetCode) {
                  lastSetCode = explicitSetCode;
                  lastSetName = explicitSetName;
                } else if (explicitSetName) {
                  lastSetName = explicitSetName;
                }
              }
              const setCode = explicitSetCode || lastSetCode;
              const setName = explicitSetName || lastSetName;
              const paramName = cellText(row[paramNameIdx]);
              if (!setCode || !setName || !paramName) continue;
              const paramCodeRaw = paramCodeIdx >= 0 ? cellText(row[paramCodeIdx]) : '';
              const rawVt = vtIdx >= 0 ? cellText(row[vtIdx]) : '';
              const value_type = normalizeInspectionValueType(rawVt || 'numeric');
              const defaultRaw = dvIdx >= 0 ? cellText(row[dvIdx]) : '';
              let default_value: string | null = defaultRaw || null;
              if (default_value && value_type === 'boolean') {
                const dl = default_value.toLowerCase();
                if (dl.includes('是') || dl === 'true' || dl === '1' || dl === 'yes') default_value = 'true';
                else if (dl.includes('否') || dl === 'false' || dl === '0' || dl === 'no') default_value = 'false';
              }
              rows.push({
                set_code: setCode,
                set_name: setName,
                param_code: paramCodeRaw || null,
                param_name: paramName,
                level1_category: catIdx >= 0 ? cellText(row[catIdx]) || null : null,
                requirement: reqIdx >= 0 ? cellText(row[reqIdx]) || null : null,
                value_type,
                default_value,
                numeric_min: minIdx >= 0 ? parseOptionalNumber(row[minIdx]) : null,
                numeric_max: maxIdx >= 0 ? parseOptionalNumber(row[maxIdx]) : null,
                unit: unitIdx >= 0 ? cellText(row[unitIdx]) || null : null,
                is_required: requiredIdx >= 0 ? parseImportIsRequired(row[requiredIdx]) : true,
              });
            }
            if (rows.length === 0) {
              messageApi.warning(t('app.haoligo.equipment.importNoRows'));
              return;
            }
            try {
              const result = await importInspectionParamSets(rows);
              messageApi.success(
                t('app.haoligo.equipment.inspectionParamSets.importSuccess', {
                  created: result.plans_created,
                  updated: result.plans_updated,
                  paramsCreated: result.params_created,
                  paramsUpdated: result.params_updated,
                }),
              );
              actionRef.current?.reload();
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
            }
          }}
          showSyncButton
          onSync={() => {
            messageApi.info(t('app.haoligo.equipment.syncPlaceholder'));
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
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 800 }}
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
          {t('app.haoligo.equipment.inspectionParamSets.hintEditorShort')}
        </Text>
        <ProForm formRef={editorFormRef} submitter={false} layout="vertical" grid={false}>
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="code"
                label={t('app.haoligo.equipment.inspectionParamSets.fieldCode')}
                placeholder={t('app.haoligo.equipment.inspectionParamSets.fieldCodePh')}
                disabled={!editorCreateMode}
                rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParamSets.codeRequired') }]}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="name"
                label={t('app.haoligo.equipment.inspectionParamSets.fieldName')}
                placeholder={t('app.haoligo.equipment.inspectionParamSets.fieldNamePh')}
                rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParamSets.nameRequired') }]}
              />
            </Col>
          </Row>
        </ProForm>

        <Divider style={{ margin: '16px 0' }} />

        <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>
            {t('app.haoligo.equipment.inspectionParamSets.sectionSequence')}
          </Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddItem}>
            {t('app.haoligo.equipment.inspectionParamSets.btnAddItem')}
          </Button>
        </Space>

        {editorCreateMode ? (
          <Table<PendingLine>
            rowKey="tempId"
            size="small"
            pagination={false}
            columns={pendingColumns}
            dataSource={pendingLines}
            locale={{ emptyText: t('app.haoligo.equipment.inspectionParamSets.emptySequence') }}
          />
        ) : (
          <Table<LineRow>
            rowKey="id"
            size="small"
            loading={linesLoading}
            pagination={false}
            columns={persistedColumns}
            dataSource={sortedLines}
            locale={{ emptyText: t('app.haoligo.equipment.inspectionParamSets.emptySequence') }}
          />
        )}

        <div style={{ marginTop: 12 }}>
          <Link to="/apps/haoligo/equipment/inspection-params">{t('app.haoligo.equipment.inspectionParamSets.linkInspectionParams')}</Link>
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Space>
            <Button onClick={closeEditor}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
            <Button type="primary" loading={editorSaving} onClick={() => void saveEditor()}>
              {editorCreateMode
                ? t('app.haoligo.equipment.inspectionParamSets.btnCreatePlan')
                : t('app.haoligo.equipment.inspectionParamSets.btnSaveHeader')}
            </Button>
          </Space>
        </div>
      </Modal>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.code}`
            : t('app.haoligo.menu.equipment.inspection-param-sets')
        }
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
          setDetailLines([]);
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailRecord}
        columns={detailColumns}
        linesTitle={t('app.haoligo.equipment.inspectionParamSets.sectionSequence')}
        lines={
          <Table<LineRow>
            rowKey="id"
            size="small"
            pagination={false}
            columns={detailLineColumns}
            dataSource={detailLines}
            locale={{ emptyText: t('app.haoligo.equipment.inspectionParamSets.emptySequence') }}
          />
        }
      />

      <FormModalTemplate
        title={t('app.haoligo.equipment.inspectionParamSets.addItemTitle')}
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
        {level1SegmentOptions.length > 1 ? (
          <Form.Item label={t('app.haoligo.equipment.inspectionParams.colCategory')} style={{ marginBottom: 16 }}>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <ThemedSegmented
                surfaceBackground
                size="middle"
                value={paramPickerLevel1}
                onChange={(v) => setParamPickerLevel1(String(v))}
                options={level1SegmentOptions}
                style={{ width: 'max-content', minWidth: '100%' }}
              />
            </div>
          </Form.Item>
        ) : null}
        <ProFormSelect
          name="param_ids"
          label={t('app.haoligo.menu.equipment.inspection-params')}
          placeholder={t('app.haoligo.equipment.inspectionParamSets.addItemParamPh')}
          rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParamSets.pickParam') }]}
          options={addableParamOptions}
          showSearch
          fieldProps={{
            mode: 'multiple',
            optionFilterProp: 'label',
            maxTagCount: 'responsive',
          }}
        />
        <ProFormDigit
          name="sort_order"
          label={t('app.haoligo.equipment.documents.colSequence')}
          min={0}
          initialValue={0}
          fieldProps={{ precision: 0, style: { width: '100%' } }}
        />
        <ProFormSwitch name="is_required" label={t('app.haoligo.equipment.inspectionParamSets.colRequired')} />
      </FormModalTemplate>
    </>
  );
};

export default InspectionParamSetsPage;
