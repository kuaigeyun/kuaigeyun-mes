import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 设备管理页面
 *
 * 提供设备的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持设备基础信息管理、序列号管理、关联工作中心等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormInstance,
  ProFormText,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormSwitch,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Modal,
  Row,
  Col,
  Typography,
  Upload,
} from 'antd';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { photoUuidToUploadList, uploadListToPhotoUuid } from '../../../utils/equipmentPhoto';
import { uploadMultipleFiles } from '../../../../../services/file';
import { SecureImage } from '../../../../../components/secure-image';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EditOutlined, DeleteOutlined, EyeOutlined, HistoryOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { equipmentApi } from '../../../services/equipment';
import { buildEquipmentDetailPath } from './equipmentPaths';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import EquipmentFactoryBindingFields from '../../../components/EquipmentFactoryBindingFields';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import {
  factoryListItems,
  productionLineApi,
  workCenterApi,
  workstationApi,
  workshopApi,
} from '../../../../master-data/services/factory';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import dayjs from 'dayjs';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
} from '../../../../../components/custom-fields';
import { formatDateTime, todaySiteDateString } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  formDateFormItemProps,
  formDateRangeFormItemProps,
  parseSpreadsheetDateToApiString,
  toApiDateString,
} from '../../../../../utils/formDate';
import {
  buildActiveStatusValueEnum,
  buildEquipmentNatureValueEnum,
  normalizeEquipmentListResponse,
  resolveLedgerListParams,
  EQUIPMENT_LEDGER_GROUP_PINNED_FIELD,
  type EquipmentLedgerGroupMode,
} from '../../../utils/equipmentListCore';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const EQUIPMENT_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_equipment';

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
  workshop_id?: number;
  workshop_name?: string;
  production_line_id?: number;
  production_line_code?: string;
  production_line_name?: string;
  equipment_nature?: string;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  work_center_id?: number;
  work_center_code?: string;
  work_center_name?: string;
  responsible_person_id?: number;
  responsible_person_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
  photo_file_uuid?: string | null;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  lifecycle?: { main_stages?: Array<unknown> };
}

const EQUIPMENT_IMPORT_IS_ACTIVE_OPTIONS = ['是', '否'] as const;

const EquipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const equipmentDictOptions = useImportDictionaryOptions([
    'EQUIPMENT_TYPE',
    'EQUIPMENT_NATURE',
    'EQUIPMENT_STATUS',
  ]);
  const parseEquipmentDict = equipmentDictOptions.parseDict;
  const importDictOptions = useMemo(
    () => ({
      type: equipmentDictOptions.EQUIPMENT_TYPE ?? [],
      nature: equipmentDictOptions.EQUIPMENT_NATURE ?? [],
      status: equipmentDictOptions.EQUIPMENT_STATUS ?? [],
    }),
    [equipmentDictOptions],
  );

  const equipmentImportTemplate = useMemo(() => {
    const pickExample = (options: string[], fallback: string) =>
      options.includes(fallback) ? fallback : options[0] ?? fallback;

    return buildFactoryImportTemplate(
      t,
      [
        { field: 'code', labelKey: 'app.kuaizhizao.equipment.import.code', aliases: ['设备编号', '编号'] },
        { field: 'name', required: true, labelKey: 'app.kuaizhizao.equipment.import.name', aliases: ['设备名称', '名称'] },
        {
          field: 'type',
          labelKey: 'app.kuaizhizao.equipment.import.type',
          aliases: ['设备类型', '类型'],
          options: importDictOptions.type,
        },
        { field: 'category', labelKey: 'app.kuaizhizao.equipment.import.category', aliases: ['设备分类', '分类'] },
        { field: 'brand', labelKey: 'app.kuaizhizao.equipment.import.brand', aliases: ['品牌'] },
        { field: 'model', labelKey: 'app.kuaizhizao.equipment.import.model', aliases: ['型号'] },
        {
          field: 'serial_number',
          labelKey: 'app.kuaizhizao.equipment.import.serialNumber',
          aliases: ['序列号', 'serial_number'],
        },
        {
          field: 'manufacturer',
          labelKey: 'app.kuaizhizao.equipment.import.manufacturer',
          aliases: ['制造商', 'manufacturer'],
        },
        {
          field: 'supplier',
          labelKey: 'app.kuaizhizao.equipment.import.supplier',
          aliases: ['供应商', 'supplier'],
        },
        {
          field: 'purchase_date',
          labelKey: 'app.kuaizhizao.equipment.import.purchaseDate',
          aliases: ['采购日期', 'purchase_date'],
        },
        {
          field: 'installation_date',
          labelKey: 'app.kuaizhizao.equipment.import.installationDate',
          aliases: ['安装日期', 'installation_date'],
        },
        {
          field: 'warranty_period',
          labelKey: 'app.kuaizhizao.equipment.import.warrantyPeriod',
          aliases: ['保修期（月）', '保修期', 'warranty_period'],
        },
        {
          field: 'equipment_nature',
          labelKey: 'app.kuaizhizao.equipment.import.nature',
          aliases: ['设备性质', '性质'],
          options: importDictOptions.nature,
        },
        {
          field: 'workshop_name',
          labelKey: 'app.kuaizhizao.equipment.import.workshop',
          aliases: ['关联车间', '车间', 'workshop_name'],
        },
        {
          field: 'production_line_code',
          labelKey: 'app.kuaizhizao.equipment.import.productionLine',
          aliases: ['关联产线（线组）', '关联产线', '产线', 'production_line_code'],
        },
        {
          field: 'workstation_code',
          labelKey: 'app.kuaizhizao.equipment.import.workstation',
          aliases: ['关联工位', '工位', 'workstation_code'],
        },
        {
          field: 'work_center_code',
          labelKey: 'app.kuaizhizao.equipment.import.workCenter',
          aliases: ['关联工作中心', '工作中心', 'work_center_code'],
        },
        {
          field: 'status',
          required: true,
          labelKey: 'app.kuaizhizao.equipment.import.status',
          aliases: ['设备状态', '状态', 'status'],
          options: importDictOptions.status,
        },
        {
          field: 'description',
          labelKey: 'common.remark',
          aliases: ['备注', '描述', 'description'],
        },
        {
          field: 'is_active',
          labelKey: 'app.kuaizhizao.equipment.import.isActive',
          aliases: ['是否启用', '启用', 'is_active'],
          options: [...EQUIPMENT_IMPORT_IS_ACTIVE_OPTIONS],
        },
      ],
      [
        t('app.kuaizhizao.equipment.importExample.code'),
        t('app.kuaizhizao.equipment.importExample.name'),
        pickExample(importDictOptions.type, t('app.kuaizhizao.equipment.importExample.type')),
        t('app.kuaizhizao.equipment.importExample.category'),
        t('app.kuaizhizao.equipment.importExample.brand'),
        t('app.kuaizhizao.equipment.importExample.model'),
        t('app.kuaizhizao.equipment.importExample.serialNumber'),
        t('app.kuaizhizao.equipment.importExample.manufacturer'),
        t('app.kuaizhizao.equipment.importExample.supplier'),
        t('app.kuaizhizao.equipment.importExample.purchaseDate'),
        t('app.kuaizhizao.equipment.importExample.installationDate'),
        t('app.kuaizhizao.equipment.importExample.warrantyPeriod'),
        pickExample(importDictOptions.nature, t('app.kuaizhizao.equipment.importExample.nature')),
        t('app.kuaizhizao.equipment.importExample.workshop'),
        t('app.kuaizhizao.equipment.importExample.productionLine'),
        t('app.kuaizhizao.equipment.importExample.workstation'),
        t('app.kuaizhizao.equipment.importExample.workCenter'),
        pickExample(importDictOptions.status, t('app.kuaizhizao.equipment.importExample.status')),
        '',
        pickExample(
          [...EQUIPMENT_IMPORT_IS_ACTIVE_OPTIONS],
          t('common.yes'),
        ),
      ],
    );
  }, [t, i18n.language, importDictOptions]);
  const { message: messageApi } = App.useApp();
  const equipmentPerms = useResourcePermissions('kuaizhizao:equipment-management-equipment');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const actionRef = useRef<ActionType>(null);
  const searchFormRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [ledgerGroupMode, setLedgerGroupMode] = useState<EquipmentLedgerGroupMode>('nature');
  const [workshopGroupOptions, setWorkshopGroupOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [productionLineGroupOptions, setProductionLineGroupOptions] = useState<Array<{ id: number; name: string; code?: string }>>([]);

  // Modal 相关状态（创建/编辑设备）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Equipment | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

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
  } = useCustomFieldsForList<Equipment>({ tableName: EQUIPMENT_CUSTOM_FIELD_TABLE });
  useEffect(() => {
    if (ledgerGroupMode !== 'workshop' && ledgerGroupMode !== 'production_line') {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [workshopsRes, linesRes] = await Promise.all([
          workshopApi.list({ limit: 1000, is_active: true }),
          productionLineApi.list({ limit: 1000, is_active: true }),
        ]);
        if (cancelled) return;
        setWorkshopGroupOptions(
          factoryListItems(workshopsRes).map((ws) => ({ id: ws.id, name: ws.name })),
        );
        setProductionLineGroupOptions(
          factoryListItems(linesRes).map((line) => ({ id: line.id, name: line.name, code: line.code })),
        );
      } catch {
        if (!cancelled) {
          setWorkshopGroupOptions([]);
          setProductionLineGroupOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ledgerGroupMode]);

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
      const [fieldFormValues, responsiblePersonUuid, photoList] = await Promise.all([
        detail.id != null ? loadEquipmentFormFieldValues(detail.id) : Promise.resolve({}),
        resolveUserUuidById(detail.responsible_person_id),
        photoUuidToUploadList(detail.photo_file_uuid),
      ]);
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
        workshop_id: detail.workshop_id,
        workshop_name: detail.workshop_name,
        production_line_id: detail.production_line_id,
        production_line_code: detail.production_line_code,
        production_line_name: detail.production_line_name,
        equipment_nature: detail.equipment_nature,
        workstation_id: detail.workstation_id,
        workstation_code: detail.workstation_code,
        workstation_name: detail.workstation_name,
        work_center_id: detail.work_center_id,
        work_center_code: detail.work_center_code,
        work_center_name: detail.work_center_name,
        responsible_person_uuid: responsiblePersonUuid,
        responsible_person_id: detail.responsible_person_id,
        responsible_person_name: detail.responsible_person_name,
        status: detail.status,
        is_active: detail.is_active,
        description: detail.description,
        photo: photoList,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        ...fieldFormValues,
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.equipment.getDetailFailed'));
    }
  };

  useEffect(() => {
    const openEditUuid = (location.state as { openEditUuid?: string } | null)?.openEditUuid;
    if (!openEditUuid) return;
    navigate(location.pathname, { replace: true, state: null });
    void handleEdit({ uuid: openEditUuid } as Equipment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname]);

  /**
   * 处理查看详情
   */
  const handleDetail = (record: Equipment) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaizhizao.equipment.uuidNotFound'));
      return;
    }
    navigate(buildEquipmentDetailPath(record.uuid));
  };

  /**
   * 处理批量删除设备（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.equipment.confirmBatchDeleteTitle'),
      content: t('app.kuaizhizao.equipment.confirmBatchDeleteContent', { count: keys.length }),
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await equipmentApi.delete(String(uuid));
          }
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理查看设备追溯（跳转详情 Tab）
   */
  const handleTrace = (record: Equipment) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaizhizao.equipment.uuidNotFound'));
      return;
    }
    navigate(buildEquipmentDetailPath(record.uuid, 'faults_repairs'));
  };

  const handleBatchPrintEquipmentCards = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.equipment.selectEquipmentForQrcode'));
      return;
    }
    const uuids = selectedRowKeys.map((key) => String(key)).filter(Boolean);
    if (uuids.length === 0) {
      messageApi.error(t('app.kuaizhizao.equipment.getSelectedFailed'));
      return;
    }
    openPrint({
      documentType: 'equipment_card',
      documentId: uuids.length,
      printApiPath: '/apps/kuaizhizao/equipment/print-cards',
      printApiParams: { uuids },
      pdfDownloadFilename: 'equipment-cards.pdf',
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractEquipmentFormValues(values);
      const {
        responsible_person_uuid: _responsiblePersonUuid,
        photo: _photo,
        ...standardWithoutPersonUuid
      } = standardValues;
      const submitData = {
        ...standardWithoutPersonUuid,
        purchase_date: toApiDateString(standardValues.purchase_date) ?? null,
        installation_date: toApiDateString(standardValues.installation_date) ?? null,
        responsible_person_id: standardValues.responsible_person_id ?? null,
        responsible_person_name: standardValues.responsible_person_name ?? null,
        photo_file_uuid: uploadListToPhotoUuid(standardValues.photo),
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
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

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
          getAntdModal().confirm({
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

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const equipmentNatureValueEnum = useMemo(() => buildEquipmentNatureValueEnum(t), [t]);

  const equipmentStatusValueEnum = useMemo(
    () => ({
      正常: { text: t('app.kuaizhizao.equipment.statusNormal') },
      运行中: { text: t('app.kuaizhizao.equipment.statusRunning') },
      待机: { text: t('app.kuaizhizao.equipment.statusStandby') },
      故障: { text: t('app.kuaizhizao.equipment.statusFault') },
      维修中: { text: t('app.kuaizhizao.equipment.statusRepairing') },
      停用: { text: t('app.kuaizhizao.equipment.statusDisabled') },
      校验中: { text: t('app.kuaizhizao.equipment.statusCalibrating') },
      报废: { text: t('app.kuaizhizao.equipment.statusScrapped') },
    }),
    [t],
  );

  const workshopTabsValueEnum = useMemo(() => {
    const map: Record<string, { text: string }> = {};
    for (const ws of workshopGroupOptions) {
      map[String(ws.id)] = { text: ws.name };
    }
    return map;
  }, [workshopGroupOptions]);

  const productionLineTabsValueEnum = useMemo(() => {
    const map: Record<string, { text: string }> = {};
    for (const line of productionLineGroupOptions) {
      map[String(line.id)] = { text: line.code ? `${line.code} - ${line.name}` : line.name };
    }
    return map;
  }, [productionLineGroupOptions]);

  const ledgerPinnedTabsField = EQUIPMENT_LEDGER_GROUP_PINNED_FIELD[ledgerGroupMode];

  const ledgerPinnedTabsValueEnum = useMemo(() => {
    switch (ledgerGroupMode) {
      case 'nature':
        return equipmentNatureValueEnum;
      case 'active':
        return activeStatusValueEnum;
      case 'status':
        return equipmentStatusValueEnum;
      case 'workshop':
        return workshopTabsValueEnum;
      case 'production_line':
        return productionLineTabsValueEnum;
      default:
        return equipmentNatureValueEnum;
    }
  }, [
    ledgerGroupMode,
    equipmentNatureValueEnum,
    activeStatusValueEnum,
    equipmentStatusValueEnum,
    workshopTabsValueEnum,
    productionLineTabsValueEnum,
  ]);

  const handleLedgerGroupModeChange = useCallback((mode: EquipmentLedgerGroupMode) => {
    const nextField = EQUIPMENT_LEDGER_GROUP_PINNED_FIELD[mode];
    const clearFields = Object.fromEntries(
      Object.values(EQUIPMENT_LEDGER_GROUP_PINNED_FIELD)
        .filter((field) => field !== nextField)
        .map((field) => [field, undefined]),
    );
    searchFormRef.current?.setFieldsValue(clearFields);
    setLedgerGroupMode(mode);
    actionRef.current?.reload();
  }, []);

  const ledgerGroupSegment = useMemo(
    () => (
      <ThemedSegmented<EquipmentLedgerGroupMode>
        surfaceBackground
        size="middle"
        value={ledgerGroupMode}
        onChange={(v) => handleLedgerGroupModeChange(v as EquipmentLedgerGroupMode)}
        options={[
          { label: t('app.kuaizhizao.equipment.ledgerGroupNature'), value: 'nature' },
          { label: t('app.kuaizhizao.equipment.ledgerGroupActive'), value: 'active' },
          { label: t('app.kuaizhizao.equipment.ledgerGroupStatus'), value: 'status' },
          { label: t('app.kuaizhizao.equipment.ledgerGroupWorkshop'), value: 'workshop' },
          { label: t('app.kuaizhizao.equipment.ledgerGroupProductionLine'), value: 'production_line' },
        ]}
      />
    ),
    [t, ledgerGroupMode, handleLedgerGroupModeChange],
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<Equipment>[] = useMemo(() => {
    const customFieldColumns = generateEquipmentCustomFieldColumns();
    return alignProColumns<Equipment>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colIsActive'),
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
      valueEnum: equipmentStatusValueEnum,
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colType'),
      dataIndex: 'type',
      hideInTable: true,
      search: { order: 22 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colCategory'),
      dataIndex: 'category',
      hideInTable: true,
      search: { order: 23 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colEquipmentNature'),
      dataIndex: 'equipment_nature',
      valueType: 'select',
      valueEnum: equipmentNatureValueEnum,
      hideInTable: true,
      search: { order: 19 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colWorkshop'),
      dataIndex: 'workshop_id',
      valueType: 'select',
      valueEnum: workshopTabsValueEnum,
      hideInTable: true,
      search: { order: 24 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colProductionLine'),
      dataIndex: 'production_line_id',
      valueType: 'select',
      valueEnum: productionLineTabsValueEnum,
      hideInTable: true,
      search: { order: 25 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.equipment.colCode'),
      dataIndex: 'code',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
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
      title: t('app.kuaizhizao.equipment.colName'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colPhoto'),
      dataIndex: 'photo_file_uuid',
      width: 72,
      align: 'center',
      hideInSearch: true,
      search: false,
      sorter: false,
      uniTableKeepWidth: true,
      render: (_, r) => {
        const uuid = (r.photo_file_uuid || '').trim();
        if (!uuid) {
          return <Typography.Text type="secondary">-</Typography.Text>;
        }
        return (
          <span
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', lineHeight: 0 }}
          >
            <SecureImage
              fileUuid={uuid}
              alt={r.name || t('app.kuaizhizao.equipment.fieldPhoto')}
              width={48}
              height={48}
              thumbSize={64}
              style={{ objectFit: 'cover', borderRadius: 6 }}
            />
          </span>
        );
      },
    },
    {
      title: t('app.kuaizhizao.equipment.colType'),
      dataIndex: 'type',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colCategory'),
      dataIndex: 'category',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colEquipmentNature'),
      dataIndex: 'equipment_nature',
      width: 110,
      hideInSearch: true,
      render: (_, r) => r.equipment_nature ?? '-',
    },
    {
      title: t('app.kuaizhizao.equipment.colResponsiblePerson'),
      dataIndex: 'responsible_person_name',
      width: 110,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.responsible_person_name ?? '-',
    },
    {
      title: t('app.kuaizhizao.equipment.colBrand'),
      dataIndex: 'brand',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colModel'),
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
      hideInSearch: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.serial_number ?? '') }} ellipsis>
          {r.serial_number ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.equipment.colWorkshop'),
      dataIndex: 'workshop_name',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colProductionLine'),
      dataIndex: 'production_line_name',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.equipment.colWorkCenter'),
      dataIndex: 'work_center_name',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    ...customFieldColumns,
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => renderEquipmentRowNodes(record),
    },
  ], SALES_DOC_LIST_FIELD_RANK);
  }, [
    equipmentListCustomFields,
    generateEquipmentCustomFieldColumns,
    t,
    activeStatusValueEnum,
    equipmentStatusValueEnum,
    equipmentNatureValueEnum,
    workshopTabsValueEnum,
    productionLineTabsValueEnum,
  ]);

  const equipmentCardToolbar = useMemo(
    () =>
      equipmentPerms.canPrint ? (
        <Button key="equipment-card-qr" icon={<QrcodeOutlined />} onClick={handleBatchPrintEquipmentCards}>
          {t('app.kuaizhizao.equipment.printEquipmentCards')}
        </Button>
      ) : null,
    [t, selectedRowKeys, equipmentPerms.canPrint],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<Equipment>
          headerTitle={t('app.kuaizhizao.equipment.title')}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment.v2"
          actionRef={actionRef}
          formRef={searchFormRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          betweenFuzzyAndAdvancedButtons={ledgerGroupSegment}
          pinnedTabsField={ledgerPinnedTabsField}
          pinnedTabsValueEnum={ledgerPinnedTabsValueEnum}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            try {
              const listParams = resolveLedgerListParams(searchFormValues, sort);
              const response = await equipmentApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              const enriched = meta?.purpose === 'prefetch'
                ? data as Equipment[]
                : await enrichEquipmentRecordsWithCustomFields(data as Equipment[]);
              return {
                data: enriched,
                success: true,
                total,
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

            const cellAt = (row: any[], field: string): string => {
              const idx = headerIndexMap[field];
              if (idx === undefined) return '';
              return String(row[idx] ?? '').trim();
            };
            const parseDate = (raw: string): string | undefined => parseSpreadsheetDateToApiString(raw);
            const parseActive = (raw: string): boolean | undefined => {
              if (!raw) return undefined;
              const v = raw.toLowerCase();
              if (['1', 'true', 'yes', 'y', '是', '启用', 'active'].includes(v)) return true;
              if (['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(v)) return false;
              return undefined;
            };

            const [workshops, lines, stations, centers] = await Promise.all([
              workshopApi.list({ limit: 1000, is_active: true }).then(factoryListItems),
              productionLineApi.list({ limit: 1000, is_active: true }).then(factoryListItems),
              workstationApi.list({ limit: 1000, is_active: true }).then(factoryListItems),
              workCenterApi.list({ limit: 1000, is_active: true }).then(factoryListItems),
            ]);
            const matchByCodeOrName = <T extends { id: number; code?: string; name?: string }>(
              list: T[],
              ref: string,
            ): T | undefined =>
              list.find(
                (item) =>
                  (item.code && String(item.code).trim() === ref) ||
                  (item.name && String(item.name).trim() === ref),
              );

            const items: any[] = [];
            const importRows = data.slice(2).filter((row: any[]) =>
              row?.some((c: any) => c != null && String(c).trim() !== ''),
            );
            for (const row of importRows) {
              const name = cellAt(row, 'name');
              if (!name) continue;

              const workshopRef = cellAt(row, 'workshop_name');
              const lineRef = cellAt(row, 'production_line_code');
              const stationRef = cellAt(row, 'workstation_code');
              const centerRef = cellAt(row, 'work_center_code');
              const workshop = workshopRef ? matchByCodeOrName(workshops, workshopRef) : undefined;
              const line = lineRef ? matchByCodeOrName(lines, lineRef) : undefined;
              const station = stationRef ? matchByCodeOrName(stations, stationRef) : undefined;
              const center = centerRef ? matchByCodeOrName(centers, centerRef) : undefined;

              const warrantyRaw = cellAt(row, 'warranty_period');
              const warrantyParsed = warrantyRaw ? Number(warrantyRaw) : NaN;
              const status = parseEquipmentDict('EQUIPMENT_STATUS', cellAt(row, 'status')) || '正常';
              const isActive = parseActive(cellAt(row, 'is_active'));

              items.push({
                code: cellAt(row, 'code') || undefined,
                name,
                type: parseEquipmentDict('EQUIPMENT_TYPE', cellAt(row, 'type')) || undefined,
                category: cellAt(row, 'category') || undefined,
                brand: cellAt(row, 'brand') || undefined,
                model: cellAt(row, 'model') || undefined,
                serial_number: cellAt(row, 'serial_number') || undefined,
                manufacturer: cellAt(row, 'manufacturer') || undefined,
                supplier: cellAt(row, 'supplier') || undefined,
                purchase_date: parseDate(cellAt(row, 'purchase_date')),
                installation_date: parseDate(cellAt(row, 'installation_date')),
                warranty_period: Number.isFinite(warrantyParsed) ? warrantyParsed : undefined,
                equipment_nature:
                  parseEquipmentDict('EQUIPMENT_NATURE', cellAt(row, 'equipment_nature')) || undefined,
                workshop_id: workshop?.id,
                workshop_name: workshop?.name ?? (workshopRef || undefined),
                production_line_id: line?.id,
                production_line_code: line?.code ?? (lineRef || undefined),
                production_line_name: line?.name,
                workstation_id: station?.id,
                workstation_code: station?.code ?? (stationRef || undefined),
                workstation_name: station?.name,
                work_center_id: center?.id,
                work_center_code: center?.code ?? (centerRef || undefined),
                work_center_name: center?.name,
                status,
                description: cellAt(row, 'description') || undefined,
                ...(isActive === undefined ? {} : { is_active: isActive }),
              });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaizhizao.equipment.importNoRows'));
              return;
            }
            const result = await importInChunksViaPerItemCreate({
              items,
              createOne: async (item, _index) => equipmentApi.create(item),
              title: t('app.kuaizhizao.equipment.importTitle'),
              chunkSize: 100,
              concurrency: 4,
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
          importColumnOptions={equipmentImportTemplate.importColumnOptions}
          importFieldMap={equipmentImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items: Equipment[] =
                type === 'currentPage' && pageData?.length
                  ? pageData
                  : await fetchAllListItems((p) => equipmentApi.list(p));
              if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const exportColumns = [
                { key: 'code', title: t('app.kuaizhizao.equipment.import.code') },
                { key: 'name', title: t('app.kuaizhizao.equipment.import.name') },
                { key: 'type', title: t('app.kuaizhizao.equipment.import.type') },
                { key: 'category', title: t('app.kuaizhizao.equipment.import.category') },
                { key: 'equipment_nature', title: t('app.kuaizhizao.equipment.import.nature') },
                { key: 'brand', title: t('app.kuaizhizao.equipment.import.brand') },
                { key: 'model', title: t('app.kuaizhizao.equipment.import.model') },
                { key: 'serial_number', title: t('app.kuaizhizao.equipment.fieldSerialNumber') },
                { key: 'workshop_name', title: t('app.kuaizhizao.equipment.fieldWorkshop') },
                { key: 'production_line_name', title: t('app.kuaizhizao.equipment.fieldProductionLine') },
                { key: 'work_center_name', title: t('app.kuaizhizao.equipment.fieldWorkCenter') },
                { key: 'status', title: t('app.kuaizhizao.equipment.fieldStatus') },
                { key: 'purchase_date', title: t('app.kuaizhizao.equipment.fieldPurchaseDate') },
                { key: 'installation_date', title: t('app.kuaizhizao.equipment.fieldInstallationDate') },
              ];
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `equipment-${todaySiteDateString()}.xlsx`,
                { columns: exportColumns, sheetName: t('app.kuaizhizao.equipment.title') },
              );
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          toolbar={{ actions: [equipmentCardToolbar] }}
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
              formItemProps={formDateFormItemProps}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label={t('app.kuaizhizao.equipment.fieldInstallationDate')}
              placeholder={t('app.kuaizhizao.equipment.phInstallationDate')}
              formItemProps={formDateFormItemProps}
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
            <DictionarySelect
              dictionaryCode="EQUIPMENT_NATURE"
              name="equipment_nature"
              label={t('app.kuaizhizao.equipment.fieldEquipmentNature')}
              placeholder={t('common.selectField', { field: t('app.kuaizhizao.equipment.fieldEquipmentNature') })}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="responsible_person_uuid"
              idFieldName="responsible_person_id"
              nameFieldName="responsible_person_name"
              label={t('app.kuaizhizao.equipment.fieldResponsiblePerson')}
              placeholder={t('app.kuaizhizao.equipment.phResponsiblePerson')}
              formRef={formRef}
            />
          </Col>
          <EquipmentFactoryBindingFields formRef={formRef} embedInParentRow />
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
            <ProFormUploadButton
              name="photo"
              label={t('app.kuaizhizao.equipment.fieldPhoto')}
              max={1}
              extra={t('app.kuaizhizao.equipment.fieldPhotoHint')}
              fieldProps={{
                listType: 'picture-card',
                accept: '.jpg,.jpeg,.png,.gif,.webp',
                beforeUpload: (file) => {
                  const isLt20M = (file.size ?? 0) / 1024 / 1024 < 20;
                  if (!isLt20M) {
                    messageApi.error(t('app.kuaizhizao.equipment.photoSizeLimit'));
                    return Upload.LIST_IGNORE;
                  }
                  return true;
                },
                customRequest: async (options) => {
                  try {
                    const res = await uploadMultipleFiles([options.file as File], {
                      category: 'equipment_photo',
                    });
                    options.onSuccess?.(res[0], options.file as any);
                  } catch (err) {
                    options.onError?.(err as Error);
                  }
                },
              }}
            />
          </Col>
          <Col span={24}>
            <DocumentAttachmentsField category="equipment_attachments" />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label={t('common.remark')}
              placeholder={t('app.kuaizhizao.equipment.phDescription')}
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('app.kuaizhizao.equipment.fieldIsActive')} />
          </Col>
        </Row>
      </FormModalTemplate>

      {PrintModal}
    </>
  );
};

export default EquipmentPage;

