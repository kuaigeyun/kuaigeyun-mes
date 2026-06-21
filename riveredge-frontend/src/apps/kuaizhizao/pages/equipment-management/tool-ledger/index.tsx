import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工装台账页面
 *
 * 提供工装的 CRUD 功能，包括列表展示、创建、编辑等操作。
 * 详情抽屉包含领用记录、维保记录、校验记录 Tab。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
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
import { App, Button, Tag, Table, Form, Input, InputNumber, Descriptions, DatePicker, Select, Modal, Row, Col, Typography, Empty, Spin, theme as AntdTheme, Upload } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadMultipleFiles } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { getToolAssetLifecycle } from '../../../utils/equipmentLifecycle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { toolApi } from '../../../services/equipment';
import { batchImport } from '../../../../../utils/batchOperations';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime } from '../../../../../utils/format';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

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

interface ToolUsage {
  uuid?: string;
  usage_no?: string;
  operator_name?: string;
  source_type?: string;
  source_no?: string;
  checkout_date?: string;
  checkin_date?: string;
  status?: string;
}

interface ToolMaintenance {
  uuid?: string;
  maintenance_type?: string;
  maintenance_date?: string;
  executor?: string;
  content?: string;
  result?: string;
}

interface ToolCalibration {
  uuid?: string;
  calibration_date?: string;
  calibration_org?: string;
  certificate_no?: string;
  result?: string;
  expiry_date?: string;
}

const ToolLedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toolLedgerImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.toolLedger.import.code', aliases: ['工装编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.toolLedger.import.name', aliases: ['工装名称', '名称'] },
          { field: 'type', labelKey: 'app.kuaizhizao.toolLedger.import.type', aliases: ['工装类型', '类型'] },
          { field: 'spec', labelKey: 'app.kuaizhizao.toolLedger.import.specification', aliases: ['规格型号', '规格'] },
        ],
        [
          t('app.kuaizhizao.toolLedger.importExample.code'),
          t('app.kuaizhizao.toolLedger.importExample.name'),
          t('app.kuaizhizao.toolLedger.importExample.type'),
          t('app.kuaizhizao.toolLedger.importExample.specification'),
        ],
      ),
    [t, i18n.language],
  );
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const toolDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [toolDetail, setToolDetail] = useState<Tool | null>(null);

  const [toolTrackingRefreshKey, setToolTrackingRefreshKey] = useState(0);

  const toolTracking = useDocumentTracking(
    drawerVisible && toolDetail?.id ? 'tool' : undefined,
    toolDetail?.id,
    toolTrackingRefreshKey,
  );

  const [usages, setUsages] = useState<ToolUsage[]>([]);
  const [maintenances, setMaintenances] = useState<ToolMaintenance[]>([]);
  const [calibrations, setCalibrations] = useState<ToolCalibration[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [maintLoading, setMaintLoading] = useState(false);
  const [calibLoading, setCalibLoading] = useState(false);

  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [maintModalVisible, setMaintModalVisible] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [usageForm] = Form.useForm();
  const [maintForm] = Form.useForm();
  const [calibForm] = Form.useForm();

  const loadUsages = async (toolUuid: string) => {
    setUsagesLoading(true);
    try {
      const res = await toolApi.listUsages(toolUuid, { limit: 100 });
      setUsages(res.items || []);
    } catch {
      setUsages([]);
    } finally {
      setUsagesLoading(false);
    }
  };
  const loadMaintenances = async (toolUuid: string) => {
    setMaintLoading(true);
    try {
      const res = await toolApi.listMaintenances(toolUuid, { limit: 100 });
      setMaintenances(res.items || []);
    } catch {
      setMaintenances([]);
    } finally {
      setMaintLoading(false);
    }
  };
  const loadCalibrations = async (toolUuid: string) => {
    setCalibLoading(true);
    try {
      const res = await toolApi.listCalibrations(toolUuid, { limit: 100 });
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

  const handleDetail = async (record: Tool) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.toolLedger.uuidNotFound'));
        return;
      }
      const detail = await toolApi.get(record.uuid);
      setToolDetail(detail);
      setDrawerVisible(true);
      loadUsages(record.uuid);
      loadMaintenances(record.uuid);
      loadCalibrations(record.uuid);
      setToolTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.toolLedger.getDetailFailed'));
    }
  };

  const handleCheckout = () => {
    if (!toolDetail?.uuid) return;
    usageForm.resetFields();
    usageForm.setFieldsValue({ tool_uuid: toolDetail.uuid });
    setUsageModalVisible(true);
  };
  const handleSubmitCheckout = async () => {
    try {
      const values = await usageForm.validateFields();
      await toolApi.checkout({
        ...values,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.toolLedger.checkoutSuccess'));
      setUsageModalVisible(false);
      if (toolDetail?.uuid) {
        loadUsages(toolDetail.uuid);
        const detail = await toolApi.get(toolDetail.uuid);
        setToolDetail(detail);
        setToolTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('app.kuaizhizao.toolLedger.checkoutFailed'));
    }
  };

  const handleCheckin = async (usageUuid: string) => {
    try {
      await toolApi.checkin(usageUuid);
      messageApi.success(t('app.kuaizhizao.toolLedger.checkinSuccess'));
      if (toolDetail?.uuid) {
        loadUsages(toolDetail.uuid);
        const detail = await toolApi.get(toolDetail.uuid);
        setToolDetail(detail);
        setToolTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.toolLedger.checkinFailed'));
    }
  };

  const handleRecordMaintenance = () => {
    if (!toolDetail?.uuid) return;
    maintForm.resetFields();
    maintForm.setFieldsValue({ tool_uuid: toolDetail.uuid, maintenance_date: dayjs() });
    setMaintModalVisible(true);
  };
  const handleSubmitMaintenance = async () => {
    try {
      const values = await maintForm.validateFields();
      const data = {
        ...values,
        maintenance_date: values.maintenance_date?.format?.('YYYY-MM-DD') || values.maintenance_date,
        cost: values.cost ?? 0,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      await toolApi.recordMaintenance(data);
      messageApi.success(t('app.kuaizhizao.toolLedger.maintenanceSaved'));
      setMaintModalVisible(false);
      if (toolDetail?.uuid) {
        loadMaintenances(toolDetail.uuid);
        setToolTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.saveFailed'));
    }
  };

  const handleRecordCalibration = () => {
    if (!toolDetail?.uuid) return;
    calibForm.resetFields();
    calibForm.setFieldsValue({ tool_uuid: toolDetail.uuid, calibration_date: dayjs() });
    setCalibModalVisible(true);
  };
  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      const data = {
        ...values,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      await toolApi.recordCalibration(data);
      messageApi.success(t('app.kuaizhizao.toolLedger.calibrationSaved'));
      setCalibModalVisible(false);
      if (toolDetail?.uuid) {
        loadCalibrations(toolDetail.uuid);
        const detail = await toolApi.get(toolDetail.uuid);
        setToolDetail(detail);
        setToolTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.saveFailed'));
    }
  };

  useSubmitShortcut(
    usageModalVisible ? handleSubmitCheckout : maintModalVisible ? handleSubmitMaintenance : calibModalVisible ? handleSubmitCalibration : undefined,
    usageModalVisible || maintModalVisible || calibModalVisible,
  );

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        purchase_date: values.purchase_date?.format?.('YYYY-MM-DD') || values.purchase_date,
        warranty_expiry: values.warranty_expiry?.format?.('YYYY-MM-DD') || values.warranty_expiry,
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
          loadUsages(editedUuid);
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

  const columns: ProColumns<Tool>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.toolLedger.colCode'),
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.toolLedger.colName'), dataIndex: 'name', width: 200, ellipsis: true },
    { title: t('app.kuaizhizao.toolLedger.colType'), dataIndex: 'type', width: 100 },
    { title: t('app.kuaizhizao.toolLedger.colSpec'), dataIndex: 'spec', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.toolLedger.colTotalUsageCount'), dataIndex: 'total_usage_count', width: 110 },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.toolLedger.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getToolAssetLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
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
      ],
    },
  ],
  [t],
  );

  const toolSourceTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolLedger.sourceWorkOrder'), value: 'work_order' },
      { label: t('app.kuaizhizao.toolLedger.sourceProductionOrder'), value: 'production_order' },
      { label: t('app.kuaizhizao.toolLedger.sourceOther'), value: 'other' },
    ],
    [t],
  );

  const toolMaintenanceTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolLedger.maintenanceTypeDaily'), value: '日常保养' },
      { label: t('app.kuaizhizao.toolLedger.maintenanceTypePeriodic'), value: '定期保养' },
      { label: t('app.kuaizhizao.toolLedger.maintenanceTypeRepair'), value: '故障维修' },
    ],
    [t],
  );

  const toolMaintenanceResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolLedger.maintenanceResultDone'), value: '完成' },
      { label: t('app.kuaizhizao.toolLedger.maintenanceResultPending'), value: '未完成' },
    ],
    [t],
  );

  const toolCalibrationResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolLedger.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.toolLedger.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.toolLedger.resultApproved'), value: '准用' },
    ],
    [t],
  );

  const usageTableColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolLedger.colUsageNo'), dataIndex: 'usage_no', width: 140 },
      { title: t('app.kuaizhizao.toolLedger.colSourceType'), dataIndex: 'source_type', width: 100 },
      { title: t('app.kuaizhizao.toolLedger.colSourceNo'), dataIndex: 'source_no', width: 120 },
      { title: t('app.kuaizhizao.toolLedger.colOperator'), dataIndex: 'operator_name', width: 90 },
      {
        title: t('app.kuaizhizao.toolLedger.colCheckoutDate'),
        dataIndex: 'checkout_date',
        width: 160,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: t('app.kuaizhizao.toolLedger.colCheckinDate'),
        dataIndex: 'checkin_date',
        width: 160,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (s: string) => <Tag>{s || '-'}</Tag>,
      },
      {
        title: t('common.actions'),
        width: 80,
        render: (_: unknown, record: ToolUsage) =>
          record.status === '使用中' ? (
            <Button type="link" size="small" onClick={() => handleCheckin(record.uuid!)}>
              {t('app.kuaizhizao.toolLedger.checkin')}
            </Button>
          ) : null,
      },
    ],
    [t],
  );

  const maintenanceTableColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolLedger.colMaintenanceType'), dataIndex: 'maintenance_type', width: 100 },
      {
        title: t('app.kuaizhizao.toolLedger.colMaintenanceDate'),
        dataIndex: 'maintenance_date',
        width: 110,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      { title: t('app.kuaizhizao.toolLedger.colExecutor'), dataIndex: 'executor', width: 90 },
      { title: t('app.kuaizhizao.toolLedger.colContent'), dataIndex: 'content', ellipsis: true },
      { title: t('app.kuaizhizao.toolLedger.colResult'), dataIndex: 'result', width: 80 },
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
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          request={async (params) => {
            try {
              const response = await toolApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.toolLedger.getListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
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
                    setUsages([]);
                    setMaintenances([]);
                    setCalibrations([]);
                  }
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || t('common.deleteFailed'));
                }
              },
            });
          }}
          showCreateButton
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
            const items: any[] = [];
            const importRows = data.slice(2).filter((row: any[]) =>
              row?.some((c: any) => c != null && String(c).trim() !== ''),
            );
            for (const row of importRows) {
              const name = String(row[headerIndexMap.name] ?? '').trim();
              if (!name) continue;
              items.push({
                code:
                  headerIndexMap.code !== undefined
                    ? String(row[headerIndexMap.code] ?? '').trim() || undefined
                    : undefined,
                name,
                type:
                  headerIndexMap.type !== undefined
                    ? String(row[headerIndexMap.type] ?? '').trim() || undefined
                    : undefined,
                spec:
                  headerIndexMap.spec !== undefined
                    ? String(row[headerIndexMap.spec] ?? '').trim() || undefined
                    : undefined,
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
          importFieldMap={toolLedgerImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await toolApi.list({ skip: 0, limit: 10000 });
              let items = (res as any)?.items || (res as any)?.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: any) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tools-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          scroll={{ x: 1800 }}
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
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="warranty_expiry"
              label={t('app.kuaizhizao.toolLedger.fieldWarrantyExpiry')}
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

      <DetailDrawerTemplate
        open={drawerVisible}
        zIndex={toolDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setToolDetail(null);
          setUsages([]);
          setMaintenances([]);
          setCalibrations([]);
        }}
        title={t('app.kuaizhizao.toolLedger.detailTitle', { code: toolDetail?.code || '' })}
        columns={[]}
        column={2}
        width={DRAWER_CONFIG.HALF_WIDTH}
        customContent={
          toolDetail ? (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={2}
                  size="small"
                  items={buildDescriptionItemsFromColumns(toolDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getToolAssetLifecycle(toolDetail as Record<string, unknown>);
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
                  {toolDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='tool'
                      documentId={toolDetail.id}
                      active={drawerVisible}
                      selfDocumentId={toolDetail.id}
                      renderBriefActions={(doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setToolDetail(null);
                      setUsages([]);
                      setMaintenances([]);
                      setCalibrations([]);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong>{t('app.kuaizhizao.toolLedger.sectionUsages')}</Typography.Text>
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCheckout}>
                        {t('app.kuaizhizao.toolLedger.createCheckout')}
                      </Button>
                    </div>
                    <Table<ToolUsage>
                      size="small"
                      loading={usagesLoading}
                      dataSource={usages}
                      rowKey="uuid"
                      pagination={false}
                      tableLayout="fixed"
                      style={{ minWidth: 1100 }}
                      columns={usageTableColumns}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong>{t('app.kuaizhizao.toolLedger.sectionMaintenances')}</Typography.Text>
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleRecordMaintenance}>
                        {t('app.kuaizhizao.toolLedger.createMaintenance')}
                      </Button>
                    </div>
                    <Table<ToolMaintenance>
                      size="small"
                      loading={maintLoading}
                      dataSource={maintenances}
                      rowKey="uuid"
                      pagination={false}
                      tableLayout="fixed"
                      style={{ minWidth: 900 }}
                      columns={maintenanceTableColumns}
                    />
                  </div>
                  <div>
                    <Typography.Text strong>{t('app.kuaizhizao.toolLedger.sectionCalibrations')}</Typography.Text>
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleRecordCalibration}>
                        {t('app.kuaizhizao.toolLedger.createCalibration')}
                      </Button>
                    </div>
                    <Table<ToolCalibration>
                      size="small"
                      loading={calibLoading}
                      dataSource={calibrations}
                      rowKey="uuid"
                      pagination={false}
                      tableLayout="fixed"
                      style={{ minWidth: 900 }}
                      columns={calibrationTableColumns}
                    />
                  </div>
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
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
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      <Modal title={t('app.kuaizhizao.toolLedger.createCheckout')} open={usageModalVisible} onOk={handleSubmitCheckout} okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT} onCancel={() => setUsageModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={usageForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tool_uuid" hidden><Input /></Form.Item>
          <Form.Item name="operator_name" label={t('app.kuaizhizao.toolLedger.checkoutOperator')}><Input placeholder={t('app.kuaizhizao.toolLedger.phCheckoutOperator')} /></Form.Item>
          <Form.Item name="department_name" label={t('app.kuaizhizao.toolLedger.checkoutDepartment')}><Input placeholder={t('app.kuaizhizao.toolLedger.phCheckoutDepartment')} /></Form.Item>
          <Form.Item name="source_type" label={t('app.kuaizhizao.toolLedger.colSourceType')}>
            <Select placeholder={t('app.kuaizhizao.toolLedger.phSelect')} allowClear options={toolSourceTypeOptions} />
          </Form.Item>
          <Form.Item name="source_no" label={t('app.kuaizhizao.toolLedger.colSourceNo')}><Input placeholder={t('app.kuaizhizao.toolLedger.phSourceNo')} /></Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.toolLedger.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'tool_usage_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.toolLedger.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('app.kuaizhizao.toolLedger.remark')}><Input.TextArea rows={2} placeholder={t('app.kuaizhizao.toolLedger.phRemark')} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('app.kuaizhizao.toolLedger.createMaintenance')} open={maintModalVisible} onOk={handleSubmitMaintenance} okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT} onCancel={() => setMaintModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={maintForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tool_uuid" hidden><Input /></Form.Item>
          <Form.Item name="maintenance_type" label={t('app.kuaizhizao.toolLedger.colMaintenanceType')} rules={[{ required: true }]}>
            <Select options={toolMaintenanceTypeOptions} />
          </Form.Item>
          <Form.Item name="maintenance_date" label={t('app.kuaizhizao.toolLedger.colMaintenanceDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="executor" label={t('app.kuaizhizao.toolLedger.colExecutor')}><Input placeholder={t('app.kuaizhizao.toolLedger.phExecutor')} /></Form.Item>
          <Form.Item name="content" label={t('app.kuaizhizao.toolLedger.colContent')}><Input.TextArea rows={2} placeholder={t('app.kuaizhizao.toolLedger.phMaintenanceContent')} /></Form.Item>
          <Form.Item name="result" label={t('app.kuaizhizao.toolLedger.colResult')}>
            <Select options={toolMaintenanceResultOptions} />
          </Form.Item>
          <Form.Item name="cost" label={t('app.kuaizhizao.toolLedger.cost')} initialValue={0}><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.toolLedger.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'tool_maintenance_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.toolLedger.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('app.kuaizhizao.toolLedger.remark')}><Input.TextArea rows={2} placeholder={t('app.kuaizhizao.toolLedger.phRemark')} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('app.kuaizhizao.toolLedger.createCalibration')} open={calibModalVisible} onOk={handleSubmitCalibration} okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT} onCancel={() => setCalibModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tool_uuid" hidden><Input /></Form.Item>
          <Form.Item name="calibration_date" label={t('app.kuaizhizao.toolLedger.colCalibrationDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="calibration_org" label={t('app.kuaizhizao.toolLedger.colCalibrationOrg')}><Input placeholder={t('app.kuaizhizao.toolLedger.phCalibrationOrg')} /></Form.Item>
          <Form.Item name="certificate_no" label={t('app.kuaizhizao.toolLedger.colCertificateNo')}><Input placeholder={t('app.kuaizhizao.toolLedger.phCertificateNo')} /></Form.Item>
          <Form.Item name="result" label={t('app.kuaizhizao.toolLedger.colResult')} rules={[{ required: true }]}>
            <Select options={toolCalibrationResultOptions} />
          </Form.Item>
          <Form.Item name="expiry_date" label={t('app.kuaizhizao.toolLedger.colExpiryDate')}>
            <FutureDatePicker
              getForm={() => calibForm}
              baseFieldName="calibration_date"
              t={t}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.toolLedger.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'tool_calibration_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.toolLedger.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('app.kuaizhizao.toolLedger.remark')}><Input.TextArea rows={2} placeholder={t('app.kuaizhizao.toolLedger.phRemark')} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ToolLedgerPage;
