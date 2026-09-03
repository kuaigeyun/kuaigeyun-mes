import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设备故障维修管理页面
 *
 * 提供设备故障和维修记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持故障记录、维修流程、维修记录、故障分析等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormSelect,
  ProFormDatePicker,
  ProFormTextArea,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Descriptions, Typography, Empty, Spin, theme as AntdTheme } from 'antd';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { useEquipmentDetailDrawer } from '../shared/equipmentMasterDataDetail';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { getEquipmentFaultLifecycle } from '../../../utils/equipmentLifecycle';
import { equipmentFaultApi, equipmentApi, maintenancePlanApi } from '../../../services/equipment';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formDateRangeFormItemProps, formDateFormItemProps, toApiDateString, coerceFormDate } from '../../../../../utils/formDate';
import { formatDateTime, formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildEquipmentFaultStatusValueEnum,
  EQUIPMENT_FAULT_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveEquipmentFaultListParams,
} from '../../../utils/equipmentListCore';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { ROUTES } from '../../../constants/routes';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
const P = 'app.kuaizhizao.equipmentFault';
const FAULT_RESOURCE = 'kuaizhizao:equipment-fault';
const MAINT_RESOURCE = 'kuaizhizao:maintenance-plan';

function toApiDateTimeString(value: unknown): string | undefined {
  const d = coerceFormDate(value);
  return d ? d.format('YYYY-MM-DD HH:mm:ss') : undefined;
}

const FAULT_STATUS_KEYS: Record<string, string> = {
  '待处理': `${P}.status.pending`,
  '处理中': `${P}.status.processing`,
  '已修复': `${P}.status.repaired`,
  '已关闭': `${P}.status.closed`,
};

const FAULT_LEVEL_KEYS: Record<string, { key: string; color: string }> = {
  轻微: { key: `${P}.level.minor`, color: 'default' },
  一般: { key: `${P}.level.normal`, color: 'warning' },
  严重: { key: `${P}.level.severe`, color: 'error' },
};

const FAULT_STATUS_COLORS: Record<string, string> = {
  '待处理': 'default',
  '处理中': 'processing',
  '已修复': 'success',
  '已关闭': 'default',
};

interface EquipmentFault {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  fault_no?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  fault_date?: string;
  fault_type?: string;
  fault_level?: string;
  fault_description?: string;
  status?: string;
  repair_required?: boolean;
  source_type?: string;
  source_uuid?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
}

const EquipmentFaultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const faultDetailDrawerZIndex = token.zIndexPopupBase;
  const perms = useResourcePermissions(FAULT_RESOURCE);
  const maintPerms = useResourcePermissions(MAINT_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [, setSelectedRowKeys] = useState<React.Key[]>([]);
  const urlUuidRef = useRef<string | undefined>(undefined);
  const deepLinkOpenedRef = useRef(false);

  // Modal 相关状态（创建/编辑故障记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFault, setCurrentFault] = useState<EquipmentFault | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<any>(null);

  const { open: detailVisible, loading: detailLoading, detail: faultDetail, setDetail: setFaultDetail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<EquipmentFault>();

  const [faultTrackingRefreshKey, setFaultTrackingRefreshKey] = useState(0);

  const faultTracking = useDocumentTracking(
    detailVisible && faultDetail?.id ? 'equipment_fault' : undefined,
    faultDetail?.id,
    faultTrackingRefreshKey,
  );

  // 创建维修记录 Modal 状态
  const [repairModalVisible, setRepairModalVisible] = useState(false);
  const [repairFault, setRepairFault] = useState<EquipmentFault | null>(null);
  const [repairFormInitialValues, setRepairFormInitialValues] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const repairFormRef = useRef<any>(null);

  // 转保养 Modal 状态
  const [maintModalVisible, setMaintModalVisible] = useState(false);
  const [maintFault, setMaintFault] = useState<EquipmentFault | null>(null);
  const [maintFormInitialValues, setMaintFormInitialValues] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [maintSubmitting, setMaintSubmitting] = useState(false);
  const maintFormRef = useRef<any>(null);

  const canStartRepair = (record: EquipmentFault) =>
    Boolean(
      perms.canCreate &&
        record.repair_required &&
        record.status !== '已修复' &&
        record.status !== '已关闭',
    );

  const canStartMaint = (record: EquipmentFault) =>
    Boolean(
      maintPerms.canCreate &&
        record.status !== '已修复' &&
        record.status !== '已关闭' &&
        record.equipment_uuid,
    );

  const goSourceDocument = (sourceType?: string, sourceUuid?: string) => {
    if (!sourceUuid) return;
    if (sourceType === 'spot_check') {
      navigate(`${ROUTES.EQUIPMENT_SPOT_CHECKS}?uuid=${encodeURIComponent(sourceUuid)}`);
      return;
    }
    if (sourceType === 'route_patrol') {
      navigate(`${ROUTES.EQUIPMENT_ROUTE_PATROLS}?uuid=${encodeURIComponent(sourceUuid)}`);
      return;
    }
  };

  /**
   * 处理新建故障记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFault(null);
    setFormInitialValues({ fault_date: dayjs() });
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t(`${P}.create`)),
    [t],
  );

  /**
   * 处理编辑故障记录
   */
  const handleEdit = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setIsEdit(true);
      setCurrentFault(detail);
      setFormInitialValues({
        equipment_uuid: detail.equipment_uuid,
        fault_date: detail.fault_date ? dayjs(detail.fault_date) : dayjs(),
        fault_type: detail.fault_type,
        fault_level: detail.fault_level,
        fault_description: detail.fault_description,
        status: detail.status,
        repair_required: detail.repair_required,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t(`${P}.detailFailed`));
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = useCallback(
    (record: EquipmentFault) => {
      if (!record.uuid) {
        messageApi.error(t(`${P}.uuidNotFound`));
        return;
      }
      setFaultTrackingRefreshKey((k) => k + 1);
      void openDetail(
        () => equipmentFaultApi.get(record.uuid!) as Promise<EquipmentFault>,
        t(`${P}.detailFailed`),
      );
    },
    [messageApi, openDetail, t],
  );

  useEffect(() => {
    const uuidFromUrl = searchParams.get('uuid')?.trim() || undefined;
    urlUuidRef.current = uuidFromUrl;
    if (!uuidFromUrl) {
      deepLinkOpenedRef.current = false;
      actionRef.current?.reload();
      return;
    }
    if (deepLinkOpenedRef.current) {
      actionRef.current?.reload();
      return;
    }
    deepLinkOpenedRef.current = true;
    void (async () => {
      try {
        const response = await equipmentFaultApi.list({ uuid: uuidFromUrl, skip: 0, limit: 1 });
        const { data } = normalizeEquipmentListResponse(response);
        if (data.length > 0) {
          handleDetail(data[0] as EquipmentFault);
        }
      } catch {
        messageApi.error(t(`${P}.listFailed`));
      }
      actionRef.current?.reload();
    })();
  }, [searchParams, handleDetail, messageApi, t]);

  /**
   * 处理批量删除故障记录（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
          for (const uuid of keys) {
            await equipmentFaultApi.delete(String(uuid));
          }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          if (faultDetail?.uuid && keys.map(String).includes(String(faultDetail.uuid))) {
            closeDetail();
          }
    actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    setSubmitting(true);
    try {
      const submitData = {
        ...values,
        fault_date: toApiDateString(values.fault_date) ?? null,
        attachments: normalizeDocumentAttachments(values.attachments),
      };

      const editedUuid = isEdit ? currentFault?.uuid : undefined;
      if (isEdit && editedUuid) {
        await equipmentFaultApi.update(editedUuid, submitData);
        messageApi.success(t(`${P}.updateSuccess`));
      } else {
        await equipmentFaultApi.create(submitData);
        messageApi.success(t(`${P}.createSuccess`));
      }
      setModalVisible(false);
      setCurrentFault(null);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
      if (editedUuid && faultDetail?.uuid === editedUuid) {
        try {
          const fresh = await equipmentFaultApi.get(editedUuid);
          setFaultDetail(fresh);
          setFaultTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 打开创建维修记录 Modal
   */
  const handleCreateRepair = (record: EquipmentFault) => {
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error(t(`${P}.incompleteInfo`));
      return;
    }
    setRepairFault(record);
    setRepairFormInitialValues({
      repair_date: dayjs(),
      repair_type: '现场维修',
      repair_description: t(`${P}.repairDescriptionTemplate`, {
        faultNo: record.fault_no,
        description: record.fault_description || '',
      }),
      status: '进行中',
    });
    setRepairModalVisible(true);
  };

  /**
   * 提交创建维修记录
   */
  const handleRepairSubmit = async (values: any) => {
    if (!repairFault?.uuid || !repairFault?.equipment_uuid) return;
    setRepairSubmitting(true);
    try {
      await equipmentFaultApi.createRepair({
        equipment_uuid: repairFault.equipment_uuid,
        equipment_fault_uuid: repairFault.uuid,
        repair_date:
          toApiDateTimeString(values.repair_date) ??
          formatDateTimeBySiteSetting(new Date()),
        repair_type: values.repair_type ?? '现场维修',
        repair_description: values.repair_description ?? '',
        status: values.status ?? '进行中',
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${P}.repairCreated`));
      setRepairModalVisible(false);
      setRepairFault(null);
      setRepairFormInitialValues(undefined);
      actionRef.current?.reload();
      if (detailVisible) {
        closeDetail();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
      throw error;
    } finally {
      setRepairSubmitting(false);
    }
  };

  const handleCreateMaintenance = (record: EquipmentFault) => {
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error(t(`${P}.incompleteInfo`));
      return;
    }
    setMaintFault(record);
    setMaintFormInitialValues({
      execution_date: dayjs(),
      execution_content: t(`${P}.repairDescriptionTemplate`, {
        faultNo: record.fault_no,
        description: record.fault_description || '',
      }),
      status: '草稿',
    });
    setMaintModalVisible(true);
  };

  const handleMaintenanceSubmit = async (values: any) => {
    if (!maintFault?.uuid || !maintFault?.equipment_uuid) return;
    setMaintSubmitting(true);
    try {
      await maintenancePlanApi.execute({
        equipment_uuid: maintFault.equipment_uuid,
        execution_date:
          toApiDateTimeString(values.execution_date) ??
          formatDateTimeBySiteSetting(new Date()),
        execution_content: values.execution_content ?? '',
        status: values.status ?? '草稿',
        source_type: 'equipment_fault',
        source_uuid: maintFault.uuid,
      });
      messageApi.success(t(`${P}.maintenanceCreated`));
      setMaintModalVisible(false);
      setMaintFault(null);
      setMaintFormInitialValues(undefined);
      actionRef.current?.reload();
      if (detailVisible) {
        closeDetail();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
      throw error;
    } finally {
      setMaintSubmitting(false);
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<EquipmentFault>[] = useMemo(
    () => [
    {
      title: t(`${P}.col.faultNo`),
      dataIndex: 'fault_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.fault_no ?? '') }}>{r.fault_no ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentCode`),
      dataIndex: 'equipment_code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }}>{r.equipment_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentName`),
      dataIndex: 'equipment_name',
    },
    {
      title: t(`${P}.col.faultDate`),
      dataIndex: 'fault_date',
      valueType: 'date',
    },
    {
      title: t(`${P}.col.faultType`),
      dataIndex: 'fault_type',
    },
    {
      title: t(`${P}.col.faultLevel`),
      dataIndex: 'fault_level',
      render: (_, record) => {
        const level = record.fault_level;
        const config = level ? FAULT_LEVEL_KEYS[level] : undefined;
        if (!config) return <MarkerTag>{level || '-'}</MarkerTag>;
        return <MarkerTag color={config.color}>{t(config.key)}</MarkerTag>;
      },
    },
    {
      title: t(`${P}.col.faultDescription`),
      dataIndex: 'fault_description',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const key = status ? FAULT_STATUS_KEYS[status] : undefined;
        const text = key ? t(key) : (status || '-');
        const color = status ? (FAULT_STATUS_COLORS[status] || 'default') : 'default';
        return <StatusTag color={color}>{text}</StatusTag>;
      },
    },
    {
      title: t(`${P}.col.repairRequired`),
      dataIndex: 'repair_required',
      render: (_, record) => (
        <MarkerTag color={record.repair_required ? 'warning' : 'success'}>
          {record.repair_required ? t('common.yes') : t('common.no')}
        </MarkerTag>
      ),
    },
    {
      title: t(`${P}.col.sourceType`),
      dataIndex: 'source_type',
      render: (_, r) => {
        if (r.source_type === 'spot_check') return t(`${P}.source.spotCheck`);
        if (r.source_type === 'route_patrol') return t(`${P}.source.routePatrol`);
        return r.source_type ?? '-';
      },
    },
    {
      title: t(`${P}.col.sourceUuid`),
      dataIndex: 'source_uuid',
      render: (_, r) =>
        r.source_uuid ? (
          <Typography.Link onClick={() => goSourceDocument(r.source_type, r.source_uuid)}>
            {t(`${P}.source.viewSource`)}
          </Typography.Link>
        ) : (
          '-'
        ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
    ],
    [t, navigate]
  );

  const renderFaultRowNodes = (record: EquipmentFault): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    if (perms.canRead) {
      nodes.push(
        <Button {...rowActionKind('read')}
          key="detail"
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            void handleDetail(record);
          }}
        >
          {t('common.detail')}
        </Button>,
      );
    }
    if (perms.canUpdate) {
      nodes.push(
        <Button {...rowActionKind('update')}
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            void handleEdit(record);
          }}
        >
          {t('common.edit')}
        </Button>,
      );
    }
    if (perms.canDelete) {
      nodes.push(
        <ActionConfirmPopconfirm
          key="del"
          title={t(`${P}.deleteTitle`)}
          description={t(`${P}.deleteContent`, { code: record.fault_no })}
          onConfirm={() => record.uuid && void handleDelete([record.uuid])}
        >
          <Button
            {...rowActionKind('delete')}
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => e.stopPropagation()}
          >
            {t('common.delete')}
          </Button>
        </ActionConfirmPopconfirm>,
      );
    }
    if (canStartRepair(record)) {
      nodes.push(
        <Button {...rowActionKind('create')} key="repair" type="link" size="small" onClick={(e) => {
          e.stopPropagation();
          handleCreateRepair(record);
        }}
        >
          {t(`${P}.action.createRepair`)}
        </Button>
      );
    }
    if (canStartMaint(record)) {
      nodes.push(
        <Button {...rowActionKind('create')} key="maint" type="link" size="small" onClick={(e) => {
          e.stopPropagation();
          handleCreateMaintenance(record);
        }}
        >
          {t(`${P}.action.createMaintenance`)}
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const faultStatusValueEnum = useMemo(() => buildEquipmentFaultStatusValueEnum(t), [t]);

  const columns: ProColumns<EquipmentFault>[] = useMemo(() => alignProColumns<EquipmentFault>([
    {
      title: t(`${P}.col.faultDate`),
      dataIndex: 'fault_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 11 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: faultStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t(`${P}.col.faultType`),
      dataIndex: 'fault_type',
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t(`${P}.col.faultNo`),
      dataIndex: 'fault_no',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 30 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.fault_no ?? '') }} ellipsis>
          {r.fault_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.equipmentNameCode`),
      dataIndex: 'equipment_name',
      minWidth: 200,
      uniTablePrimaryFlex: true,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: false,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.equipment_name ?? '') || '-'}
          secondary={String(r.equipment_code ?? '') || '-'}
        />
      ),
    },
    {
      title: t(`${P}.col.faultDate`),
      dataIndex: 'fault_date',
      valueType: 'date',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.faultType`),
      dataIndex: 'fault_type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.fault_type != null && r.fault_type !== '' ? String(r.fault_type) : '-'),
    },
    {
      title: t(`${P}.col.faultLevel`),
      dataIndex: 'fault_level',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_, record) => {
        const level = record.fault_level;
        const config = level ? FAULT_LEVEL_KEYS[level] : undefined;
        if (!config) return <MarkerTag>{level || '-'}</MarkerTag>;
        return <MarkerTag color={config.color}>{t(config.key)}</MarkerTag>;
      },
    },
    {
      title: t(`${P}.col.repairRequired`),
      dataIndex: 'repair_required',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <MarkerTag color={record.repair_required ? 'warning' : 'success'}>
          {record.repair_required ? t('common.yes') : t('common.no')}
        </MarkerTag>
      ),
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t(`${P}.col.lifecycle`),
      key: 'lifecycle',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getEquipmentFaultLifecycle(record as Record<string, unknown>, t)} />
      ),
    },
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => renderFaultRowNodes(record),
    },
  ], SALES_DOC_LIST_FIELD_RANK), [t, faultStatusValueEnum]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBaseColumns, faultDetail,
    'equipment_fault',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentFault>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.equipmentFaults)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-faults-width-v2"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={EQUIPMENT_FAULT_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveEquipmentFaultListParams(searchFormValues, sort);
              const response = await equipmentFaultApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...listParams,
                ...(urlUuidRef.current ? { uuid: urlUuidRef.current } : {}),
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              return {
                data: data as EquipmentFault[],
                success: true,
                total,
              };
            } catch (error) {
              messageApi.error(t(`${P}.listFailed`));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          showDeleteButton={perms.canDelete}
          deleteConfirmTitle={t(`${P}.batchDeleteTitle`)}
          deleteConfirmDescription={(count) => t(`${P}.batchDeleteContent`, { count: count })}
          
          onDelete={handleDelete}
          showCreateButton={perms.canCreate}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      {/* 创建/编辑故障记录 Modal */}
      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentFault(null);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="equipment_uuid"
              label={t(`${P}.form.equipment`)}
              placeholder={t(`${P}.form.selectEquipment`)}
              request={async () => {
                try {
                  const response = await equipmentApi.list({ limit: 1000 });
                  return (response.items || []).map((eq: any) => ({
                    label: `${eq.code} - ${eq.name}`,
                    value: eq.uuid,
                  }));
                } catch (error) {
                  return [];
                }
              }}
              rules={[{ required: true, message: t(`${P}.form.selectEquipment`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="fault_date"
              label={t(`${P}.col.faultDate`)}
              placeholder={t(`${P}.form.selectFaultDate`)}
              rules={[{ required: true, message: t(`${P}.form.selectFaultDate`) }]}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="fault_type"
              label={t(`${P}.col.faultType`)}
              placeholder={t(`${P}.form.selectFaultType`)}
              options={[
                { label: t(`${P}.faultType.mechanical`), value: '机械故障' },
                { label: t(`${P}.faultType.electrical`), value: '电气故障' },
                { label: t(`${P}.faultType.software`), value: '软件故障' },
                { label: t(`${P}.faultType.other`), value: '其他' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectFaultType`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="fault_level"
              label={t(`${P}.col.faultLevel`)}
              placeholder={t(`${P}.form.selectFaultLevel`)}
              options={[
                { label: t(`${P}.level.minor`), value: '轻微' },
                { label: t(`${P}.level.normal`), value: '一般' },
                { label: t(`${P}.level.severe`), value: '严重' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectFaultLevel`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="fault_description"
              label={t(`${P}.form.faultDescription`)}
              placeholder={t(`${P}.form.faultDescriptionPlaceholder`)}
              rules={[{ required: true, message: t(`${P}.form.faultDescriptionPlaceholder`) }]}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label={t('common.status')}
              placeholder={t(`${P}.form.selectStatus`)}
              options={[
                { label: t(`${P}.status.pending`), value: '待处理' },
                { label: t(`${P}.status.processing`), value: '处理中' },
                { label: t(`${P}.status.repaired`), value: '已修复' },
                { label: t(`${P}.status.closed`), value: '已关闭' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectStatus`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="repair_required"
              label={t(`${P}.col.repairRequired`)}
              placeholder={t(`${P}.form.selectRepairRequired`)}
              options={[
                { label: t('common.yes'), value: true },
                { label: t('common.no'), value: false },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectRepairRequired`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <DocumentAttachmentsField category="equipment_fault_attachments" />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 创建维修记录 Modal */}
      <FormModalTemplate
        title={t(`${P}.repairModal`)}
        open={repairModalVisible}
        onClose={() => {
          setRepairModalVisible(false);
          setRepairFault(null);
          setRepairFormInitialValues(undefined);
        }}
        onFinish={handleRepairSubmit}
        isEdit={false}
        loading={repairSubmitting}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={repairFormRef}
        initialValues={repairFormInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="repair_date"
              label={t(`${P}.form.repairDate`)}
              placeholder={t(`${P}.form.selectRepairDate`)}
              rules={[{ required: true, message: t(`${P}.form.selectRepairDate`) }]}
              formItemProps={formDateFormItemProps}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="repair_type"
              label={t(`${P}.form.repairType`)}
              placeholder={t(`${P}.form.selectRepairType`)}
              options={[
                { label: t(`${P}.repairType.onSite`), value: '现场维修' },
                { label: t(`${P}.repairType.returnFactory`), value: '返厂维修' },
                { label: t(`${P}.repairType.outsource`), value: '委外维修' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectRepairType`) }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <DocumentAttachmentsField category="equipment_repair_attachments" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="repair_description"
              label={t(`${P}.form.repairDescription`)}
              placeholder={t(`${P}.form.repairDescriptionPlaceholder`)}
              rules={[{ required: true, message: t(`${P}.form.repairDescriptionPlaceholder`) }]}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label={t(`${P}.form.repairStatus`)}
              placeholder={t(`${P}.form.selectRepairStatus`)}
              options={[
                { label: t(`${P}.repairStatus.inProgress`), value: '进行中' },
                { label: t(`${P}.repairStatus.completed`), value: '已完成' },
                { label: t(`${P}.repairStatus.cancelled`), value: '已取消' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.selectRepairStatus`) }]}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 转保养 Modal */}
      <FormModalTemplate
        title={t(`${P}.maintenanceModal`)}
        open={maintModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setMaintModalVisible(false);
            setMaintFault(null);
            setMaintFormInitialValues(undefined);
          }
        }}
        formRef={maintFormRef}
        initialValues={maintFormInitialValues}
        onFinish={handleMaintenanceSubmit}
        submitter={{
          submitButtonProps: { loading: maintSubmitting },
        }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="execution_date"
              label={t('app.kuaizhizao.maintenanceExecution.col.executionDate')}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
              formItemProps={formDateFormItemProps}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="equipment_name"
              label={t(`${P}.col.equipmentName`)}
              disabled
              initialValue={maintFault?.equipment_name}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="execution_content"
              label={t('app.kuaizhizao.maintenanceExecution.col.executionContent')}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 故障记录详情 Drawer */}
      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={detailVisible}
        loading={detailLoading}
        zIndex={faultDetailDrawerZIndex}
        onClose={closeDetail}
        size={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          faultDetail ? (
            <>
              {canStartRepair(faultDetail) ? (
                <Button type="primary" onClick={() => handleCreateRepair(faultDetail)}>
                  {t(`${P}.action.createRepair`)}
                </Button>
              ) : null}
              {canStartMaint(faultDetail) ? (
                <Button style={{ marginLeft: 8 }} onClick={() => handleCreateMaintenance(faultDetail)}>
                  {t(`${P}.action.createMaintenance`)}
                </Button>
              ) : null}
            </>
          ) : null
        }
        basic={
          faultDetail ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        basicTitle={t(`${P}.section.basicInfo`)}
        collaborationTitle={t(`${P}.section.lifecycle`)}
        collaborationLifecycle={
          faultDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const lc = getEquipmentFaultLifecycle(faultDetail as Record<string, unknown>, t);
                const mainStages = lc.mainStages ?? [];
                if (mainStages.length === 0) return null;
                return (
                  <UniLifecycleStepper
                    steps={mainStages}
                    showLabels
                    status={lc.status}
                    nextStepSuggestions={lc.nextStepSuggestions}
                    hideNextStepSuggestions
                  />
                );
              })()}
            </div>
          ) : undefined
        }
        traceDocument={
          faultDetail?.id != null
            ? {
                documentType: 'equipment_fault',
                documentId: faultDetail.id,
                selfDocumentId: faultDetail.id,
                renderBriefActions: (doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={closeDetail}
                  />
                ),
              }
            : null
        }
        supplementary={
          faultDetail?.attachments?.length ? (
            <LineAttachmentsUpload
              category="equipment_fault_attachments"
              value={faultDetail.attachments}
              readOnly
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noDetailLines`)} />
          )
        }
        supplementaryTitle={t(`${P}.section.detailInfo`)}
        timeline={
          faultTracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : faultTracking.error ? (
            <Typography.Text type="danger">{faultTracking.error}</Typography.Text>
          ) : faultTracking.data ? (
            <DocumentTrackingTimelineBody data={faultTracking.data} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
          )
        }
        timelineTitle={t(`${P}.section.operationHistory`)}
      />
    </>
  );
};

export default EquipmentFaultsPage;

