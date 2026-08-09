/**
 * 模具管理页面
 *
 * 提供模具的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持模具信息、模具使用、模具维护、模具追溯等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Tag, Space, message, Modal, Tabs, Table, Form, Input, InputNumber, DatePicker, Select, Row, Col, Typography, Spin, Empty, Upload } from 'antd';
import { PlusOutlined, UploadOutlined, QrcodeOutlined } from '@ant-design/icons';
import { uploadMultipleFiles } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerSection, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { moldApi } from '../../../services/equipment';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import {
  schemeBindingsApi,
  maintenanceSchemesApi,
  repairSchemesApi,
  moldReportsApi,
} from '../../../services/moldOps';
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
import { FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
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
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  renderEquipmentMasterRowActions,
} from '../shared/equipmentMasterDataDetail';

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

interface MoldBorrowReturnLog {
  log_type?: string;
  document_no?: string;
  event_date?: string;
  usage_count?: number | null;
  operator_name?: string;
  status?: string;
  related_document_no?: string | null;
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
  const { t, i18n } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:equipment-management-molds');
  const moldDictOptions = useImportDictionaryOptions(['MOLD_TYPE', 'MOLD_STATUS']);
  const parseMoldDict = moldDictOptions.parseDict;

  const moldImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.mold.import.code', aliases: ['模具编号', '编号'] },
          { field: 'name', required: true, labelKey: 'app.kuaizhizao.mold.import.name', aliases: ['模具名称', '名称'] },
          {
            field: 'type',
            labelKey: 'app.kuaizhizao.mold.import.type',
            aliases: ['模具类型', '类型'],
            options: moldDictOptions.MOLD_TYPE,
          },
          { field: 'category', labelKey: 'app.kuaizhizao.mold.import.category', aliases: ['模具分类', '分类'] },
          { field: 'brand', labelKey: 'app.kuaizhizao.mold.import.brand', aliases: ['品牌'] },
          { field: 'model', labelKey: 'app.kuaizhizao.mold.import.model', aliases: ['型号'] },
          { field: 'serial_number', labelKey: 'app.kuaizhizao.mold.import.serialNumber', aliases: ['序列号'] },
          { field: 'manufacturer', labelKey: 'app.kuaizhizao.mold.import.manufacturer', aliases: ['制造商'] },
          { field: 'supplier', labelKey: 'app.kuaizhizao.mold.import.supplier', aliases: ['供应商'] },
          { field: 'purchase_date', labelKey: 'app.kuaizhizao.mold.import.purchaseDate', aliases: ['采购日期'] },
          { field: 'installation_date', labelKey: 'app.kuaizhizao.mold.import.installationDate', aliases: ['安装日期'] },
          { field: 'warranty_period', labelKey: 'app.kuaizhizao.mold.import.warrantyPeriod', aliases: ['保修期（月）', '保修期'] },
          {
            field: 'status',
            required: true,
            labelKey: 'app.kuaizhizao.mold.import.status',
            aliases: ['模具状态', '状态'],
            options: moldDictOptions.MOLD_STATUS,
          },
          { field: 'cavity_count', labelKey: 'app.kuaizhizao.mold.import.cavityCount', aliases: ['腔数（模数）', '腔数'] },
          { field: 'design_lifetime', labelKey: 'app.kuaizhizao.mold.import.designLifetime', aliases: ['设计寿命（次）', '设计寿命'] },
          { field: 'description', labelKey: 'app.kuaizhizao.mold.import.description', aliases: ['备注', '描述'] },
          {
            field: 'is_active',
            labelKey: 'app.kuaizhizao.mold.import.isActive',
            aliases: ['是否启用', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.kuaizhizao.mold.importExample.code'),
          t('app.kuaizhizao.mold.importExample.name'),
          pickImportExampleValue(moldDictOptions.MOLD_TYPE, t('app.kuaizhizao.mold.importExample.type')),
          t('app.kuaizhizao.mold.importExample.category'),
          t('app.kuaizhizao.mold.importExample.brand'),
          t('app.kuaizhizao.mold.importExample.model'),
          t('app.kuaizhizao.mold.importExample.serialNumber'),
          t('app.kuaizhizao.mold.importExample.manufacturer'),
          t('app.kuaizhizao.mold.importExample.supplier'),
          t('app.kuaizhizao.mold.importExample.purchaseDate'),
          t('app.kuaizhizao.mold.importExample.installationDate'),
          t('app.kuaizhizao.mold.importExample.warrantyPeriod'),
          pickImportExampleValue(moldDictOptions.MOLD_STATUS, t('app.kuaizhizao.mold.importExample.status')),
          t('app.kuaizhizao.mold.importExample.cavityCount'),
          t('app.kuaizhizao.mold.importExample.designLifetime'),
          '',
          pickImportExampleValue([...IMPORT_YES_NO_OPTIONS], t('app.kuaizhizao.mold.importExample.isActive')),
        ],
      ),
    [t, i18n.language, moldDictOptions],
  );
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  // Modal 相关状态（创建/编辑模具）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMold, setCurrentMold] = useState<Mold | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [moldDetail, setMoldDetail] = useState<Mold | null>(null);

  const [moldTrackingRefreshKey, setMoldTrackingRefreshKey] = useState(0);

  const moldTracking = useDocumentTracking(
    drawerVisible && moldDetail?.id ? 'mold' : undefined,
    moldDetail?.id,
    moldTrackingRefreshKey,
  );

  // 领用/归还流水
  const [borrowReturnLogs, setBorrowReturnLogs] = useState<MoldBorrowReturnLog[]>([]);
  const [borrowReturnLogsLoading, setBorrowReturnLogsLoading] = useState(false);

  // 校验记录相关状态
  const [calibrations, setCalibrations] = useState<MoldCalibration[]>([]);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  const [boundMaintenanceSchemeIds, setBoundMaintenanceSchemeIds] = useState<number[]>([]);
  const [boundRepairSchemeIds, setBoundRepairSchemeIds] = useState<number[]>([]);
  const [maintenanceSchemeOptions, setMaintenanceSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [repairSchemeOptions, setRepairSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [schemeBindingsSaving, setSchemeBindingsSaving] = useState(false);

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

  const handleBatchPrintMoldCards = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.mold.selectMoldForCard'));
      return;
    }
    const uuids = selectedRowKeys.map((key) => String(key)).filter(Boolean);
    if (uuids.length === 0) {
      messageApi.error(t('app.kuaizhizao.mold.getSelectedFailed'));
      return;
    }
    openPrint({
      documentType: 'mold_card',
      documentId: uuids.length,
      printApiPath: '/apps/kuaizhizao/molds/print-cards',
      printApiParams: { uuids },
      pdfDownloadFilename: 'mold-cards.pdf',
    });
  };

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
   * 加载模具领用/归还流水
   */
  const loadBorrowReturnLogs = async (moldId: number) => {
    setBorrowReturnLogsLoading(true);
    try {
      const res = await moldReportsApi.borrowReturnLog({ mold_id: moldId, skip: 0, limit: 100 });
      setBorrowReturnLogs(res.items || []);
    } catch {
      setBorrowReturnLogs([]);
    } finally {
      setBorrowReturnLogsLoading(false);
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

  const loadSchemeBindings = async (moldId: number) => {
    const [maintBindings, repairBindings] = await Promise.all([
      schemeBindingsApi.list({ mold_id: moldId, scheme_type: 'maintenance' }),
      schemeBindingsApi.list({ mold_id: moldId, scheme_type: 'repair' }),
    ]);
    setBoundMaintenanceSchemeIds(
      (maintBindings.items ?? maintBindings.bindings ?? []).map((b: { scheme_id: number }) => b.scheme_id),
    );
    setBoundRepairSchemeIds(
      (repairBindings.items ?? repairBindings.bindings ?? []).map((b: { scheme_id: number }) => b.scheme_id),
    );
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
  const handleDetail = useCallback(async (record: Mold) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaizhizao.mold.uuidNotFound'));
      return;
    }
    setDrawerVisible(true);
    setDetailLoading(true);
    setMoldDetail(null);
    try {
      const detail = await moldApi.get(record.uuid);
      setMoldDetail(detail);
      if (detail.id != null) {
        loadBorrowReturnLogs(detail.id);
      }
      loadCalibrations(record.uuid);
      setMoldTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadMoldFieldValuesForDetail(detail.id);
        void loadSchemeOptions();
        void loadSchemeBindings(detail.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.mold.getDetailFailed'));
      setDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t, loadMoldFieldValuesForDetail]);

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
        calibration_date: toApiDateString(values.calibration_date),
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: toApiDateString(values.expiry_date),
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
        purchase_date: toApiDateString(standardValues.purchase_date) ?? null,
        installation_date: toApiDateString(standardValues.installation_date) ?? null,
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
          if (fresh.id != null) {
            loadBorrowReturnLogs(fresh.id);
          }
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
  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const moldStatusValueEnum = useMemo(
    () => ({
      正常: { text: t('app.kuaizhizao.mold.statusNormal') },
      使用中: { text: t('app.kuaizhizao.mold.statusInUse') },
      维护中: { text: t('app.kuaizhizao.mold.statusMaintaining') },
      停用: { text: t('app.kuaizhizao.mold.statusDisabled') },
      报废: { text: t('app.kuaizhizao.mold.statusScrapped') },
    }),
    [t],
  );

  const columns: ProColumns<Mold>[] = useMemo(() => {
    const customFieldColumns = generateMoldCustomFieldColumns();
    return alignProColumns<Mold>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colIsActive'),
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
      valueEnum: moldStatusValueEnum,
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colType'),
      dataIndex: 'type',
      hideInTable: true,
      search: { order: 22 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colCategory'),
      dataIndex: 'category',
      hideInTable: true,
      search: { order: 23 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.mold.colCode'),
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
      title: t('app.kuaizhizao.mold.colName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colType'),
      dataIndex: 'type',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colCategory'),
      dataIndex: 'category',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colBrand'),
      dataIndex: 'brand',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colModel'),
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colIsActive'),
      dataIndex: 'is_active',
      width: 100,
      sorter: true,
      hideInSearch: true,
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
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.mold.colLifeProgress'),
      dataIndex: ['total_usage_count', 'design_lifetime'],
      width: 100,
      hideInSearch: true,
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
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    ...customFieldColumns,
    {
      title: t('common.actions'),
      fixed: 'right',
      render: (_text, record) =>
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
  ], SALES_DOC_LIST_FIELD_RANK);
  }, [moldListCustomFields, generateMoldCustomFieldColumns, t, activeStatusValueEnum, moldStatusValueEnum, perms, handleDetail]);

  const moldCalibrationResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.mold.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.mold.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.mold.resultApproved'), value: '准用' },
    ],
    [t],
  );

  const borrowReturnLogColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docNo'), dataIndex: 'document_no', width: 140 },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docType'),
        dataIndex: 'log_type',
        width: 90,
        render: (v: string) =>
          v === 'borrow'
            ? t('app.kuaizhizao.menu.equipment-management.mold-borrows')
            : v === 'return'
              ? t('app.kuaizhizao.menu.equipment-management.mold-returns')
              : v || '-',
      },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docDate'),
        dataIndex: 'event_date',
        width: 110,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.usageCount'),
        dataIndex: 'usage_count',
        width: 80,
        render: (v: number | null) => (v == null ? '-' : v),
      },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.borrower'),
        dataIndex: 'operator_name',
        width: 90,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (s: string) => renderDocumentStatusTag(s || '-', s),
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
        render: (r: string) => renderDocumentStatusTag(r || '-', r),
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

  const moldCardToolbar = useMemo(
    () =>
      perms.canPrint ? (
        <Button key="mold-card-print" icon={<QrcodeOutlined />} onClick={handleBatchPrintMoldCards}>
          {t('app.kuaizhizao.mold.printMoldCards')}
        </Button>
      ) : null,
    [t, selectedRowKeys, perms.canPrint],
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
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveLedgerListParams(searchFormValues, sort);
              const response = await moldApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              const enriched = await enrichMoldRecordsWithCustomFields(data as Mold[]);
              return {
                data: enriched,
                success: true,
                total,
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
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          toolbar={{ actions: [moldCardToolbar] }}
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
                type: parseMoldDict('MOLD_TYPE', cellAt(row, 'type')) || undefined,
                category: cellAt(row, 'category') || undefined,
                brand: cellAt(row, 'brand') || undefined,
                model: cellAt(row, 'model') || undefined,
                serial_number: cellAt(row, 'serial_number') || undefined,
                manufacturer: cellAt(row, 'manufacturer') || undefined,
                supplier: cellAt(row, 'supplier') || undefined,
                purchase_date: parseDate(cellAt(row, 'purchase_date')),
                installation_date: parseDate(cellAt(row, 'installation_date')),
                warranty_period: parseIntField(cellAt(row, 'warranty_period')),
                status: parseMoldDict('MOLD_STATUS', cellAt(row, 'status')) || '待用',
                cavity_count: parseIntField(cellAt(row, 'cavity_count')),
                design_lifetime: parseIntField(cellAt(row, 'design_lifetime')),
                description: cellAt(row, 'description') || undefined,
                ...(isActive === undefined ? {} : { is_active: isActive }),
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
          importColumnOptions={moldImportTemplate.importColumnOptions}
          importFieldMap={moldImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items: any[] =
                type === 'currentPage' && pageData?.length
                  ? pageData
                  : await fetchAllListItems((p) => moldApi.list(p));
              if (type === 'selected' && keys?.length) {
                items = items.filter((d: any) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const exportColumns = [
                { key: 'code', title: t('app.kuaizhizao.mold.import.code') },
                { key: 'name', title: t('app.kuaizhizao.mold.import.name') },
                { key: 'type', title: t('app.kuaizhizao.mold.import.type') },
                { key: 'category', title: t('app.kuaizhizao.mold.import.category') },
                { key: 'brand', title: t('app.kuaizhizao.mold.import.brand') },
                { key: 'model', title: t('app.kuaizhizao.mold.import.model') },
                { key: 'serial_number', title: t('app.kuaizhizao.mold.fieldSerialNumber') },
                { key: 'manufacturer', title: t('app.kuaizhizao.mold.fieldManufacturer') },
                { key: 'supplier', title: t('app.kuaizhizao.mold.fieldSupplier') },
                { key: 'status', title: t('app.kuaizhizao.mold.fieldStatus') },
              ];
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `molds-${new Date().toISOString().slice(0, 10)}.xlsx`,
                { columns: exportColumns, sheetName: t('app.kuaizhizao.mold.title') },
              );
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
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
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label={t('app.kuaizhizao.mold.fieldInstallationDate')}
              placeholder={t('app.kuaizhizao.mold.phInstallationDate')}
              formItemProps={formDateFormItemProps}
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
      <EquipmentMasterDetailDrawer
        open={drawerVisible}
        loading={detailLoading}
        detail={moldDetail}
        title={`${t('app.kuaizhizao.mold.detail')}${moldDetail?.code ? ` - ${moldDetail.code}` : ''}`}
        onClose={() => {
          setDrawerVisible(false);
          setMoldDetail(null);
          setCalibrations([]);
          resetMoldDetailFieldValues();
        }}
        basicColumns={detailColumns}
        basicExtra={
          moldDetail?.uuid ? (
            <>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('app.kuaizhizao.mold.qrcodeCardTitle')}
              </Typography.Text>
              <QRCodeGenerator
                qrcodeType="MD"
                data={{
                  mold_uuid: moldDetail.uuid,
                  mold_code: moldDetail.code || '',
                  mold_name: moldDetail.name || '',
                }}
                autoGenerate
                size={6}
                noCard
              />
            </>
          ) : null
        }
        extra={
          <Space wrap>
            {perms.canPrint && moldDetail?.uuid ? (
              <Button
                icon={<QrcodeOutlined />}
                onClick={() =>
                  openPrint({
                    documentType: 'mold_card',
                    documentId: moldDetail.id ?? 1,
                    printApiPath: `/apps/kuaizhizao/molds/${moldDetail.uuid}/print`,
                    pdfDownloadFilename: `mold-card-${moldDetail.code || moldDetail.uuid}.pdf`,
                  })
                }
              >
                {t('app.kuaizhizao.mold.printMoldCard')}
              </Button>
            ) : null}
            {buildDetailDrawerEditExtra(t, Boolean(moldDetail && perms.canUpdate), () => {
              if (!moldDetail) return;
              setDrawerVisible(false);
              void handleEdit(moldDetail);
            })}
          </Space>
        }
        lines={
          moldDetail ? (
            <>
              {hasCustomFieldsDetailContent(moldListCustomFields, moldDetailCustomFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields')}>
                  <CustomFieldsDetailSection
                    customFields={moldListCustomFields}
                    customFieldValues={moldDetailCustomFieldValues}
                  />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title={t('app.kuaizhizao.moldOps.schemeBindings.title')}>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary">{t('app.kuaizhizao.moldOps.schemeBindings.maintenance')}</Typography.Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder={t('app.kuaizhizao.moldOps.schemeBindings.selectMaintenanceSchemes')}
                    options={maintenanceSchemeOptions}
                    value={boundMaintenanceSchemeIds}
                    onChange={setBoundMaintenanceSchemeIds}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary">{t('app.kuaizhizao.moldOps.schemeBindings.repair')}</Typography.Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder={t('app.kuaizhizao.moldOps.schemeBindings.selectRepairSchemes')}
                    options={repairSchemeOptions}
                    value={boundRepairSchemeIds}
                    onChange={setBoundRepairSchemeIds}
                  />
                </div>
                <Button
                  type="primary"
                  loading={schemeBindingsSaving}
                  disabled={moldDetail.id == null}
                  onClick={async () => {
                    if (moldDetail.id == null) return;
                    setSchemeBindingsSaving(true);
                    try {
                      await schemeBindingsApi.bulkReplace({
                        mold_id: moldDetail.id,
                        scheme_type: 'maintenance',
                        scheme_ids: boundMaintenanceSchemeIds,
                      });
                      await schemeBindingsApi.bulkReplace({
                        mold_id: moldDetail.id,
                        scheme_type: 'repair',
                        scheme_ids: boundRepairSchemeIds,
                      });
                      messageApi.success(t('app.kuaizhizao.moldOps.schemeBindings.saveSuccess'));
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
              </DetailDrawerSection>
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
              <Tabs
                defaultActiveKey="borrow_return_log"
                items={[
                  {
                    key: 'borrow_return_log',
                    label: t('app.kuaizhizao.menu.reports.mold-borrow-return-log'),
                    children: (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <Space wrap>
                            <Link to="/apps/kuaizhizao/equipment-management/mold-borrows">
                              <Button type="primary" size="small">{t('app.kuaizhizao.menu.equipment-management.mold-borrows')}</Button>
                            </Link>
                            <Link to="/apps/kuaizhizao/equipment-management/mold-returns">
                              <Button size="small">{t('app.kuaizhizao.menu.equipment-management.mold-returns')}</Button>
                            </Link>
                          </Space>
                        </div>
                        <Table<MoldBorrowReturnLog>
                          size="small"
                          loading={borrowReturnLogsLoading}
                          dataSource={borrowReturnLogs}
                          rowKey={(row, index) => `${row.log_type}-${row.document_no}-${index}`}
                          pagination={false}
                          columns={borrowReturnLogColumns}
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
                    key: 'ops',
                    label: t('app.kuaizhizao.moldOps.opsLinks.title'),
                    children: (
                      <Space wrap>
                        <Link to="/apps/kuaizhizao/equipment-management/mold-borrows">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.mold-borrows')}</Button>
                        </Link>
                        <Link to="/apps/kuaizhizao/equipment-management/mold-trials">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.mold-trials')}</Button>
                        </Link>
                        <Link to="/apps/kuaizhizao/equipment-management/mold-maintenances">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.mold-maintenances')}</Button>
                        </Link>
                        <Link to="/apps/kuaizhizao/equipment-management/mold-repairs">
                          <Button size="small">{t('app.kuaizhizao.menu.equipment-management.mold-repairs')}</Button>
                        </Link>
                      </Space>
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
          ) : undefined
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
      {PrintModal}
    </>
  );
};

export default MoldsPage;

