import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
/**
 * 工装台账页面
 *
 * 提供工装的 CRUD 功能，包括列表展示、创建、编辑等操作。
 * 详情抽屉包含方案绑定、保养/校验记录（只读）、运营单据链接。
 */
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormSwitch,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Tag, Table, Select, Modal, Row, Col, Typography, Empty, Spin, Space, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerSection, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { toolApi } from '../../../services/equipment';
import { maintenanceSchemesApi, repairSchemesApi, schemeBindingsApi, maintenancesApi, calibrationsApi } from '../../../services/toolOps';
import { batchImport } from '../../../../../utils/batchOperations';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import {
  IMPORT_YES_NO_OPTIONS,
  pickImportExampleValue,
} from '../../../../../utils/loadImportDictionaryValues';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { formatDateTime } from '../../../../../utils/format';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { formDateFormItemProps, formDateRangeFormItemProps, toApiDateString } from '../../../../../utils/formDate';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveLedgerListParams,
} from '../../../utils/equipmentListCore';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  renderEquipmentMasterRowActions,
} from '../shared/equipmentMasterDataDetail';

interface Tool {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  spec?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  status?: string;
  is_active?: boolean;
  maintenance_period?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  total_usage_count?: number;
  description?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
}


interface ToolMaintenance {
  uuid?: string;
  document_no?: string;
  maintenance_date?: string;
  planned_date?: string;
  applicant_name?: string;
  status?: string;
}

interface ToolCalibration {
  uuid?: string;
  calibration_date?: string;
  calibration_org?: string;
  certificate_no?: string;
  result?: string;
  expiry_date?: string;
  status?: string;
}

