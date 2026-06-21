import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
/**
 * 设备管理页面
 *
 * 提供设备的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持设备基础信息管理、序列号管理、关联工作中心等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormSwitch,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Modal,
  Tabs,
  Table,
  Form,
  Input,
  DatePicker,
  Select,
  Row,
  Col,
  Descriptions,
  Typography,
  Empty,
  Spin,
  Upload,
  theme as AntdTheme,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadMultipleFiles } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getEquipmentAssetLifecycle } from '../../../utils/equipmentLifecycle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { equipmentApi } from '../../../services/equipment';
import { workshopApi } from '../../../../master-data/services/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { formatDateTime } from '../../../../../utils/format';

const EQUIPMENT_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_equipment';

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
      content = (col.render as (dom: React.ReactNode, entity: T, i: number) => React.ReactNode)(
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

function renderEquipmentRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

interface Equipment {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: any;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  work_center_id?: number;
  work_center_code?: string;
  work_center_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  lifecycle?: { main_stages?: Array<unknown> };
}

const EquipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const equipmentImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.equipment.import.code', aliases: ['设备编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.equipment.import.name', aliases: ['设备名称', '名称'] },
          { field: 'type', labelKey: 'app.kuaizhizao.equipment.import.type', aliases: ['设备类型', '类型'] },
          { field: 'category', labelKey: 'app.kuaizhizao.equipment.import.category', aliases: ['设备分类', '分类'] },
          { field: 'brand', labelKey: 'app.kuaizhizao.equipment.import.brand', aliases: ['品牌'] },
          { field: 'model', labelKey: 'app.kuaizhizao.equipment.import.model', aliases: ['型号'] },
        ],
        [
          t('app.kuaizhizao.equipment.importExample.code'),
          t('app.kuaizhizao.equipment.importExample.name'),
          t('app.kuaizhizao.equipment.importExample.type'),
          t('app.kuaizhizao.equipment.importExample.category'),
          t('app.kuaizhizao.equipment.importExample.brand'),
          t('app.kuaizhizao.equipment.importExample.model'),
        ],
      ),
    [t, i18n.language],
  );
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const equipmentDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑设备）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Equipment | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [equipmentDetail, setEquipmentDetail] = useState<Equipment | null>(null);

  const [eqTrackingRefreshKey, setEqTrackingRefreshKey] = useState(0);

  const equipmentTracking = useDocumentTracking(
    drawerVisible && equipmentDetail?.id ? 'equipment' : undefined,
    equipmentDetail?.id,
    eqTrackingRefreshKey,
  );

  // 追溯相关状态
  const [traceVisible, setTraceVisible] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);

  // 校验记录 Modal
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  const {
    customFields: equipmentFormCustomFields,
    customFieldValues: equipmentFormCustomFieldValues,
    loadFieldValues: loadEquipmentFormFieldValues,
    extractFormValues: extractEquipmentFormValues,
    saveCustomFieldValues: saveEquipmentCustomFieldValues,
    resetFieldValues: resetEquipmentFormFieldValues,
  } = useCustomFields({ tableName: EQUIPMENT_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: equipmentListCustomFields,
    generateCustomFieldColumns: generateEquipmentCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichEquipmentRecordsWithCustomFields,
    customFieldValues: equipmentDetailCustomFieldValues,
    loadFieldValuesForDetail: loadEquipmentFieldValuesForDetail,
    resetDetailFieldValues: resetEquipmentDetailFieldValues,
  } = useCustomFieldsForList<Equipment>({ tableName: EQUIPMENT_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (equipmentListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [equipmentListCustomFields.length]);

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentEquipment(null);
    setFormInitialValues(undefined);
    resetEquipmentFormFieldValues();
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.equipment.create')),
    [t],
  );

  /**
   * 处理编辑设备
   */
  const handleEdit = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.equipment.uuidNotFound'));
        return;
      }
      const detail = await equipmentApi.get(record.uuid);
      setIsEdit(true);
      setCurrentEquipment(detail);
      const fieldFormValues =
        detail.id != null ? await loadEquipmentFormFieldValues(detail.id) : {};
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        category: detail.category,
        brand: detail.brand,
        model: detail.model,
        serial_number: detail.serial_number,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
        installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
        warranty_period: detail.warranty_period,
        workstation_id: detail.workstation_id,
        work_center_id: detail.work_center_id,
        status: detail.status,
        is_active: detail.is_active,
        description: detail.description,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        ...fieldFormValues,
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.equipment.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.equipment.uuidNotFound'));
        return;
      }
      const detail = await equipmentApi.get(record.uuid);
      setEquipmentDetail(detail);
      setDrawerVisible(true);
      setEqTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadEquipmentFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.equipment.getDetailFailed'));
    }
  };

  /**
   * 处理批量删除设备（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('app.kuaizhizao.equipment.confirmBatchDeleteTitle'),
      content: t('app.kuaizhizao.equipment.confirmBatchDeleteContent', { count: keys.length }),
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await equipmentApi.delete(String(uuid));
          }
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          if (equipmentDetail?.uuid && keys.map(String).includes(String(equipmentDetail.uuid))) {
            setDrawerVisible(false);
            setEquipmentDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理查看设备追溯
   */
  const handleTrace = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.equipment.uuidNotFound'));
        return;
      }
      const data = await equipmentApi.getTrace(record.uuid);
      setTraceData(data);
      setTraceVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.equipment.getTraceFailed'));
    }
  };

  const handleCreateCalibration = () => {
    calibForm.resetFields();
    calibForm.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      const equipmentUuid = traceData?.equipment?.uuid;
      if (!equipmentUuid) return;
      const data = {
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      await equipmentApi.createCalibration(equipmentUuid, data);
      messageApi.success(t('app.kuaizhizao.equipment.calibrationSaved'));
      setCalibModalVisible(false);
      const refreshed = await equipmentApi.getTrace(equipmentUuid);
      setTraceData(refreshed);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.saveFailed'));
    }
  };

  useSubmitShortcut(handleSubmitCalibration, calibModalVisible);

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractEquipmentFormValues(values);
      const submitData = {
        ...standardValues,
        purchase_date: standardValues.purchase_date ? standardValues.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: standardValues.installation_date ? standardValues.installation_date.format('YYYY-MM-DD') : null,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
      };

      const editedUuid = isEdit ? currentEquipment?.uuid : undefined;
      if (isEdit && editedUuid) {
        await equipmentApi.update(editedUuid, submitData);
        messageApi.success(t('app.kuaizhizao.equipment.updateSuccess'));
        const updated = await equipmentApi.get(editedUuid);
        if (updated.id != null) {
          await saveEquipmentCustomFieldValues(updated.id, customData);
        }
      } else {
        const created = await equipmentApi.create(submitData);
        if (created?.id != null) {
          await saveEquipmentCustomFieldValues(created.id, customData);
        }
        messageApi.success(t('app.kuaizhizao.equipment.createSuccess'));
      }
      setModalVisible(false);
      setCurrentEquipment(null);
      formRef.current?.resetFields();
      resetEquipmentFormFieldValues();
      actionRef.current?.reload();
      if (editedUuid && equipmentDetail?.uuid === editedUuid) {
        try {
          const fresh = await equipmentApi.get(editedUuid);
          setEquipmentDetail(fresh);
          setEqTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<Equipment>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.equipment.colCode'),
      dataIndex: 'code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.equipment.colName'),
      dataIndex: 'name',
    },
    {
      title: t('app.kuaizhizao.equipment.colType'),
      dataIndex: 'type',
    },
    {
      title: t('app.kuaizhizao.equipment.colCategory'),
      dataIndex: 'category',
    },
    {
      title: t('app.kuaizhizao.equipment.colBrand'),
      dataIndex: 'brand',
    },
    {
      title: t('app.kuaizhizao.equipment.colModel'),
      dataIndex: 'model',
    },
    {
      title: t('app.kuaizhizao.equipment.colSerialNumber'),
      dataIndex: 'serial_number',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.serial_number ?? '') }}>{r.serial_number ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.equipment.colManufacturer'),
      dataIndex: 'manufacturer',
    },
    {
      title: t('app.kuaizhizao.equipment.colSupplier'),
      dataIndex: 'supplier',
    },
    {
      title: t('app.kuaizhizao.equipment.colPurchaseDate'),
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.equipment.colInstallationDate'),
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.equipment.colWarrantyPeriod'),
      dataIndex: 'warranty_period',
    },
    {
      title: t('app.kuaizhizao.equipment.colWorkstation'),
      dataIndex: 'workstation_name',
    },
    {
      title: t('app.kuaizhizao.equipment.colWorkCenter'),
      dataIndex: 'work_center_name',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const statusMap: Record<string, { text: string; color: string }> = {
          正常: { text: t('app.kuaizhizao.equipment.statusNormal'), color: 'success' },
          维修中: { text: t('app.kuaizhizao.equipment.statusRepairing'), color: 'warning' },
          停用: { text: t('app.kuaizhizao.equipment.statusDisabled'), color: 'default' },
          报废: { text: t('app.kuaizhizao.equipment.statusScrapped'), color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.equipment.colIsActive'),
      dataIndex: 'is_active',
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('app.kuaizhizao.equipment.isActiveEnabled') : t('app.kuaizhizao.equipment.isActiveDisabled')}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.equipment.fieldDescription'),
      dataIndex: 'description',
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
    [t]
  );

  const renderEquipmentRowNodes = (record: Equipment): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
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
      <Button {...rowActionKind('delete')}
        key="del"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          Modal.confirm({
            title: t('app.kuaizhizao.equipment.confirmDeleteTitle'),
            content: t('app.kuaizhizao.equipment.confirmDeleteContent', { name: record.name }),
            onOk: () => record.uuid && handleDelete([record.uuid]),
          });
        }}
      >
        {t('common.delete')}
      </Button>,
      <Button {...rowActionKind('read')}
        key="trace"
        type="link"
        size="small"
        icon={<HistoryOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleTrace(record);
        }}
      >
        {t('app.kuaizhizao.equipment.trace')}
      </Button>,
    ];
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Equipment>[] = useMemo(() => {
    const customFieldColumns = generateEquipmentCustomFieldColumns();
    return [
    {
      title: t('app.kuaizhizao.equipment.colCode'),
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
    {
      title: t('app.kuaizhizao.equipment.colName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colType'),
      dataIndex: 'type',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.equipment.colCategory'),
      dataIndex: 'category',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.equipment.colBrand'),
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: t('app.kuaizhizao.equipment.colModel'),
      dataIndex: 'model',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.equipment.colSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.serial_number ?? '') }} ellipsis>
          {r.serial_number ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.equipment.colWorkCenter'),
      dataIndex: 'work_center_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    ...customFieldColumns,
    {
      title: t('app.kuaizhizao.equipment.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getEquipmentAssetLifecycle(record as Record<string, unknown>);
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
      key: 'action',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderEquipmentRowActions(renderEquipmentRowNodes(record), `eq-${record.uuid ?? 'row'}`),
    },
  ];
  }, [equipmentListCustomFields, generateEquipmentCustomFieldColumns, t]);

  const calibrationResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.equipment.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.equipment.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.equipment.resultRestricted'), value: '限制使用' },
    ],
    [t],
  );

  const traceMaintenancePlanColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColPlanNo'), dataIndex: 'plan_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColPlanName'), dataIndex: 'plan_name', width: 200 },
      { title: t('app.kuaizhizao.equipment.traceColPlanType'), dataIndex: 'plan_type', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColMaintenanceType'), dataIndex: 'maintenance_type', width: 120 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: (status: string) => <Tag>{status}</Tag> },
      { title: t('app.kuaizhizao.equipment.traceColPlannedStartDate'), dataIndex: 'planned_start_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColPlannedEndDate'), dataIndex: 'planned_end_date', width: 120 },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceMaintenanceExecutionColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColExecutionNo'), dataIndex: 'execution_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColExecutionDate'), dataIndex: 'execution_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColExecutor'), dataIndex: 'executor_name', width: 100 },
      { title: t('app.kuaizhizao.equipment.traceColExecutionResult'), dataIndex: 'execution_result', width: 120 },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: (status: string) => <Tag>{status}</Tag> },
      { title: t('app.kuaizhizao.equipment.traceColMaintenanceCost'), dataIndex: 'maintenance_cost', width: 100, render: (cost: number) => cost ? `¥${cost}` : '-' },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceFaultColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColFaultNo'), dataIndex: 'fault_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColFaultDate'), dataIndex: 'fault_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColFaultType'), dataIndex: 'fault_type', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColFaultLevel'), dataIndex: 'fault_level', width: 100, render: (level: string) => <Tag>{level}</Tag> },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: (status: string) => <Tag>{status}</Tag> },
      { title: t('app.kuaizhizao.equipment.traceColRepairRequired'), dataIndex: 'repair_required', width: 100, render: (required: boolean) => <Tag color={required ? 'warning' : 'success'}>{required ? t('app.kuaizhizao.equipment.yes') : t('app.kuaizhizao.equipment.no')}</Tag> },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceRepairColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColRepairNo'), dataIndex: 'repair_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColRepairDate'), dataIndex: 'repair_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRepairType'), dataIndex: 'repair_type', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRepairer'), dataIndex: 'repairer_name', width: 100 },
      { title: t('app.kuaizhizao.equipment.traceColRepairDuration'), dataIndex: 'repair_duration', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRepairCost'), dataIndex: 'repair_cost', width: 100, render: (cost: number) => cost ? `¥${cost}` : '-' },
      { title: t('common.status'), dataIndex: 'status', width: 100, render: (status: string) => <Tag>{status}</Tag> },
      { title: t('app.kuaizhizao.equipment.traceColRepairResult'), dataIndex: 'repair_result', width: 120 },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceCalibrationColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.traceColCalibrationDate'), dataIndex: 'calibration_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColResult'), dataIndex: 'result', width: 100, render: (r: string) => <Tag>{r}</Tag> },
      { title: t('app.kuaizhizao.equipment.traceColCertificateNo'), dataIndex: 'certificate_no', width: 140 },
      { title: t('app.kuaizhizao.equipment.traceColExpiryDate'), dataIndex: 'expiry_date', width: 120 },
      { title: t('app.kuaizhizao.equipment.traceColRemark'), dataIndex: 'remark', ellipsis: true },
      { title: t('common.createdAt'), dataIndex: 'created_at', width: 160 },
    ],
    [t],
  );

  const traceTabItems = useMemo(() => {
    if (!traceData) return [];
    return [
      {
        key: 'maintenance_plans',
        label: t('app.kuaizhizao.equipment.tabMaintenancePlans', { count: traceData.maintenance_plans?.length || 0 }),
        children: (
          <Table
            dataSource={traceData.maintenance_plans || []}
            columns={traceMaintenancePlanColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
          />
        ),
      },
      {
        key: 'maintenance_executions',
        label: t('app.kuaizhizao.equipment.tabMaintenanceExecutions', { count: traceData.maintenance_executions?.length || 0 }),
        children: (
          <Table
            dataSource={traceData.maintenance_executions || []}
            columns={traceMaintenanceExecutionColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
          />
        ),
      },
      {
        key: 'equipment_faults',
        label: t('app.kuaizhizao.equipment.tabFaults', { count: traceData.equipment_faults?.length || 0 }),
        children: (
          <Table
            dataSource={traceData.equipment_faults || []}
            columns={traceFaultColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
          />
        ),
      },
      {
        key: 'equipment_repairs',
        label: t('app.kuaizhizao.equipment.tabRepairs', { count: traceData.equipment_repairs?.length || 0 }),
        children: (
          <Table
            dataSource={traceData.equipment_repairs || []}
            columns={traceRepairColumns}
            rowKey="uuid"
            pagination={false}
            size="small"
          />
        ),
      },
      {
        key: 'equipment_calibrations',
        label: t('app.kuaizhizao.equipment.tabCalibrations', { count: traceData.equipment_calibrations?.length || 0 }),
        children: (
          <>
            <div style={{ marginBottom: 12 }}>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateCalibration}>
                {t('app.kuaizhizao.equipment.createCalibration')}
              </Button>
            </div>
            <Table
              dataSource={traceData.equipment_calibrations || []}
              columns={traceCalibrationColumns}
              rowKey="uuid"
              pagination={false}
              size="small"
            />
          </>
        ),
      },
    ];
  }, [traceData, t, traceMaintenancePlanColumns, traceMaintenanceExecutionColumns, traceFaultColumns, traceRepairColumns, traceCalibrationColumns]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Equipment>
          headerTitle={t('app.kuaizhizao.equipment.title')}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await equipmentApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              const enriched = await enrichEquipmentRecordsWithCustomFields(response.items || []);
              return {
                data: enriched,
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.equipment.getListFailed'));
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
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('app.kuaizhizao.equipment.importEmpty'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              equipmentImportTemplate.importHeaderMap,
            );
            if (headerIndexMap.name === undefined) {
              messageApi.error(t('app.kuaizhizao.equipment.importHeaderMissingName'));
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
                category:
                  headerIndexMap.category !== undefined
                    ? String(row[headerIndexMap.category] ?? '').trim() || undefined
                    : undefined,
                brand:
                  headerIndexMap.brand !== undefined
                    ? String(row[headerIndexMap.brand] ?? '').trim() || undefined
                    : undefined,
                model:
                  headerIndexMap.model !== undefined
                    ? String(row[headerIndexMap.model] ?? '').trim() || undefined
                    : undefined,
              });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaizhizao.equipment.importNoRows'));
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => equipmentApi.create(item),
              title: t('app.kuaizhizao.equipment.importTitle'),
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(t('app.kuaizhizao.equipment.importSuccess', { count: result.successCount }));
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(t('app.kuaizhizao.equipment.importPartialFail', { count: result.failureCount }));
            }
          }}
          importHeaders={equipmentImportTemplate.importHeaders}
          importExampleRow={equipmentImportTemplate.importExampleRow}
          importFieldMap={equipmentImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await equipmentApi.list({ skip: 0, limit: 10000 });
              let items = (res as any)?.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: Equipment) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `equipment-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          scroll={{ x: 2000 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑设备 Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.equipment.edit') : t('app.kuaizhizao.equipment.create')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentEquipment(null);
          resetEquipmentFormFieldValues();
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
              pageCode="kuaizhizao-equipment-management-equipment"
              name="code"
              label={t('app.kuaizhizao.equipment.fieldCode')}
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('app.kuaizhizao.equipment.fieldName')}
              placeholder={t('app.kuaizhizao.equipment.phName')}
              rules={[{ required: true, message: t('app.kuaizhizao.equipment.ruleNameRequired') }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="EQUIPMENT_TYPE"
              name="type"
              label={t('app.kuaizhizao.equipment.fieldType')}
              placeholder={t('common.selectField', { field: t('app.kuaizhizao.equipment.fieldType') })}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="category"
              label={t('app.kuaizhizao.equipment.fieldCategory')}
              placeholder={t('app.kuaizhizao.equipment.phCategory')}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label={t('app.kuaizhizao.equipment.fieldBrand')} placeholder={t('app.kuaizhizao.equipment.phBrand')} />
          </Col>
          <Col span={12}>
            <ProFormText name="model" label={t('app.kuaizhizao.equipment.fieldModel')} placeholder={t('app.kuaizhizao.equipment.phModel')} />
          </Col>
          <Col span={12}>
            <ProFormText name="serial_number" label={t('app.kuaizhizao.equipment.fieldSerialNumber')} placeholder={t('app.kuaizhizao.equipment.phSerialNumber')} />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label={t('app.kuaizhizao.equipment.fieldManufacturer')} placeholder={t('app.kuaizhizao.equipment.phManufacturer')} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t('app.kuaizhizao.equipment.fieldSupplier')} placeholder={t('app.kuaizhizao.equipment.phSupplier')} />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label={t('app.kuaizhizao.equipment.fieldPurchaseDate')}
              placeholder={t('app.kuaizhizao.equipment.phPurchaseDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label={t('app.kuaizhizao.equipment.fieldInstallationDate')}
              placeholder={t('app.kuaizhizao.equipment.phInstallationDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="warranty_period"
              label={t('app.kuaizhizao.equipment.fieldWarrantyPeriod')}
              placeholder={t('app.kuaizhizao.equipment.phWarrantyPeriod')}
              min={0}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="workstation_id"
              label={t('app.kuaizhizao.equipment.fieldWorkstation')}
              placeholder={t('app.kuaizhizao.equipment.phWorkstation')}
              request={async () => {
                try {
                  await workshopApi.list({ limit: 1000 });
                  return [];
                } catch (error) {
                  return [];
                }
              }}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="work_center_id"
              label={t('app.kuaizhizao.equipment.fieldWorkCenter')}
              placeholder={t('app.kuaizhizao.equipment.phWorkCenter')}
              request={async () => {
                try {
                  return [];
                } catch (error) {
                  return [];
                }
              }}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="EQUIPMENT_STATUS"
              name="status"
              label={t('app.kuaizhizao.equipment.fieldStatus')}
              placeholder={t('app.kuaizhizao.equipment.phStatus')}
              required={true}
              rules={[{ required: true, message: t('app.kuaizhizao.equipment.ruleStatusRequired') }]}
              formRef={formRef}
            />
          </Col>
          <CustomFieldsFormSection
            customFields={equipmentFormCustomFields}
            customFieldValues={equipmentFormCustomFieldValues}
            gridColumns={2}
            embedInParentRow
          />
          <Col span={24}>
            <DocumentAttachmentsField category="equipment_attachments" />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label={t('app.kuaizhizao.equipment.fieldDescription')}
              placeholder={t('app.kuaizhizao.equipment.phDescription')}
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('app.kuaizhizao.equipment.fieldIsActive')} />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 设备详情 Drawer */}
      <DetailDrawerTemplate
        title={t('app.kuaizhizao.equipment.detail')}
        open={drawerVisible}
        zIndex={equipmentDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setEquipmentDetail(null);
          resetEquipmentDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={equipmentDetail || undefined}
        customContent={
          equipmentDetail ? (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(equipmentDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>
              {hasCustomFieldsDetailContent(equipmentListCustomFields, equipmentDetailCustomFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields')}>
                  <CustomFieldsDetailSection
                    customFields={equipmentListCustomFields}
                    customFieldValues={equipmentDetailCustomFieldValues}
                  />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getEquipmentAssetLifecycle(equipmentDetail as Record<string, unknown>);
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
                  {equipmentDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="equipment"
                      documentId={equipmentDetail.id}
                      active={drawerVisible}
                      selfDocumentId={equipmentDetail.id}
                      renderBriefActions={(doc) => (
                        <EquipmentTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDrawerVisible(false);
                            setEquipmentDetail(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.equipment.noDetailLines')} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                {equipmentTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {equipmentTracking.error && !equipmentTracking.loading && (
                  <Typography.Text type="danger">{equipmentTracking.error}</Typography.Text>
                )}
                {equipmentTracking.data && !equipmentTracking.loading && (
                  <DocumentTrackingTimelineBody data={equipmentTracking.data} />
                )}
                {!equipmentTracking.loading && !equipmentTracking.data && !equipmentTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.equipment.noTimeline')} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 设备追溯 Modal */}
      <Modal
        title={t('app.kuaizhizao.equipment.traceTitle', { name: traceData?.equipment?.name || '' })}
        open={traceVisible}
        onCancel={() => {
          setTraceVisible(false);
          setTraceData(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        footer={[
          <Button {...rowActionKind('close')} key="close" onClick={() => {
            setTraceVisible(false);
            setTraceData(null);
          }}>
            {t('common.close')}
          </Button>,
        ]}
      >
        {traceData && (
          <Tabs
            defaultActiveKey="maintenance_plans"
            items={traceTabItems}
          />
        )}
      </Modal>

      <Modal title={t('app.kuaizhizao.equipment.createCalibration')} open={calibModalVisible} onOk={handleSubmitCalibration} okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT} onCancel={() => setCalibModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="calibration_date" label={t('app.kuaizhizao.equipment.calibrationDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('app.kuaizhizao.equipment.calibrationResult')} rules={[{ required: true }]}>
            <Select options={calibrationResultOptions} />
          </Form.Item>
          <Form.Item name="certificate_no" label={t('app.kuaizhizao.equipment.certificateNo')}>
            <Input placeholder={t('app.kuaizhizao.equipment.phCertificateNo')} />
          </Form.Item>
          <Form.Item name="expiry_date" label={t('app.kuaizhizao.equipment.expiryDate')}>
            <FutureDatePicker
              getForm={() => calibForm}
              baseFieldName="calibration_date"
              t={t}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.equipment.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'equipment_calibration_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.equipment.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('app.kuaizhizao.equipment.traceColRemark')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.equipment.phRemark')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default EquipmentPage;

