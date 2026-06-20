/**
 * 好力 GO — 设备台账
 *
 * 列表：ListPageTemplate + UniTable（服务端分页，支持车间 / 代号 / 名称筛选）。
 * 表单：类别、车间必填；制造厂商、点检方案、出厂日期、备注可选；设备代号创建后不可改。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadProps } from 'antd';
import { App, Button, Col, Modal, Row, Space, Table, Typography, Upload } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import {
  createEquipment,
  deleteEquipment,
  formatCategoryDisplayName,
  formatCategoryLabel,
  getEquipment,
  listCategories,
  listEquipments,
  listEquipmentOperationalStatusHistory,
  listEquipmentUpkeepParamSets,
  listInspectionParamSets,
  listManufacturers,
  listWorkshops,
  updateEquipment,
  type CategoryRow,
  type EquipmentCreatePayload,
  type EquipmentOperationalStatusLogRow,
  type EquipmentRow,
  type EquipmentUpdatePayload,
  type EquipmentUpkeepParamSetRow,
  type InspectionParamSetRow,
  type ManufacturerRow,
  type WorkshopRow,
} from '../../../services/haoligo';
import { batchImport } from '../../../../../utils/batchOperations';
import { uploadFile } from '../../../../../services/file';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { EquipmentImageList } from '../../../components/EquipmentImageList';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../patrol/shared/uploadHelpers';
import { withMoldPictureCardUploadClass } from '../../../utils/moldPictureCardUpload';
import {
  HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT,
  useEquipmentOperationalStatusLabels,
} from '../../../utils/equipmentOperationalStatus';

function toIsoDate(v: unknown): string | null | undefined {
  if (v == null || v === '') return null;
  if (dayjs.isDayjs(v)) return v.format('YYYY-MM-DD');
  const s = String(v).trim();
  return s ? s.slice(0, 10) : null;
}

function decStrOrUndef(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? String(v).trim() : undefined;
}

function intOrUndef(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.trunc(n);
}

const EquipmentLedgerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [paramSets, setParamSets] = useState<InspectionParamSetRow[]>([]);
  const [upkeepSets, setUpkeepSets] = useState<EquipmentUpkeepParamSetRow[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false);
  const [statusHistoryRows, setStatusHistoryRows] = useState<EquipmentOperationalStatusLogRow[]>([]);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<EquipmentRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [level1Filter, setLevel1Filter] = useState<string>('__all__');

  const loadLookups = useCallback(async () => {
    try {
      const [ws, cat, mfr, sets, upkeep] = await Promise.all([
        listWorkshops(),
        listCategories(),
        listManufacturers(),
        listInspectionParamSets(),
        listEquipmentUpkeepParamSets(),
      ]);
      setWorkshops(ws);
      setCategories(cat);
      setManufacturers(mfr);
      setParamSets(sets);
      setUpkeepSets(upkeep);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.ledger.loadLookupFailed'));
    }
  }, [messageApi, t]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    actionRef.current?.reload();
  }, [level1Filter]);

  const level1SegmentOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: t('app.haoligo.equipment.ledger.categoryFilterAll'), value: '__all__' },
    ];
    const seen = new Set<string>();
    let hasUncategorized = false;
    for (const c of categories) {
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
  }, [categories, t]);

  const workshopOptions = useMemo(
    () => workshops.map((w) => ({ label: `${w.code} · ${w.name}`, value: w.id })),
    [workshops],
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: formatCategoryLabel(c), value: c.id })),
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
  const upkeepSetOptions = useMemo(
    () => upkeepSets.map((s) => ({ label: `${s.code} · ${s.name}`, value: s.id })),
    [upkeepSets],
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const wsMap = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const mfrMap = useMemo(() => new Map(manufacturers.map((m) => [m.id, m])), [manufacturers]);
  const setMap = useMemo(() => new Map(paramSets.map((s) => [s.id, s])), [paramSets]);

  const criticalityLabel = useCallback(
    (c: string | null | undefined) => {
      const u = c?.toUpperCase();
      if (!u) return t('app.haoligo.equipment.ledger.criticalityNone');
      if (u === 'A') return t('app.haoligo.equipment.ledger.criticalityA');
      if (u === 'B') return t('app.haoligo.equipment.ledger.criticalityB');
      if (u === 'C') return t('app.haoligo.equipment.ledger.criticalityC');
      return u;
    },
    [t],
  );

  const criticalitySelectOptions = useMemo(
    () => [
      { label: t('app.haoligo.equipment.ledger.criticalityA'), value: 'A' },
      { label: t('app.haoligo.equipment.ledger.criticalityB'), value: 'B' },
      { label: t('app.haoligo.equipment.ledger.criticalityC'), value: 'C' },
    ],
    [t],
  );

  const { formatStatus: operationalStatusLabel } = useEquipmentOperationalStatusLabels();
  const operationalStatusNoneLabel = t('app.haoligo.equipment.ledger.operationalStatusNone');

  const dash = useMemo(() => t('app.haoligo.equipment.ledger.commonDash'), [t]);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  const handleDetail = async (record: EquipmentRow) => {
    setDetailOpen(true);
    setDetailRecord(record);
    setDetailLoading(true);
    try {
      const detail = await getEquipment(record.id);
      setDetailRecord(detail);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.ledger.loadEquipmentFailed'));
    } finally {
      setDetailLoading(false);
    }
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
        inspection_param_set_ids: detail.inspection_param_set_ids ?? [],
        upkeep_param_set_id: detail.upkeep_param_set_id ?? undefined,
        criticality: detail.criticality ?? undefined,
        operational_status: detail.operational_status ?? undefined,
        manufacture_date: detail.manufacture_date ? dayjs(detail.manufacture_date) : undefined,
        maintenance_cycle_by_yield:
          detail.maintenance_cycle_by_yield != null ? Number(detail.maintenance_cycle_by_yield) : undefined,
        maintenance_cycle_by_days: detail.maintenance_cycle_by_days ?? undefined,
        used_yield: detail.used_yield != null ? Number(detail.used_yield) : undefined,
        remark: detail.remark ?? '',
        equipment_images: await uuidsToSecureUploadFileList(detail.image_file_uuids),
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.ledger.loadEquipmentFailed'));
    }
  };

  const handleDeleteOne = (record: EquipmentRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.ledger.deleteTitle'),
      content: t('app.haoligo.equipment.ledger.deleteContent', { name: record.name, asset_code: record.asset_code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEquipment(record.id);
          messageApi.success(t('app.haoligo.equipment.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.deleteFailed'));
        }
      },
    });
  };

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> =>
      withMoldPictureCardUploadClass({
        listType: 'picture-card',
        accept: '.jpg,.jpeg,.png,.gif,.webp',
        beforeUpload: (file) => {
          const isLt30M = (file.size ?? 0) / 1024 / 1024 < 30;
          if (!isLt30M) {
            messageApi.error(t('app.haoligo.equipment.ledger.imageSizeLimit'));
            return Upload.LIST_IGNORE;
          }
          return true;
        },
        customRequest: async (options) => {
          try {
            const file = options.file as Parameters<typeof uploadFile>[0];
            const res = await uploadFile(file, { category: 'haoligo_equipment' });
            options.onSuccess?.(res, options.file);
          } catch (err) {
            options.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        },
      }),
    [messageApi, t],
  );

  const operationalStatusPayload = (values: Record<string, unknown>): string | null => {
    const raw = values.operational_status;
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().toLowerCase();
    if (s === 'running' || s === 'repair' || s === 'shutdown' || s === 'standby') return s;
    return null;
  };

  const criticalityPayload = (values: Record<string, unknown>): string | null => {
    const raw = values.criticality;
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().toUpperCase();
    if (s === 'A' || s === 'B' || s === 'C') return s;
    return null;
  };

  const buildCreatePayload = (values: Record<string, unknown>): EquipmentCreatePayload => ({
    asset_code: String(values.asset_code ?? '').trim(),
    name: String(values.name ?? '').trim(),
    category_id: Number(values.category_id),
    workshop_id: Number(values.workshop_id),
    manufacturer_id:
      values.manufacturer_id != null && values.manufacturer_id !== '' ? Number(values.manufacturer_id) : null,
    inspection_param_set_ids: Array.isArray(values.inspection_param_set_ids)
      ? (values.inspection_param_set_ids as unknown[])
          .map((x) => Number(x))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [],
    upkeep_param_set_id:
      values.upkeep_param_set_id != null && values.upkeep_param_set_id !== ''
        ? Number(values.upkeep_param_set_id)
        : null,
    criticality: criticalityPayload(values),
    operational_status: operationalStatusPayload(values),
    manufacture_date: toIsoDate(values.manufacture_date) ?? null,
    maintenance_cycle_by_yield: decStrOrUndef(values.maintenance_cycle_by_yield),
    maintenance_cycle_by_days: intOrUndef(values.maintenance_cycle_by_days),
    remark: String(values.remark ?? '').trim() || null,
    image_file_uuids: normUploadUuids(values.equipment_images),
  });

  const buildUpdatePayload = (values: Record<string, unknown>): EquipmentUpdatePayload => ({
    name: String(values.name ?? '').trim(),
    category_id: Number(values.category_id),
    workshop_id: Number(values.workshop_id),
    manufacturer_id:
      values.manufacturer_id != null && values.manufacturer_id !== '' ? Number(values.manufacturer_id) : null,
    inspection_param_set_ids: Array.isArray(values.inspection_param_set_ids)
      ? (values.inspection_param_set_ids as unknown[])
          .map((x) => Number(x))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [],
    upkeep_param_set_id:
      values.upkeep_param_set_id != null && values.upkeep_param_set_id !== ''
        ? Number(values.upkeep_param_set_id)
        : null,
    criticality: criticalityPayload(values),
    operational_status: operationalStatusPayload(values),
    manufacture_date: toIsoDate(values.manufacture_date) ?? null,
    maintenance_cycle_by_yield: decStrOrUndef(values.maintenance_cycle_by_yield),
    maintenance_cycle_by_days: intOrUndef(values.maintenance_cycle_by_days),
    remark: String(values.remark ?? '').trim() || null,
    image_file_uuids: normUploadUuids(values.equipment_images),
  });

  const formatPlanNames = (ids: number[] | undefined | null) => {
    if (!ids?.length) return dash;
    return ids
      .map((id) => {
        const s = setMap.get(id);
        return s ? s.name : String(id);
      })
      .join('、');
  };

  const openStatusHistory = async () => {
    if (editId == null) return;
    setStatusHistoryLoading(true);
    setStatusHistoryOpen(true);
    try {
      const rows = await listEquipmentOperationalStatusHistory(editId, { limit: 100 });
      setStatusHistoryRows(rows);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.ledger.statusHistoryLoadFailed'));
      setStatusHistoryRows([]);
    } finally {
      setStatusHistoryLoading(false);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateEquipment(editId, buildUpdatePayload(values));
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        await createEquipment(buildCreatePayload(values));
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<EquipmentRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.ledger.colAssetCode'), dataIndex: 'asset_code' },
      { title: t('app.haoligo.equipment.ledger.colName'), dataIndex: 'name' },
      {
        title: t('app.haoligo.equipment.ledger.colCategory'),
        dataIndex: 'category_id',
        render: (_, r) => {
          const c = catMap.get(r.category_id);
          return c ? formatCategoryDisplayName(c) : r.category_id;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colWorkshop'),
        dataIndex: 'workshop_id',
        render: (_, r) => {
          const w = wsMap.get(r.workshop_id);
          return w ? w.name : r.workshop_id;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colManufacturer'),
        dataIndex: 'manufacturer_id',
        render: (_, r) => {
          if (r.manufacturer_id == null) return dash;
          const m = mfrMap.get(r.manufacturer_id);
          return m ? m.name : r.manufacturer_id;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colPlan'),
        dataIndex: 'inspection_param_set_ids',
        render: (_, r) =>
          formatPlanNames(
            r.inspection_param_set_ids ?? [],
          ),
      },
      {
        title: t('app.haoligo.equipment.ledger.colCriticality'),
        dataIndex: 'criticality',
        render: (_, r) => criticalityLabel(r.criticality),
      },
      {
        title: t('app.haoligo.equipment.ledger.colOperationalStatus'),
        dataIndex: 'operational_status',
        render: (_, r) => operationalStatusLabel(r.operational_status, operationalStatusNoneLabel),
      },
      {
        title: t('app.haoligo.equipment.ledger.colManufactureDate'),
        dataIndex: 'manufacture_date',
        render: (_, r) => (r.manufacture_date ? String(r.manufacture_date).slice(0, 10) : dash),
      },
      {
        title: '保养周期(依产量)',
        dataIndex: 'maintenance_cycle_by_yield',
        render: (_, r) => r.maintenance_cycle_by_yield ?? dash,
      },
      {
        title: '保养周期(依天数)',
        dataIndex: 'maintenance_cycle_by_days',
        render: (_, r) => (r.maintenance_cycle_by_days != null ? r.maintenance_cycle_by_days : dash),
      },
      {
        title: '累计产量',
        dataIndex: 'used_yield',
        render: (_, r) => r.used_yield ?? dash,
      },
      { title: t('app.haoligo.equipment.ledger.colRemark'), dataIndex: 'remark', render: (_, r) => r.remark || dash },
      {
        title: t('app.haoligo.equipment.ledger.colEquipmentImages'),
        dataIndex: 'image_file_uuids',
        render: (_, r) => (
          <EquipmentImageList uuids={r.image_file_uuids} width={56} height={56} fallback={dash} />
        ),
      },
    ],
    [t, dash, catMap, wsMap, mfrMap, setMap, criticalityLabel, operationalStatusLabel],
  );

  const columns: ProColumns<EquipmentRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.ledger.colAssetCode'), dataIndex: 'asset_code', width: 120, ellipsis: true, fixed: 'left' },
      { title: t('app.haoligo.equipment.ledger.colName'), dataIndex: 'name', width: 180, ellipsis: true },
      {
        title: t('app.haoligo.equipment.ledger.colCategory'),
        dataIndex: 'category_id',
        width: 160,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) => {
          const c = catMap.get(r.category_id);
          return c ? formatCategoryDisplayName(c) : r.category_id;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colWorkshop'),
        dataIndex: 'workshop_id',
        width: 140,
        hideInTable: true,
        valueType: 'select',
        fieldProps: { options: workshopOptions, allowClear: true, placeholder: t('app.haoligo.equipment.ledger.workshopFilterPh') },
      },
      {
        title: t('app.haoligo.equipment.ledger.colWorkshop'),
        dataIndex: 'workshop_id',
        width: 160,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) => {
          const w = wsMap.get(r.workshop_id);
          return w ? w.name : r.workshop_id;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colManufacturer'),
        dataIndex: 'manufacturer_id',
        width: 140,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) => {
          if (r.manufacturer_id == null) return dash;
          const m = mfrMap.get(r.manufacturer_id);
          return m ? m.name : r.manufacturer_id;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colPlan'),
        dataIndex: 'inspection_param_set_ids',
        width: 160,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) =>
          formatPlanNames(
            r.inspection_param_set_ids ?? [],
          ),
      },
      {
        title: t('app.haoligo.equipment.ledger.colCriticality'),
        dataIndex: 'criticality',
        width: 100,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) => criticalityLabel(r.criticality),
      },
      {
        title: t('app.haoligo.equipment.ledger.colOperationalStatus'),
        dataIndex: 'operational_status',
        width: 120,
        hideInSearch: true,
        ellipsis: true,
        render: (_, r) => operationalStatusLabel(r.operational_status, operationalStatusNoneLabel),
      },
      {
        title: t('app.haoligo.equipment.ledger.colManufactureDate'),
        dataIndex: 'manufacture_date',
        width: 112,
        hideInSearch: true,
        render: (_, r) => (r.manufacture_date ? String(r.manufacture_date).slice(0, 10) : dash),
      },
      {
        title: '保养周期(依产量)',
        dataIndex: 'maintenance_cycle_by_yield',
        width: 130,
        hideInSearch: true,
        render: (_, r) => r.maintenance_cycle_by_yield ?? dash,
      },
      {
        title: '保养周期(依天数)',
        dataIndex: 'maintenance_cycle_by_days',
        width: 120,
        hideInSearch: true,
        render: (_, r) => (r.maintenance_cycle_by_days != null ? r.maintenance_cycle_by_days : dash),
      },
      {
        title: '累计产量',
        dataIndex: 'used_yield',
        width: 110,
        hideInSearch: true,
        render: (_, r) => r.used_yield ?? dash,
      },
      { title: t('app.haoligo.equipment.ledger.colRemark'), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
      {
        title: t('app.haoligo.equipment.ledger.colActions'),
        valueType: 'option',
        width: 200,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button key="view" {...rowActionKind('read')} onClick={() => void handleDetail(record)}>
              {t('common.detail')}
            </Button>
            <Button key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)}>
              {t('app.haoligo.equipment.ledger.actionEdit')}
            </Button>
            <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
              {t('app.haoligo.equipment.ledger.actionDelete')}
            </Button>
          </Space>
        ),
      },
    ],
    [t, dash, catMap, wsMap, mfrMap, setMap, workshopOptions, criticalityLabel, operationalStatusLabel, handleEdit, handleDeleteOne],
  );

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
          headerTitle={t('app.haoligo.equipment.ledger.title')}
          columnPersistenceId="apps.haoligo.pages.equipment.ledger"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          beforeSearchButtons={
            level1SegmentOptions.length > 1 ? (
              <ThemedSegmented
                key="equipment-level1-filter"
                surfaceBackground
                size="middle"
                value={level1Filter}
                onChange={(v) => setLevel1Filter(String(v))}
                options={level1SegmentOptions}
              />
            ) : null
          }
          showCreateButton
          createButtonText={t('app.haoligo.equipment.ledger.createBtn')}
          onCreate={handleCreate}
          showImportButton
          importHeaders={[
            t('app.haoligo.equipment.ledger.importColAssetCode'),
            t('app.haoligo.equipment.ledger.importColName'),
            t('app.haoligo.equipment.ledger.importColCategory'),
            t('app.haoligo.equipment.ledger.importColWorkshop'),
            t('app.haoligo.equipment.ledger.importColManufacturer'),
            t('app.haoligo.equipment.ledger.importColPlan'),
            t('app.haoligo.equipment.ledger.importColDate'),
            t('app.haoligo.equipment.ledger.importColRemark'),
            t('app.haoligo.equipment.ledger.importColCriticality'),
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
            const acIdx = getIdx('设备代号', '代号', 'asset');
            const nameIdx = getIdx('设备名称', '名称', 'name');
            const catIdx = getIdx('类别编码', '类别', 'category');
            const wsIdx = getIdx('车间编码', '车间', 'workshop');
            const mfrIdx = getIdx('制造厂商编码', '厂商', 'manufacturer');
            const setIdx = getIdx('点检方案编码', '方案', 'param set', 'paramset');
            const dateIdx = getIdx('出厂日期', '日期', 'manufacture');
            const remarkIdx = getIdx('备注', 'remark');
            const critIdx = getIdx('重要等级', 'abc', 'criticality', '等级', 'crit');
            if (acIdx < 0 || nameIdx < 0 || catIdx < 0 || wsIdx < 0) {
              messageApi.error(t('app.haoligo.equipment.ledger.importErrorCoreCols'));
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
              const setCodeRaw = setIdx >= 0 ? String(row[setIdx] ?? '').trim() : '';
              const setCodes = setCodeRaw
                ? setCodeRaw
                    .split(/[,，;；]/)
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean)
                : [];
              const manufacturer_id = mfrCode ? codeMap.mfr.get(mfrCode) ?? null : null;
              const inspection_param_set_ids: number[] = [];
              for (const sc of setCodes) {
                const sid = codeMap.ps.get(sc);
                if (sid == null) {
                  inspection_param_set_ids.length = 0;
                  break;
                }
                if (!inspection_param_set_ids.includes(sid)) inspection_param_set_ids.push(sid);
              }
              if (mfrCode && manufacturer_id == null) continue;
              if (setCodes.length && inspection_param_set_ids.length !== setCodes.length) continue;
              const dateRaw = dateIdx >= 0 ? String(row[dateIdx] ?? '').trim() : '';
              const manufacture_date = dateRaw ? dateRaw.slice(0, 10) : null;
              const critRaw = critIdx >= 0 ? String(row[critIdx] ?? '').trim().toUpperCase() : '';
              let criticality: string | null = null;
              if (critRaw) {
                if (critRaw !== 'A' && critRaw !== 'B' && critRaw !== 'C') continue;
                criticality = critRaw;
              }
              items.push({
                asset_code,
                name,
                category_id,
                workshop_id,
                manufacturer_id,
                inspection_param_set_ids,
                criticality,
                manufacture_date,
                remark: remarkIdx >= 0 ? String(row[remarkIdx] ?? '').trim() || null : null,
              });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.haoligo.equipment.ledger.importErrorEncoding'));
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createEquipment(item),
              title: t('app.haoligo.equipment.ledger.importTitle'),
              concurrency: 3,
            });
            if (result.successCount > 0) {
              messageApi.success(t('app.haoligo.equipment.importSuccess', { count: result.successCount }));
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(t('app.haoligo.equipment.importPartialFail', { count: result.failureCount }));
            }
          }}
          showSyncButton
          onSync={() => {
            messageApi.info(t('app.haoligo.equipment.syncPlaceholder'));
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
                level1_category:
                  level1Filter === '__all__'
                    ? undefined
                    : level1Filter,
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
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1900 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.haoligo.equipment.ledger.modalEdit') : t('app.haoligo.equipment.ledger.modalCreate')}
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
              label={t('app.haoligo.equipment.ledger.formAssetCode')}
              placeholder={t('app.haoligo.equipment.ledger.formAssetCodePh')}
              disabled={isEdit}
              rules={[{ required: true, message: t('app.haoligo.equipment.ledger.formAssetCodeReq') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('app.haoligo.equipment.ledger.formName')}
              placeholder={t('app.haoligo.equipment.ledger.formNamePh')}
              rules={[{ required: true, message: t('app.haoligo.equipment.ledger.formNameReq') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="category_id"
              label={t('app.haoligo.equipment.ledger.formCategory')}
              options={categoryOptions}
              rules={[{ required: true, message: t('app.haoligo.equipment.ledger.formCategoryReq') }]}
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="workshop_id"
              label={
                <span>
                  {t('app.haoligo.equipment.ledger.formWorkshop')}{' '}
                  <Link to="/apps/master-data/factory/workshops" style={{ fontSize: 12, fontWeight: 400 }}>
                    {t('app.haoligo.equipment.ledger.linkMasterDataWorkshops')}
                  </Link>
                </span>
              }
              options={workshopOptions}
              rules={[{ required: true, message: t('app.haoligo.equipment.ledger.formWorkshopReq') }]}
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="manufacturer_id"
              label={t('app.haoligo.equipment.ledger.formManufacturer')}
              options={manufacturerOptions}
              allowClear
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="inspection_param_set_ids"
              label={
                <span>
                  {t('app.haoligo.equipment.ledger.formPlan')}{' '}
                  <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                    {t('app.haoligo.equipment.ledger.formPlanMultiple')}
                  </Typography.Text>{' '}
                  <Link to="/apps/haoligo/equipment/inspection-param-sets" style={{ fontSize: 12, fontWeight: 400 }}>
                    {t('app.haoligo.equipment.ledger.linkInspectionPlans')}
                  </Link>
                </span>
              }
              options={paramSetOptions}
              allowClear
              showSearch
              mode="multiple"
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="upkeep_param_set_id"
              label="保养方案"
              placeholder="请选择保养方案"
              options={upkeepSetOptions}
              allowClear
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="criticality"
              label={t('app.haoligo.equipment.ledger.formCriticality')}
              tooltip={t('app.haoligo.equipment.ledger.formCriticalityPh')}
              options={criticalitySelectOptions}
              allowClear
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode={HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT}
              name="operational_status"
              label={t('app.haoligo.equipment.ledger.formOperationalStatus')}
              placeholder={t('app.haoligo.equipment.ledger.formOperationalStatusPh')}
            />
            {isEdit && editId != null ? (
              <Typography.Link style={{ fontSize: 12 }} onClick={() => void openStatusHistory()}>
                {t('app.haoligo.equipment.ledger.viewStatusHistory')}
              </Typography.Link>
            ) : null}
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="manufacture_date"
              label={t('app.haoligo.equipment.ledger.formManufactureDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="maintenance_cycle_by_yield"
              label="保养周期(依产量)"
              placeholder="请输入保养周期(依产量)"
              min={0}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="maintenance_cycle_by_days"
              label="保养周期(依天数)"
              placeholder="请输入保养周期(依天数)"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          {isEdit ? (
            <Col span={12}>
              <ProFormDigit
                name="used_yield"
                label="累计产量"
                disabled
                fieldProps={{ precision: 4, style: { width: '100%' } }}
              />
            </Col>
          ) : null}
          <Col span={24}>
            <ProFormUploadButton
              name="equipment_images"
              label={t('app.haoligo.equipment.ledger.formEquipmentImages')}
              max={10}
              fieldProps={uploadFieldProps}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('app.haoligo.equipment.ledger.formRemark')} fieldProps={{ rows: 3 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.asset_code}`
            : t('app.haoligo.equipment.ledger.title')
        }
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailRecord}
        columns={detailColumns}
      />

      <Modal
        title={t('app.haoligo.equipment.ledger.statusHistoryTitle')}
        open={statusHistoryOpen}
        onCancel={() => setStatusHistoryOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <Table<EquipmentOperationalStatusLogRow>
          size="small"
          rowKey="id"
          loading={statusHistoryLoading}
          pagination={false}
          dataSource={statusHistoryRows}
          columns={[
            {
              title: t('app.haoligo.equipment.ledger.statusHistoryColTime'),
              dataIndex: 'created_at',
              width: 180,
              render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '—'),
            },
            {
              title: t('app.haoligo.equipment.ledger.statusHistoryColOld'),
              dataIndex: 'old_status',
              width: 120,
              render: (v: string | null) => operationalStatusLabel(v, operationalStatusNoneLabel),
            },
            {
              title: t('app.haoligo.equipment.ledger.statusHistoryColNew'),
              dataIndex: 'new_status',
              width: 120,
              render: (v: string) => operationalStatusLabel(v || null, operationalStatusNoneLabel),
            },
            { title: t('app.haoligo.equipment.ledger.statusHistoryColUser'), dataIndex: 'changed_by_user_id', width: 100 },
          ]}
        />
      </Modal>
    </>
  );
};

export default EquipmentLedgerPage;