const ToolLedgerPage: React.FC = () => {
  const perms = useResourcePermissions('kuaizhizao:equipment-management-tool-ledger');
  const { t, i18n } = useTranslation();
  const toolDictOptions = useImportDictionaryOptions(['TOOL_TYPE', 'TOOL_STATUS']);
  const parseToolDict = toolDictOptions.parseDict;

  const toolLedgerImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.toolLedger.import.code', aliases: ['工装编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.toolLedger.import.name', aliases: ['工装名称', '名称'] },
          {
            field: 'type',
            labelKey: 'app.kuaizhizao.toolLedger.import.type',
            aliases: ['工装类型', '类型'],
            options: toolDictOptions.TOOL_TYPE,
          },
          { field: 'spec', labelKey: 'app.kuaizhizao.toolLedger.import.specification', aliases: ['规格型号', '规格'] },
          { field: 'manufacturer', labelKey: 'app.kuaizhizao.toolLedger.import.manufacturer', aliases: ['制造商'] },
          { field: 'supplier', labelKey: 'app.kuaizhizao.toolLedger.import.supplier', aliases: ['供应商'] },
          { field: 'purchase_date', labelKey: 'app.kuaizhizao.toolLedger.import.purchaseDate', aliases: ['采购日期'] },
          { field: 'warranty_expiry', labelKey: 'app.kuaizhizao.toolLedger.import.warrantyExpiry', aliases: ['保修到期日'] },
          {
            field: 'status',
            required: true,
            labelKey: 'app.kuaizhizao.toolLedger.import.status',
            aliases: ['工装状态', '状态'],
            options: toolDictOptions.TOOL_STATUS,
          },
          { field: 'maintenance_period', labelKey: 'app.kuaizhizao.toolLedger.import.maintenancePeriod', aliases: ['保养周期（天）', '保养周期'] },
          { field: 'calibration_period', labelKey: 'app.kuaizhizao.toolLedger.import.calibrationPeriod', aliases: ['校验周期（天）', '校验周期'] },
          { field: 'description', labelKey: 'app.kuaizhizao.toolLedger.import.description', aliases: ['备注', '描述'] },
          {
            field: 'is_active',
            labelKey: 'app.kuaizhizao.toolLedger.import.isActive',
            aliases: ['是否启用', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.kuaizhizao.toolLedger.importExample.code'),
          t('app.kuaizhizao.toolLedger.importExample.name'),
          pickImportExampleValue(toolDictOptions.TOOL_TYPE, t('app.kuaizhizao.toolLedger.importExample.type')),
          t('app.kuaizhizao.toolLedger.importExample.specification'),
          t('app.kuaizhizao.toolLedger.importExample.manufacturer'),
          t('app.kuaizhizao.toolLedger.importExample.supplier'),
          t('app.kuaizhizao.toolLedger.importExample.purchaseDate'),
          t('app.kuaizhizao.toolLedger.importExample.warrantyExpiry'),
          pickImportExampleValue(toolDictOptions.TOOL_STATUS, t('app.kuaizhizao.toolLedger.importExample.status')),
          t('app.kuaizhizao.toolLedger.importExample.maintenancePeriod'),
          t('app.kuaizhizao.toolLedger.importExample.calibrationPeriod'),
          '',
          pickImportExampleValue(
            [...IMPORT_YES_NO_OPTIONS],
            t('app.kuaizhizao.toolLedger.importExample.isActive'),
          ),
        ],
      ),
    [t, i18n.language, toolDictOptions],
  );
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toolDetail, setToolDetail] = useState<Tool | null>(null);

  const [toolTrackingRefreshKey, setToolTrackingRefreshKey] = useState(0);

  const toolTracking = useDocumentTracking(
    drawerVisible && toolDetail?.id ? 'tool' : undefined,
    toolDetail?.id,
    toolTrackingRefreshKey,
  );

  const [maintenances, setMaintenances] = useState<ToolMaintenance[]>([]);
  const [calibrations, setCalibrations] = useState<ToolCalibration[]>([]);
  const [maintLoading, setMaintLoading] = useState(false);
  const [calibLoading, setCalibLoading] = useState(false);

  const [maintenanceSchemeOptions, setMaintenanceSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [repairSchemeOptions, setRepairSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [boundMaintenanceSchemeIds, setBoundMaintenanceSchemeIds] = useState<number[]>([]);
  const [boundRepairSchemeIds, setBoundRepairSchemeIds] = useState<number[]>([]);
  const [schemeBindingsSaving, setSchemeBindingsSaving] = useState(false);

  const loadMaintenances = async (toolId: number) => {
    setMaintLoading(true);
    try {
      const res = await maintenancesApi.list({ tool_id: toolId, limit: 100 });
      setMaintenances(res.items || []);
    } catch {
      setMaintenances([]);
    } finally {
      setMaintLoading(false);
    }
  };

  const loadSchemeOptions = async () => {
    const [maintRes, repairRes] = await Promise.all([
      maintenanceSchemesApi.list({ limit: 1000, is_active: true }),
      repairSchemesApi.list({ limit: 1000, is_active: true }),
    ]);
    setMaintenanceSchemeOptions(
      (maintRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
        label: `${s.code} - ${s.name}`,
        value: s.id,
      })),
    );
    setRepairSchemeOptions(
      (repairRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
        label: `${s.code} - ${s.name}`,
        value: s.id,
      })),
    );
  };

  const loadSchemeBindings = async (toolId: number) => {
    const [maintBindings, repairBindings] = await Promise.all([
      schemeBindingsApi.list({ tool_id: toolId, scheme_type: 'maintenance' }),
      schemeBindingsApi.list({ tool_id: toolId, scheme_type: 'repair' }),
    ]);
    setBoundMaintenanceSchemeIds(
      (Array.isArray(maintBindings) ? maintBindings : maintBindings.items ?? []).map(
        (b: { scheme_id: number }) => b.scheme_id,
      ),
    );
    setBoundRepairSchemeIds(
      (Array.isArray(repairBindings) ? repairBindings : repairBindings.items ?? []).map(
        (b: { scheme_id: number }) => b.scheme_id,
      ),
    );
  };

  const loadCalibrations = async (toolId: number) => {
    setCalibLoading(true);
    try {
      const res = await calibrationsApi.list({ tool_id: toolId, limit: 100 });
      setCalibrations(res.items || []);
    } catch {
      setCalibrations([]);
    } finally {
      setCalibLoading(false);
    }
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentTool(null);
    setFormInitialValues(undefined);
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.toolLedger.create')),
    [t],
  );

  const handleEdit = async (record: Tool) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.toolLedger.uuidNotFound'));
        return;
      }
      const detail = await toolApi.get(record.uuid);
      setIsEdit(true);
      setCurrentTool(detail);
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        spec: detail.spec,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
        warranty_expiry: detail.warranty_expiry ? dayjs(detail.warranty_expiry) : null,
        status: detail.status,
        is_active: detail.is_active,
        maintenance_period: detail.maintenance_period,
        needs_calibration: detail.needs_calibration,
        calibration_period: detail.calibration_period,
        description: detail.description,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.toolLedger.getDetailFailed'));
    }
  };

  const handleDetail = useCallback(async (record: Tool) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaizhizao.toolLedger.uuidNotFound'));
      return;
    }
    setDrawerVisible(true);
    setDetailLoading(true);
    setToolDetail(null);
    try {
      const detail = await toolApi.get(record.uuid);
      setToolDetail(detail);
      if (detail.id != null) {
        loadMaintenances(detail.id);
        loadCalibrations(detail.id);
        void loadSchemeOptions();
        void loadSchemeBindings(detail.id);
      }
      setToolTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.toolLedger.getDetailFailed'));
      setDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);



  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('app.kuaizhizao.toolLedger.confirmBatchDeleteTitle'),
      content: t('app.kuaizhizao.toolLedger.confirmBatchDeleteContent', { count: keys.length }),
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await toolApi.delete(String(uuid));
          }
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          if (toolDetail?.uuid && keys.map(String).includes(String(toolDetail.uuid))) {
            setDrawerVisible(false);
            setToolDetail(null);
            setMaintenances([]);
            setCalibrations([]);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        purchase_date: toApiDateString(values.purchase_date) ?? null,
        warranty_expiry: toApiDateString(values.warranty_expiry) ?? null,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      const editedUuid = isEdit ? currentTool?.uuid : undefined;
      if (isEdit && editedUuid) {
        await toolApi.update(editedUuid, data);
        messageApi.success(t('app.kuaizhizao.toolLedger.updateSuccess'));
      } else {
        await toolApi.create(data);
        messageApi.success(t('app.kuaizhizao.toolLedger.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
      if (editedUuid && toolDetail?.uuid === editedUuid) {
        try {
          const fresh = await toolApi.get(editedUuid);
          setToolDetail(fresh);
          loadCalibrations(editedUuid);
          loadMaintenances(editedUuid);
          setToolTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<Tool>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolLedger.colCode'),
        dataIndex: 'code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolLedger.colName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.toolLedger.colType'), dataIndex: 'type' },
      { title: t('app.kuaizhizao.toolLedger.colSpec'), dataIndex: 'spec' },
      { title: t('app.kuaizhizao.toolLedger.colManufacturer'), dataIndex: 'manufacturer' },
      { title: t('app.kuaizhizao.toolLedger.colSupplier'), dataIndex: 'supplier' },
      { title: t('app.kuaizhizao.toolLedger.colPurchaseDate'), dataIndex: 'purchase_date', valueType: 'date' },
      { title: t('app.kuaizhizao.toolLedger.colWarrantyExpiry'), dataIndex: 'warranty_expiry', valueType: 'date' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, record) => {
          const statusKey = String(record.status ?? '');
          const statusMap: Record<string, { text: string; color: string }> = {
            正常: { text: t('app.kuaizhizao.toolLedger.statusNormal'), color: 'success' },
            领用中: { text: t('app.kuaizhizao.toolLedger.statusCheckedOut'), color: 'processing' },
            维修中: { text: t('app.kuaizhizao.toolLedger.statusRepairing'), color: 'warning' },
            校验中: { text: t('app.kuaizhizao.toolLedger.statusCalibrating'), color: 'warning' },
            停用: { text: t('app.kuaizhizao.toolLedger.statusDisabled'), color: 'default' },
            报废: { text: t('app.kuaizhizao.toolLedger.statusScrapped'), color: 'error' },
          };
          const config = statusMap[statusKey] || { text: statusKey || '-', color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.toolLedger.colTotalUsageCount'), dataIndex: 'total_usage_count' },
      { title: t('app.kuaizhizao.toolLedger.fieldDescription'), dataIndex: 'description' },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const toolStatusValueEnum = useMemo(
    () => ({
      正常: { text: t('app.kuaizhizao.toolLedger.statusNormal') },
      领用中: { text: t('app.kuaizhizao.toolLedger.statusCheckedOut') },
      维修中: { text: t('app.kuaizhizao.toolLedger.statusRepairing') },
      校验中: { text: t('app.kuaizhizao.toolLedger.statusCalibrating') },
      停用: { text: t('app.kuaizhizao.toolLedger.statusDisabled') },
      报废: { text: t('app.kuaizhizao.toolLedger.statusScrapped') },
    }),
    [t],
  );

  const columns: ProColumns<Tool>[] = useMemo(() => alignProColumns<Tool>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.toolLedger.fieldIsActive'),
      dataIndex: 'is_active',
      valueType: 'select',
      valueEnum: activeStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: toolStatusValueEnum,
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.toolLedger.colType'),
      dataIndex: 'type',
      hideInTable: true,
      search: { order: 22 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.toolLedger.colCode'),
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 30 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.toolLedger.colName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.toolLedger.colType'),
      dataIndex: 'type',
      width: 100,
      sorter: true,
      hideInSearch: true,
    },
    { title: t('app.kuaizhizao.toolLedger.colSpec'), dataIndex: 'spec', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: t('app.kuaizhizao.toolLedger.colTotalUsageCount'),
      dataIndex: 'total_usage_count',
      width: 110,
      sorter: true,
      hideInSearch: true,
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderEquipmentMasterRowActions({
          record,
          t,
          canRead: perms.canRead,
          canUpdate: perms.canUpdate,
          canDelete: perms.canDelete,
          onDetail: (row) => {
            void handleDetail(row);
          },
          onEdit: (row) => {
            void handleEdit(row);
          },
          onDelete: (row) => {
            if (row.uuid != null) {
              void handleDelete([row.uuid]);
            }
          },
        }),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
  [t, activeStatusValueEnum, toolStatusValueEnum, perms, handleDetail],
  );

  const maintenanceTableColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.maintenance.col.documentNo'), dataIndex: 'document_no', width: 140 },
      {
        title: t('app.kuaizhizao.toolOps.maintenance.col.maintenanceDate'),
        dataIndex: 'maintenance_date',
        width: 110,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.toolOps.maintenance.col.status'),
        dataIndex: 'status',
        width: 90,
        render: (v: string) => (v ? renderDocumentStatusTag(v, v) : '-'),
      },
      { title: t('app.kuaizhizao.toolOps.maintenance.col.executor'), dataIndex: 'applicant_name', width: 90 },
    ],
    [t],
  );

  const calibrationTableColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolLedger.colCalibrationDate'),
        dataIndex: 'calibration_date',
        width: 110,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      { title: t('app.kuaizhizao.toolLedger.colCalibrationOrg'), dataIndex: 'calibration_org', width: 120 },
      { title: t('app.kuaizhizao.toolLedger.colCertificateNo'), dataIndex: 'certificate_no', width: 120 },
      { title: t('app.kuaizhizao.toolLedger.colResult'), dataIndex: 'result', width: 80 },
      {
        title: t('app.kuaizhizao.toolLedger.colExpiryDate'),
        dataIndex: 'expiry_date',
        width: 110,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<Tool>
          headerTitle={t('app.kuaizhizao.toolLedger.title')}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-ledger"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveLedgerListParams(searchFormValues, sort);
              const response = await toolApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              return {
                data: data as Tool[],
                success: true,
                total,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.toolLedger.getListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={perms.canDelete}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          showCreateButton={perms.canCreate}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('app.kuaizhizao.toolLedger.importEmpty'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              toolLedgerImportTemplate.importHeaderMap,
            );
            if (headerIndexMap.name === undefined) {
              messageApi.error(t('app.kuaizhizao.toolLedger.importHeaderMissingName'));
              return;
            }
            const cellAt = (row: any[], field: string): string => {
              const idx = headerIndexMap[field];
              if (idx === undefined) return '';
              return String(row[idx] ?? '').trim();
            };
            const parseDate = (raw: string): string | undefined => {
              if (!raw) return undefined;
              const d = dayjs(raw);
              return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
            };
            const parseIntField = (raw: string): number | undefined => {
              if (!raw) return undefined;
              const n = Number(raw);
              return Number.isFinite(n) ? n : undefined;
            };
            const parseActive = (raw: string): boolean | undefined => {
              if (!raw) return undefined;
              const v = raw.toLowerCase();
              if (['1', 'true', 'yes', 'y', '是', '启用', 'active'].includes(v)) return true;
              if (['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(v)) return false;
              return undefined;
            };
            const items: any[] = [];
            const importRows = data.slice(2).filter((row: any[]) =>
              row?.some((c: any) => c != null && String(c).trim() !== ''),
            );
            for (const row of importRows) {
              const name = cellAt(row, 'name');
              if (!name) continue;
              const isActive = parseActive(cellAt(row, 'is_active'));
              items.push({
                code: cellAt(row, 'code') || undefined,
                name,
                type: parseToolDict('TOOL_TYPE', cellAt(row, 'type')) || undefined,
                spec: cellAt(row, 'spec') || undefined,
                manufacturer: cellAt(row, 'manufacturer') || undefined,
                supplier: cellAt(row, 'supplier') || undefined,
                purchase_date: parseDate(cellAt(row, 'purchase_date')),
                warranty_expiry: parseDate(cellAt(row, 'warranty_expiry')),
                status: parseToolDict('TOOL_STATUS', cellAt(row, 'status')) || '正常',
                maintenance_period: parseIntField(cellAt(row, 'maintenance_period')),
                calibration_period: parseIntField(cellAt(row, 'calibration_period')),
                description: cellAt(row, 'description') || undefined,
                ...(isActive === undefined ? {} : { is_active: isActive }),
              });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaizhizao.toolLedger.importNoRows'));
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => toolApi.create(item),
              title: t('app.kuaizhizao.toolLedger.importTitle'),
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(t('app.kuaizhizao.toolLedger.importSuccess', { count: result.successCount }));
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(t('app.kuaizhizao.toolLedger.importPartialFail', { count: result.failureCount }));
            }
          }}
          importHeaders={toolLedgerImportTemplate.importHeaders}
          importExampleRow={toolLedgerImportTemplate.importExampleRow}
          importColumnOptions={toolLedgerImportTemplate.importColumnOptions}
          importFieldMap={toolLedgerImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items: any[] =
                type === 'currentPage' && pageData?.length
                  ? pageData
                  : await fetchAllListItems((p) => toolApi.list(p));
              if (type === 'selected' && keys?.length) {
                items = items.filter((d: any) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const exportColumns = [
                { key: 'code', title: t('app.kuaizhizao.toolLedger.import.code') },
                { key: 'name', title: t('app.kuaizhizao.toolLedger.import.name') },
                { key: 'type', title: t('app.kuaizhizao.toolLedger.import.type') },
                { key: 'spec', title: t('app.kuaizhizao.toolLedger.import.specification') },
                { key: 'manufacturer', title: t('app.kuaizhizao.toolLedger.fieldManufacturer') },
                { key: 'supplier', title: t('app.kuaizhizao.toolLedger.fieldSupplier') },
                { key: 'status', title: t('app.kuaizhizao.toolLedger.fieldStatus') },
                { key: 'purchase_date', title: t('app.kuaizhizao.toolLedger.fieldPurchaseDate') },
                { key: 'is_active', title: t('app.kuaizhizao.toolLedger.fieldIsActive') },
              ];
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `tools-${new Date().toISOString().slice(0, 10)}.xlsx`,
                { columns: exportColumns, sheetName: t('app.kuaizhizao.toolLedger.title') },
              );
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.toolLedger.edit') : t('app.kuaizhizao.toolLedger.create')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentTool(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-equipment-management-tool"
              name="code"
              label={t('app.kuaizhizao.toolLedger.fieldCode')}
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('app.kuaizhizao.toolLedger.fieldName')}
              placeholder={t('app.kuaizhizao.toolLedger.phName')}
              rules={[{ required: true, message: t('app.kuaizhizao.toolLedger.ruleNameRequired') }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="TOOL_TYPE"
              name="type"
              label={t('app.kuaizhizao.toolLedger.fieldType')}
              placeholder={t('common.selectField', { field: t('app.kuaizhizao.toolLedger.fieldType') })}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="spec" label={t('app.kuaizhizao.toolLedger.fieldSpec')} placeholder={t('app.kuaizhizao.toolLedger.phSpec')} />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label={t('app.kuaizhizao.toolLedger.fieldManufacturer')} placeholder={t('app.kuaizhizao.toolLedger.phManufacturer')} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t('app.kuaizhizao.toolLedger.fieldSupplier')} placeholder={t('app.kuaizhizao.toolLedger.phSupplier')} />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label={t('app.kuaizhizao.toolLedger.fieldPurchaseDate')}
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="warranty_expiry"
              label={t('app.kuaizhizao.toolLedger.fieldWarrantyExpiry')}
              formItemProps={formDateFormItemProps}
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => formRef.current,
                fieldName: 'warranty_expiry',
                baseFieldName: 'purchase_date',
                t,
                fieldProps: { style: { width: '100%' } },
              })}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="TOOL_STATUS"
              name="status"
              label={t('app.kuaizhizao.toolLedger.fieldStatus')}
              placeholder={t('app.kuaizhizao.toolLedger.phStatus')}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="maintenance_period" label={t('app.kuaizhizao.toolLedger.fieldMaintenancePeriod')} placeholder={t('app.kuaizhizao.toolLedger.phMaintenancePeriod')} />
          </Col>
          <Col span={12}>
            <ProFormDigit name="calibration_period" label={t('app.kuaizhizao.toolLedger.fieldCalibrationPeriod')} placeholder={t('app.kuaizhizao.toolLedger.phCalibrationPeriod')} />
          </Col>
          <Col span={24}>
            <DocumentAttachmentsField category="tool_ledger_attachments" />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="description" label={t('app.kuaizhizao.toolLedger.fieldDescription')} placeholder={t('app.kuaizhizao.toolLedger.phDescription')} fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('app.kuaizhizao.toolLedger.fieldIsActive')} />
          </Col>
        </Row>
      </FormModalTemplate>

      <EquipmentMasterDetailDrawer
        open={drawerVisible}
        loading={detailLoading}
        detail={toolDetail}
        title={t('app.kuaizhizao.toolLedger.detailTitle', { code: toolDetail?.code || '' })}
        onClose={() => {
          setDrawerVisible(false);
          setToolDetail(null);
          setMaintenances([]);
          setCalibrations([]);
        }}
        basicColumns={detailBaseColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(toolDetail && perms.canUpdate), () => {
          if (!toolDetail) return;
          setDrawerVisible(false);
          void handleEdit(toolDetail);
        })}
        lines={
          toolDetail ? (
            <>
              <DetailDrawerSection title={t('app.kuaizhizao.toolOps.schemeBindings.title')}>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary">{t('app.kuaizhizao.toolOps.schemeBindings.maintenance')}</Typography.Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder={t('app.kuaizhizao.toolOps.schemeBindings.selectMaintenanceSchemes')}
                    options={maintenanceSchemeOptions}
                    value={boundMaintenanceSchemeIds}
                    onChange={setBoundMaintenanceSchemeIds}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary">{t('app.kuaizhizao.toolOps.schemeBindings.repair')}</Typography.Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder={t('app.kuaizhizao.toolOps.schemeBindings.selectRepairSchemes')}
                    options={repairSchemeOptions}
                    value={boundRepairSchemeIds}
                    onChange={setBoundRepairSchemeIds}
                  />
                </div>
                {perms.canUpdate && (
                  <Button
                    type="primary"
                    loading={schemeBindingsSaving}
                    disabled={toolDetail.id == null}
                    onClick={async () => {
                      if (toolDetail.id == null) return;
                      setSchemeBindingsSaving(true);
                      try {
                        await schemeBindingsApi.bulkReplace({
                          tool_id: toolDetail.id,
                          scheme_type: 'maintenance',
                          scheme_ids: boundMaintenanceSchemeIds,
                        });
                        await schemeBindingsApi.bulkReplace({
                          tool_id: toolDetail.id,
                          scheme_type: 'repair',
                          scheme_ids: boundRepairSchemeIds,
                        });
                        messageApi.success(t('app.kuaizhizao.toolOps.schemeBindings.saveSuccess'));
                      } catch (error: unknown) {
                        const err = error as { message?: string };
                        messageApi.error(err?.message || t('common.operationFailed'));
                      } finally {
                        setSchemeBindingsSaving(false);
                      }
                    }}
                  >
                    {t('common.save')}
                  </Button>
                )}
              </DetailDrawerSection>
              <Tabs
                items={[
                  {
                    key: 'maintenances',
                    label: t('app.kuaizhizao.toolLedger.sectionMaintenances'),
                    children: (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <Link to="/apps/kuaizhizao/equipment-management/tool-maintenances">
                            <Button type="primary" size="small" icon={<PlusOutlined />}>
                              {t('app.kuaizhizao.toolMaintenanceReminder.createMaintenance')}
                            </Button>
                          </Link>
                        </div>
                        <Table<ToolMaintenance>
                          size="small"
                          loading={maintLoading}
                          dataSource={maintenances}
                          rowKey="uuid"
                          pagination={false}
                          columns={maintenanceTableColumns}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'calibrations',
                    label: t('app.kuaizhizao.toolLedger.sectionCalibrations'),
                    children: (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <Link to="/apps/kuaizhizao/equipment-management/tool-calibrations">
                            <Button type="primary" size="small" icon={<PlusOutlined />}>
                              {t('app.kuaizhizao.toolMaintenanceReminder.createCalibration')}
                            </Button>
                          </Link>
                        </div>
                        <Table<ToolCalibration>
                          size="small"
                          loading={calibLoading}
                          dataSource={calibrations}
                          rowKey="uuid"
                          pagination={false}
                          columns={calibrationTableColumns}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'ops',
                    label: t('app.kuaizhizao.toolOps.opsLinks.title'),
                    children: (
                      <Space wrap>
                        <Link to="/apps/kuaizhizao/equipment-management/tool-borrows">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.tool-borrows')}</Button>
                        </Link>
                        <Link to="/apps/kuaizhizao/equipment-management/tool-maintenances">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.tool-maintenances')}</Button>
                        </Link>
                        <Link to="/apps/kuaizhizao/equipment-management/tool-repairs">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.tool-repairs')}</Button>
                        </Link>
                        <Link to="/apps/kuaizhizao/equipment-management/tool-scrap-applications">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.tool-scrap-applications')}</Button>
                        </Link>
                      </Space>
                    ),
                  },
                  {
                    key: 'tracking_timeline',
                    label: t('app.uniDetail.sectionTimeline'),
                    children: (
                      <>
                        {toolTracking.loading && (
                          <div style={{ textAlign: 'center', padding: 24 }}>
                            <Spin />
                          </div>
                        )}
                        {toolTracking.error && !toolTracking.loading && (
                          <Typography.Text type="danger">{toolTracking.error}</Typography.Text>
                        )}
                        {toolTracking.data && !toolTracking.loading && (
                          <DocumentTrackingTimelineBody data={toolTracking.data} />
                        )}
                        {!toolTracking.loading && !toolTracking.data && !toolTracking.error && (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.toolLedger.noTimeline')} />
                        )}
                      </>
                    ),
                  },
                ]}
              />
            </>
          ) : undefined
        }
      />


    </>
  );
};

export default ToolLedgerPage;
