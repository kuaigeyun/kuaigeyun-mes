/**
 * 模具管理页面
 *
 * 提供模具的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持模具信息、模具使用、模具维护、模具追溯等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Tag, Space, message, Modal, Tabs, Table, Form, Input, InputNumber, Descriptions, DatePicker, Select, Row, Col, Typography, Spin, theme as AntdTheme, Empty, Upload } from 'antd';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getMoldAssetLifecycle } from '../../../utils/equipmentLifecycle';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadMultipleFiles } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';
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
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { formatDateTime } from '../../../../../utils/format';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const MOLD_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_molds';

interface Mold {
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
  status?: string;
  is_active?: boolean;
  description?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  total_usage_count?: number;
  cavity_count?: number;
  design_lifetime?: number;
  maintenance_interval?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface MoldUsage {
  uuid?: string;
  usage_no?: string;
  source_type?: string;
  source_no?: string;
  usage_date?: string;
  usage_count?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
}

interface MoldCalibration {
  uuid?: string;
  mold_uuid?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
}

const MoldsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const moldImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.mold.import.code', aliases: ['模具编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.mold.import.name', aliases: ['模具名称', '名称'] },
          { field: 'type', labelKey: 'app.kuaizhizao.mold.import.type', aliases: ['模具类型', '类型'] },
          { field: 'category', labelKey: 'app.kuaizhizao.mold.import.category', aliases: ['模具分类', '分类'] },
          { field: 'brand', labelKey: 'app.kuaizhizao.mold.import.brand', aliases: ['品牌'] },
          { field: 'model', labelKey: 'app.kuaizhizao.mold.import.model', aliases: ['型号'] },
        ],
        [
          t('app.kuaizhizao.mold.importExample.code'),
          t('app.kuaizhizao.mold.importExample.name'),
          t('app.kuaizhizao.mold.importExample.type'),
          t('app.kuaizhizao.mold.importExample.category'),
          t('app.kuaizhizao.mold.importExample.brand'),
          t('app.kuaizhizao.mold.importExample.model'),
        ],
      ),
    [t, i18n.language],
  );
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const moldDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑模具）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMold, setCurrentMold] = useState<Mold | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [moldDetail, setMoldDetail] = useState<Mold | null>(null);

  const [moldTrackingRefreshKey, setMoldTrackingRefreshKey] = useState(0);

  const moldTracking = useDocumentTracking(
    drawerVisible && moldDetail?.id ? 'mold' : undefined,
    moldDetail?.id,
    moldTrackingRefreshKey,
  );

  // 使用记录相关状态
  const [usages, setUsages] = useState<MoldUsage[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [usageForm] = Form.useForm();

  // 校验记录相关状态
  const [calibrations, setCalibrations] = useState<MoldCalibration[]>([]);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  const {
    customFields: moldFormCustomFields,
    customFieldValues: moldFormCustomFieldValues,
    loadFieldValues: loadMoldFormFieldValues,
    extractFormValues: extractMoldFormValues,
    saveCustomFieldValues: saveMoldCustomFieldValues,
    resetFieldValues: resetMoldFormFieldValues,
  } = useCustomFields({ tableName: MOLD_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: moldListCustomFields,
    generateCustomFieldColumns: generateMoldCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichMoldRecordsWithCustomFields,
    customFieldValues: moldDetailCustomFieldValues,
    loadFieldValuesForDetail: loadMoldFieldValuesForDetail,
    resetDetailFieldValues: resetMoldDetailFieldValues,
  } = useCustomFieldsForList<Mold>({ tableName: MOLD_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (moldListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [moldListCustomFields.length]);

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMold(null);
    setFormInitialValues(undefined);
    resetMoldFormFieldValues();
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.mold.create')),
    [t],
  );

  /**
   * 处理编辑模具
   */
  const handleEdit = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.mold.uuidNotFound'));
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setIsEdit(true);
      setCurrentMold(detail);
      const fieldFormValues =
        detail.id != null ? await loadMoldFormFieldValues(detail.id) : {};
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
        status: detail.status,
        is_active: detail.is_active,
        cavity_count: detail.cavity_count,
        design_lifetime: detail.design_lifetime,
        description: detail.description,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        ...fieldFormValues,
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.mold.getDetailFailed'));
    }
  };

  /**
   * 加载模具使用记录
   */
  const loadUsages = async (moldUuid: string) => {
    setUsagesLoading(true);
    try {
      const res = await moldApi.listUsages({ mold_uuid: moldUuid, limit: 100 });
      setUsages(res.items || []);
    } catch {
      setUsages([]);
    } finally {
      setUsagesLoading(false);
    }
  };

  /**
   * 加载模具校验记录
   */
  const loadCalibrations = async (moldUuid: string) => {
    setCalibLoading(true);
    try {
      const res = await moldApi.listCalibrations({ mold_uuid: moldUuid, limit: 100 });
      setCalibrations(res.items || []);
    } catch {
      setCalibrations([]);
    } finally {
      setCalibLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaizhizao.mold.uuidNotFound'));
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setMoldDetail(detail);
      setDrawerVisible(true);
      loadUsages(record.uuid);
      loadCalibrations(record.uuid);
      setMoldTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadMoldFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.mold.getDetailFailed'));
    }
  };

  /**
   * 新建使用记录
   */
  const handleCreateUsage = () => {
    if (!moldDetail?.uuid) return;
    usageForm.resetFields();
    usageForm.setFieldsValue({
      mold_uuid: moldDetail.uuid,
      usage_date: dayjs(),
      usage_count: 1,
      status: '使用中',
    });
    setUsageModalVisible(true);
  };

  /**
   * 新建校验记录
   */
  const handleRecordCalibration = () => {
    if (!moldDetail?.uuid) return;
    calibForm.resetFields();
    calibForm.setFieldsValue({ mold_uuid: moldDetail.uuid, calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  /**
   * 提交校验记录
   */
  const handleSubmitCalibration = async () => {
    try {
      const moldUuid = moldDetail?.uuid;
      if (!moldUuid) {
        messageApi.error(t('app.kuaizhizao.mold.noMoldSelected'));
        return;
      }
      const values = await calibForm.validateFields();
      const data = {
        mold_uuid: moldUuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      await moldApi.createCalibration(data);
      messageApi.success(t('app.kuaizhizao.mold.calibrationSaved'));
      setCalibModalVisible(false);
      if (moldDetail?.uuid) {
        loadCalibrations(moldDetail.uuid);
        const detail = await moldApi.get(moldDetail.uuid);
        setMoldDetail(detail);
        setMoldTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.saveFailed'));
    }
  };

  /**
   * 提交使用记录
   */
  const handleSubmitUsage = async () => {
    try {
      const values = await usageForm.validateFields();
      const data = {
        mold_uuid: moldDetail!.uuid,
        source_type: values.source_type,
        source_no: values.source_no,
        usage_date: values.usage_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.usage_date,
        usage_count: values.usage_count ?? 1,
        operator_name: values.operator_name,
        status: values.status || '使用中',
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      await moldApi.createUsage(data);
      messageApi.success(t('app.kuaizhizao.mold.usageCreated'));
      setUsageModalVisible(false);
      if (moldDetail?.uuid) {
        loadUsages(moldDetail.uuid);
        setMoldTrackingRefreshKey((k) => k + 1);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('app.kuaizhizao.mold.createFailed'));
    }
  };

  /**
   * 处理批量删除模具（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('app.kuaizhizao.mold.confirmBatchDeleteTitle'),
      content: t('app.kuaizhizao.mold.confirmBatchDeleteContent', { count: keys.length }),
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await moldApi.delete(String(uuid));
          }
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          if (moldDetail?.uuid && keys.map(String).includes(String(moldDetail.uuid))) {
            setDrawerVisible(false);
            setMoldDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractMoldFormValues(values);
      const submitData = {
        ...standardValues,
        purchase_date: standardValues.purchase_date ? standardValues.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: standardValues.installation_date ? standardValues.installation_date.format('YYYY-MM-DD') : null,
        cavity_count: standardValues.cavity_count ?? null,
        design_lifetime: standardValues.design_lifetime ?? null,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
      };

      const editedUuid = isEdit ? currentMold?.uuid : undefined;
      if (isEdit && editedUuid) {
        await moldApi.update(editedUuid, submitData);
        messageApi.success(t('app.kuaizhizao.mold.updateSuccess'));
        const updated = await moldApi.get(editedUuid);
        if (updated?.id != null) {
          await saveMoldCustomFieldValues(updated.id, customData);
        }
      } else {
        const created = await moldApi.create(submitData);
        if (created?.id != null) {
          await saveMoldCustomFieldValues(created.id, customData);
        }
        messageApi.success(t('app.kuaizhizao.mold.createSuccess'));
      }
      setModalVisible(false);
      setCurrentMold(null);
      formRef.current?.resetFields();
      resetMoldFormFieldValues();
      actionRef.current?.reload();
      if (editedUuid && moldDetail?.uuid === editedUuid) {
        try {
          const fresh = await moldApi.get(editedUuid);
          setMoldDetail(fresh);
          loadUsages(editedUuid);
          loadCalibrations(editedUuid);
          setMoldTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<Mold>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.mold.colCode'),
      dataIndex: 'code',
    },
    {
      title: t('app.kuaizhizao.mold.colName'),
      dataIndex: 'name',
    },
    {
      title: t('app.kuaizhizao.mold.colType'),
      dataIndex: 'type',
    },
    {
      title: t('app.kuaizhizao.mold.colCategory'),
      dataIndex: 'category',
    },
    {
      title: t('app.kuaizhizao.mold.colBrand'),
      dataIndex: 'brand',
    },
    {
      title: t('app.kuaizhizao.mold.colModel'),
      dataIndex: 'model',
    },
    {
      title: t('app.kuaizhizao.mold.colSerialNumber'),
      dataIndex: 'serial_number',
    },
    {
      title: t('app.kuaizhizao.mold.colManufacturer'),
      dataIndex: 'manufacturer',
    },
    {
      title: t('app.kuaizhizao.mold.colSupplier'),
      dataIndex: 'supplier',
    },
    {
      title: t('app.kuaizhizao.mold.colPurchaseDate'),
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.mold.colInstallationDate'),
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.mold.colWarrantyPeriod'),
      dataIndex: 'warranty_period',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: t('app.kuaizhizao.mold.statusNormal'), color: 'success' },
          '使用中': { text: t('app.kuaizhizao.mold.statusInUse'), color: 'processing' },
          '维护中': { text: t('app.kuaizhizao.mold.statusMaintaining'), color: 'warning' },
          '停用': { text: t('app.kuaizhizao.mold.statusDisabled'), color: 'default' },
          '报废': { text: t('app.kuaizhizao.mold.statusScrapped'), color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.mold.colIsActive'),
      dataIndex: 'is_active',
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('app.kuaizhizao.mold.isActiveEnabled') : t('app.kuaizhizao.mold.isActiveDisabled')}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.mold.colCavityCount'),
      dataIndex: 'cavity_count',
    },
    {
      title: t('app.kuaizhizao.mold.colDesignLifetime'),
      dataIndex: 'design_lifetime',
    },
    {
      title: t('app.kuaizhizao.mold.colTotalUsageCount'),
      dataIndex: 'total_usage_count',
    },
    {
      title: t('app.kuaizhizao.mold.colMaintenanceInterval'),
      dataIndex: 'maintenance_interval',
    },
    {
      title: t('app.kuaizhizao.mold.colNeedsCalibration'),
      dataIndex: 'needs_calibration',
      render: (v) => (v ? t('app.kuaizhizao.mold.yes') : t('app.kuaizhizao.mold.no')),
    },
    {
      title: t('app.kuaizhizao.mold.colCalibrationPeriod'),
      dataIndex: 'calibration_period',
    },
    {
      title: t('app.kuaizhizao.mold.colLastCalibrationDate'),
      dataIndex: 'last_calibration_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.mold.colNextCalibrationDate'),
      dataIndex: 'next_calibration_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.mold.fieldDescription'),
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
  [t],
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<Mold>[] = useMemo(() => {
    const customFieldColumns = generateMoldCustomFieldColumns();
    return [
    {
      title: t('app.kuaizhizao.mold.colCode'),
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
      title: t('app.kuaizhizao.mold.colName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.mold.colType'),
      dataIndex: 'type',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.mold.colCategory'),
      dataIndex: 'category',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.mold.colBrand'),
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: t('app.kuaizhizao.mold.colModel'),
      dataIndex: 'model',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.mold.colSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
    },
    {
      title: t('app.kuaizhizao.mold.colIsActive'),
      dataIndex: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? t('app.kuaizhizao.mold.isActiveEnabled') : t('app.kuaizhizao.mold.isActiveDisabled')}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.mold.colTotalUsageCount'),
      dataIndex: 'total_usage_count',
      width: 110,
    },
    {
      title: t('app.kuaizhizao.mold.colLifeProgress'),
      dataIndex: ['total_usage_count', 'design_lifetime'],
      width: 100,
      render: (_: any, record: Mold) => {
        const total = record.total_usage_count ?? 0;
        const lifetime = record.design_lifetime;
        if (!lifetime || lifetime <= 0) return '-';
        const pct = Math.round((total / lifetime) * 100);
        if (pct >= 100) return <Tag color="error">{pct}%</Tag>;
        if (pct >= 90) return <Tag color="warning">{pct}%</Tag>;
        return `${pct}%`;
      },
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
      title: t('app.kuaizhizao.mold.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMoldAssetLifecycle(record as Record<string, unknown>);
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
      width: 180,
      fixed: 'right',
      render: (_text, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              void handleDetail(record);
            }}
          >
            {t('common.detail')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              void handleEdit(record);
            }}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              Modal.confirm({
                title: t('app.kuaizhizao.mold.confirmDeleteTitle'),
                content: t('app.kuaizhizao.mold.confirmDeleteContent', { name: record.name }),
                onOk: () => record.uuid && handleDelete([record.uuid]),
              });
            }}
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];
  }, [moldListCustomFields, generateMoldCustomFieldColumns, t]);

  const moldSourceTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.mold.sourceWorkOrder'), value: 'work_order' },
      { label: t('app.kuaizhizao.mold.sourceProductionOrder'), value: 'production_order' },
      { label: t('app.kuaizhizao.mold.sourceOther'), value: 'other' },
    ],
    [t],
  );

  const moldUsageStatusOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.mold.usageStatusInUse'), value: '使用中' },
      { label: t('app.kuaizhizao.mold.usageStatusReturned'), value: '已归还' },
      { label: t('app.kuaizhizao.mold.usageStatusScrapped'), value: '已报废' },
    ],
    [t],
  );

  const moldCalibrationResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.mold.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.mold.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.mold.resultApproved'), value: '准用' },
    ],
    [t],
  );

  const usageTableColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.mold.colUsageNo'), dataIndex: 'usage_no', width: 140 },
      { title: t('app.kuaizhizao.mold.colSourceType'), dataIndex: 'source_type', width: 100 },
      { title: t('app.kuaizhizao.mold.colSourceNo'), dataIndex: 'source_no', width: 120 },
      {
        title: t('app.kuaizhizao.mold.colUsageDate'),
        dataIndex: 'usage_date',
        width: 110,
        render: (v: string) => v ? formatDateTime(v, 'YYYY-MM-DD') : '-',
      },
      { title: t('app.kuaizhizao.mold.colUsageCount'), dataIndex: 'usage_count', width: 80 },
      { title: t('app.kuaizhizao.mold.colOperator'), dataIndex: 'operator_name', width: 90 },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (s: string) => <Tag>{s || '-'}</Tag>,
      },
      {
        title: t('app.kuaizhizao.mold.colReturnDate'),
        dataIndex: 'return_date',
        width: 110,
        render: (v: string) => v ? formatDateTime(v, 'YYYY-MM-DD') : '-',
      },
    ],
    [t],
  );

  const calibrationTableColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.mold.colCalibrationDate'),
        dataIndex: 'calibration_date',
        width: 120,
        render: (v: string) => v ? formatDateTime(v, 'YYYY-MM-DD') : '-',
      },
      {
        title: t('app.kuaizhizao.mold.colResult'),
        dataIndex: 'result',
        width: 100,
        render: (r: string) => <Tag>{r || '-'}</Tag>,
      },
      { title: t('app.kuaizhizao.mold.colCertificateNo'), dataIndex: 'certificate_no', width: 140 },
      {
        title: t('app.kuaizhizao.mold.colExpiryDate'),
        dataIndex: 'expiry_date',
        width: 120,
        render: (v: string) => v ? formatDateTime(v, 'YYYY-MM-DD') : '-',
      },
      { title: t('app.kuaizhizao.mold.colRemark'), dataIndex: 'remark', ellipsis: true },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<Mold>
          headerTitle={t('app.kuaizhizao.mold.title')}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.molds"
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
              const response = await moldApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              const enriched = await enrichMoldRecordsWithCustomFields(response.items || []);
              return {
                data: enriched,
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.mold.getListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('app.kuaizhizao.mold.importEmpty'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              moldImportTemplate.importHeaderMap,
            );
            if (headerIndexMap.name === undefined) {
              messageApi.error(t('app.kuaizhizao.mold.importHeaderMissingName'));
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
              messageApi.warning(t('app.kuaizhizao.mold.importNoRows'));
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => moldApi.create(item),
              title: t('app.kuaizhizao.mold.importTitle'),
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(t('app.kuaizhizao.mold.importSuccess', { count: result.successCount }));
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(t('app.kuaizhizao.mold.importPartialFail', { count: result.failureCount }));
            }
          }}
          importHeaders={moldImportTemplate.importHeaders}
          importExampleRow={moldImportTemplate.importExampleRow}
          importFieldMap={moldImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await moldApi.list({ skip: 0, limit: 10000 });
              let items = (res as any)?.items || [];
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
              a.download = `molds-${new Date().toISOString().slice(0, 10)}.json`;
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

      {/* 创建/编辑模具 Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.mold.edit') : t('app.kuaizhizao.mold.create')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentMold(null);
          resetMoldFormFieldValues();
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
              pageCode="kuaizhizao-equipment-management-mold"
              name="code"
              label={t('app.kuaizhizao.mold.fieldCode')}
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('app.kuaizhizao.mold.fieldName')}
              placeholder={t('app.kuaizhizao.mold.phName')}
              rules={[{ required: true, message: t('app.kuaizhizao.mold.ruleNameRequired') }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_TYPE"
              name="type"
              label={t('app.kuaizhizao.mold.fieldType')}
              placeholder={t('common.selectField', { field: t('app.kuaizhizao.mold.fieldType') })}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="category" label={t('app.kuaizhizao.mold.fieldCategory')} placeholder={t('app.kuaizhizao.mold.phCategory')} />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label={t('app.kuaizhizao.mold.fieldBrand')} placeholder={t('app.kuaizhizao.mold.phBrand')} />
          </Col>
          <Col span={12}>
            <ProFormText name="model" label={t('app.kuaizhizao.mold.fieldModel')} placeholder={t('app.kuaizhizao.mold.phModel')} />
          </Col>
          <Col span={12}>
            <ProFormText name="serial_number" label={t('app.kuaizhizao.mold.fieldSerialNumber')} placeholder={t('app.kuaizhizao.mold.phSerialNumber')} />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label={t('app.kuaizhizao.mold.fieldManufacturer')} placeholder={t('app.kuaizhizao.mold.phManufacturer')} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t('app.kuaizhizao.mold.fieldSupplier')} placeholder={t('app.kuaizhizao.mold.phSupplier')} />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label={t('app.kuaizhizao.mold.fieldPurchaseDate')}
              placeholder={t('app.kuaizhizao.mold.phPurchaseDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label={t('app.kuaizhizao.mold.fieldInstallationDate')}
              placeholder={t('app.kuaizhizao.mold.phInstallationDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="warranty_period"
              label={t('app.kuaizhizao.mold.fieldWarrantyPeriod')}
              placeholder={t('app.kuaizhizao.mold.phWarrantyPeriod')}
              min={0}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_STATUS"
              name="status"
              label={t('app.kuaizhizao.mold.fieldStatus')}
              placeholder={t('app.kuaizhizao.mold.phStatus')}
              required={true}
              rules={[{ required: true, message: t('app.kuaizhizao.mold.ruleStatusRequired') }]}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="cavity_count"
              label={t('app.kuaizhizao.mold.fieldCavityCount')}
              placeholder={t('app.kuaizhizao.mold.phCavityCount')}
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="design_lifetime"
              label={t('app.kuaizhizao.mold.fieldDesignLifetime')}
              placeholder={t('app.kuaizhizao.mold.phDesignLifetime')}
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <CustomFieldsFormSection
            customFields={moldFormCustomFields}
            customFieldValues={moldFormCustomFieldValues}
            gridColumns={2}
            embedInParentRow
          />
          <Col span={24}>
            <DocumentAttachmentsField category="mold_attachments" />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label={t('app.kuaizhizao.mold.fieldDescription')}
              placeholder={t('app.kuaizhizao.mold.phDescription')}
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('app.kuaizhizao.mold.fieldIsActive')} />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 模具详情 Drawer */}
      <DetailDrawerTemplate<Mold>
        title={t('app.kuaizhizao.mold.detail')}
        open={drawerVisible}
        zIndex={moldDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setMoldDetail(null);
          setUsages([]);
          setCalibrations([]);
          resetMoldDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={moldDetail}
        columns={detailColumns}
        customContent={
          moldDetail && (
            <>
              {hasCustomFieldsDetailContent(moldListCustomFields, moldDetailCustomFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields')}>
                  <CustomFieldsDetailSection
                    customFields={moldListCustomFields}
                    customFieldValues={moldDetailCustomFieldValues}
                  />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                {moldDetail.id != null ? (
                  <DetailDrawerInlineFullChain
                    documentType="mold"
                    documentId={moldDetail.id}
                    active={drawerVisible}
                    selfDocumentId={moldDetail.id}
                    renderBriefActions={(doc) => (
                      <EquipmentTraceBriefPrimaryActions
                        doc={doc}
                        t={t}
                        navigate={navigate}
                        closeDrawer={() => {
                          setDrawerVisible(false);
                          setMoldDetail(null);
                          setUsages([]);
                          setCalibrations([]);
                        }}
                      />
                    )}
                  />
                ) : null}
              </DetailDrawerSection>
            <Tabs
              defaultActiveKey="basic"
              items={[
                {
                  key: 'basic',
                  label: t('app.uniDetail.sectionBasic'),
                  children: (
                    <>
                      {moldDetail.design_lifetime && moldDetail.design_lifetime > 0 && (() => {
                        const total = moldDetail.total_usage_count ?? 0;
                        const threshold = moldDetail.design_lifetime * 0.9;
                        if (total >= moldDetail.design_lifetime) {
                          return <Tag color="error" style={{ marginBottom: 12 }}>{t('app.kuaizhizao.mold.lifetimeExpired')}</Tag>;
                        }
                        if (total >= threshold) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>{t('app.kuaizhizao.mold.lifetimeExpiring')}</Tag>;
                        }
                        return null;
                      })()}
                      {moldDetail.maintenance_interval && moldDetail.maintenance_interval > 0 && (() => {
                        const total = moldDetail.total_usage_count ?? 0;
                        const nextAt = (Math.floor(total / moldDetail.maintenance_interval) + 1) * moldDetail.maintenance_interval;
                        const left = nextAt - total;
                        if (left > 0 && left <= moldDetail.maintenance_interval * 0.2) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>{t('app.kuaizhizao.mold.maintenanceDueSoon', { count: left })}</Tag>;
                        }
                        return null;
                      })()}
                      {moldDetail.needs_calibration && moldDetail.next_calibration_date && (() => {
                        const next = dayjs(moldDetail.next_calibration_date);
                        const now = dayjs();
                        const daysLeft = next.diff(now, 'day');
                        if (daysLeft < 0) {
                          return <Tag color="error" style={{ marginBottom: 12 }}>{t('app.kuaizhizao.mold.calibrationExpired')}</Tag>;
                        }
                        if (daysLeft <= 7) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>{t('app.kuaizhizao.mold.calibrationExpiringSoon', { days: daysLeft })}</Tag>;
                        }
                        return null;
                      })()}
                      <Descriptions column={2} size="small">
                        {detailColumns.map((col) => {
                          const val = (moldDetail as any)[col.dataIndex as string];
                          let content: React.ReactNode = val;
                          if (col.valueType === 'dateTime' && val) content = formatDateTime(val, 'YYYY-MM-DD HH:mm:ss');
                          else if (col.valueType === 'date' && val) content = formatDateTime(val, 'YYYY-MM-DD');
                          else if (col.render) {
                            content = (col.render as (dom: React.ReactNode, entity: Mold, i: number) => React.ReactNode)(
                              val,
                              moldDetail,
                              0,
                            );
                          }
                          return (
                            <Descriptions.Item key={String(col.dataIndex)} label={col.title as React.ReactNode}>
                              {content ?? '-'}
                            </Descriptions.Item>
                          );
                        })}
                      </Descriptions>
                    </>
                  ),
                },
                {
                  key: 'usages',
                  label: t('app.kuaizhizao.mold.tabUsages'),
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateUsage}>
                          {t('app.kuaizhizao.mold.createUsage')}
                        </Button>
                      </div>
                      <Table<MoldUsage>
                        size="small"
                        loading={usagesLoading}
                        dataSource={usages}
                        rowKey="uuid"
                        pagination={false}
                        columns={usageTableColumns}
                      />
                    </>
                  ),
                },
                {
                  key: 'calibrations',
                  label: t('app.kuaizhizao.mold.tabCalibrations'),
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleRecordCalibration}>
                          {t('app.kuaizhizao.mold.createCalibration')}
                        </Button>
                      </div>
                      <Table<MoldCalibration>
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
                  key: 'tracking_timeline',
                  label: t('app.uniDetail.sectionTimeline'),
                  children: (
                    <>
                      {moldTracking.loading && (
                        <div style={{ textAlign: 'center', padding: 24 }}>
                          <Spin />
                        </div>
                      )}
                      {moldTracking.error && !moldTracking.loading && (
                        <Typography.Text type="danger">{moldTracking.error}</Typography.Text>
                      )}
                      {moldTracking.data && !moldTracking.loading && (
                        <DocumentTrackingTimelineBody data={moldTracking.data} />
                      )}
                      {!moldTracking.loading && !moldTracking.data && !moldTracking.error && (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.mold.noTimeline')} />
                      )}
                    </>
                  ),
                },
              ]}
            />
            </>
          )
        }
      />

      {/* 新建校验记录 Modal */}
      <Modal
        title={t('app.kuaizhizao.mold.createCalibration')}
        open={calibModalVisible}
        onOk={handleSubmitCalibration}
        onCancel={() => setCalibModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="calibration_date" label={t('app.kuaizhizao.mold.calibrationDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('app.kuaizhizao.mold.calibrationResult')} rules={[{ required: true }]}>
            <Select options={moldCalibrationResultOptions} />
          </Form.Item>
          <Form.Item name="certificate_no" label={t('app.kuaizhizao.mold.certificateNo')}>
            <Input placeholder={t('app.kuaizhizao.mold.phCertificateNo')} />
          </Form.Item>
          <Form.Item name="expiry_date" label={t('app.kuaizhizao.mold.expiryDate')}>
            <FutureDatePicker
              getForm={() => calibForm}
              baseFieldName="calibration_date"
              t={t}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.mold.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'mold_calibration_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.mold.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('app.kuaizhizao.mold.colRemark')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.mold.phRemark')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('app.kuaizhizao.mold.createUsage')}
        open={usageModalVisible}
        onOk={handleSubmitUsage}
        onCancel={() => setUsageModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={usageForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="source_type" label={t('app.kuaizhizao.mold.colSourceType')}>
            <Select placeholder={t('app.kuaizhizao.mold.phSelect')} allowClear options={moldSourceTypeOptions} />
          </Form.Item>
          <Form.Item name="source_no" label={t('app.kuaizhizao.mold.colSourceNo')}>
            <Input placeholder={t('app.kuaizhizao.mold.phSourceNo')} />
          </Form.Item>
          <Form.Item name="usage_date" label={t('app.kuaizhizao.mold.colUsageDate')} rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="usage_count" label={t('app.kuaizhizao.mold.colUsageCount')} initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="operator_name" label={t('app.kuaizhizao.mold.colOperator')}>
            <Input placeholder={t('app.kuaizhizao.mold.phOperator')} />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')}>
            <Select options={moldUsageStatusOptions} />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.mold.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'mold_usage_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.mold.upload')}</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MoldsPage;

