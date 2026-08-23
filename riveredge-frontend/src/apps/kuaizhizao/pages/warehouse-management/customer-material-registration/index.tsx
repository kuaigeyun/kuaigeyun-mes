/**
 * 代工来料管理页面
 *
 * 支持普通登记与扫码登记，确认后写入客供库存。
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
  ProFormSelect,
  ProFormDatePicker,
  ProForm,
} from '@ant-design/pro-components';
import { App, Button, Space, Popconfirm, Row, Col, Typography, Segmented, Input, InputNumber, Form as AntForm, Table, Descriptions, Tag } from 'antd';
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ScanOutlined, RollbackOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate,   useDetailDrawerDescriptionItems, detailDrawerBasicColumn, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getCustomerMaterialRegistrationLifecycle } from '../../../utils/customerMaterialRegistrationLifecycle';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import dayjs from 'dayjs';
import { coerceFormDate, formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {formatDateTime, formatQuantity} from '../../../../../utils/format';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildCustomerMaterialRegistrationStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveCustomerMaterialRegistrationListParams,
} from '../../../utils/warehouseListCore';
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../master-data/services/material';
import { SerialNumbersImportTrigger } from '../../../../../components/serial-numbers-import';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

interface RegistrationItem {
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  quantity?: number;
  barcode?: string;
  batch_number?: string;
  serial_numbers?: string[];
  material_uuid?: string;
  batch_managed?: boolean;
  serial_managed?: boolean;
  default_batch_rule_id?: number;
  default_serial_rule_id?: number;
}

const defaultRegistrationItem: RegistrationItem = {
  quantity: 1,
  material_uuid: undefined,
  batch_managed: false,
  serial_managed: false,
  default_batch_rule_id: undefined,
  default_serial_rule_id: undefined,
  batch_number: undefined,
  serial_numbers: undefined,
};

interface CustomerMaterialRegistration {
  id?: number;
  uuid?: string;
  registration_code?: string;
  customer_id?: number;
  customer_name?: string;
  barcode?: string;
  barcode_type?: string;
  mapped_material_id?: number;
  mapped_material_code?: string;
  mapped_material_name?: string;
  quantity?: number;
  total_quantity?: number;
  registration_date?: string;
  registered_by_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  status?: string;
  processed_at?: string;
  processed_by_name?: string;
  remarks?: string;
  items?: RegistrationItem[];
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    confirm?: { allowed?: boolean; reason?: string };
    withdraw?: { allowed?: boolean; reason?: string };
    cancel?: { allowed?: boolean; reason?: string };
    delete?: { allowed?: boolean; reason?: string };
  };
}

const CustomerMaterialRegistrationPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [entryMode, setEntryMode] = useState<'scan' | 'document'>('document');
  const formRef = useRef<any>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentRegistration, setCurrentRegistration] = useState<CustomerMaterialRegistration | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [startProductionLoading, setStartProductionLoading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [generatingBatchIdx, setGeneratingBatchIdx] = useState<number | null>(null);
  const [generatingSerialIdx, setGeneratingSerialIdx] = useState<number | null>(null);
  const [scanBatchManaged, setScanBatchManaged] = useState(false);
  const [scanSerialManaged, setScanSerialManaged] = useState(false);
  const [scanMaterialUuid, setScanMaterialUuid] = useState<string | undefined>();
  const [scanDefaultBatchRuleId, setScanDefaultBatchRuleId] = useState<number | undefined>();
  const [scanDefaultSerialRuleId, setScanDefaultSerialRuleId] = useState<number | undefined>();
  const [generatingScanBatch, setGeneratingScanBatch] = useState(false);
  const [generatingScanSerial, setGeneratingScanSerial] = useState(false);
  const resourcePerms = useResourcePermissions('kuaizhizao:warehouse-management-customer-material-registration');
  const canStartProduction =
    !resourcePerms.enabled || (resourcePerms.canAction?.('execute') ?? false);

  const appendItemsFromMaterials = useCallback(
    async (selected: Material[]) => {
      const isEmptyItemRow = (row: RegistrationItem | undefined) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const rowFromMaterial = async (m: Material): Promise<RegistrationItem> => {
        const row: RegistrationItem = {
          ...defaultRegistrationItem,
          material_id: m.id,
          material_code: m.mainCode ?? m.code ?? '',
          material_name: m.name ?? '',
          material_spec: m.specification ?? '',
          material_unit: m.baseUnit ?? '',
          material_uuid: m.uuid,
          batch_managed: m.batchManaged ?? false,
          serial_managed: m.serialManaged ?? false,
          default_batch_rule_id: m.defaultBatchRuleId,
          default_serial_rule_id: m.defaultSerialRuleId,
        };
        if (m.uuid) {
          try {
            const full = await materialApi.get(m.uuid);
            return {
              ...row,
              batch_managed: full.batchManaged ?? false,
              serial_managed: full.serialManaged ?? false,
              default_batch_rule_id: full.defaultBatchRuleId,
              default_serial_rule_id: full.defaultSerialRuleId,
            };
          } catch {
            return row;
          }
        }
        return row;
      };
      const queue = await Promise.all(selected.map(rowFromMaterial));
      const items = [...(formRef.current?.getFieldValue('items') ?? [])].map((row: RegistrationItem) => ({
        ...row,
      }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      formRef.current?.setFieldsValue({ items });
      setMaterialPickerOpen(false);
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.itemsAdded', { count: selected.length }));
    },
    [messageApi, t],
  );

  const onMaterialSelectForBatchSerial = async (
    idx: number,
    _val: number | undefined,
    material: Material | undefined,
  ) => {
    if (!material) return;
    const uuid = material.uuid;
    let batchManaged = material.batchManaged ?? false;
    let serialManaged = material.serialManaged ?? false;
    let defaultBatchRuleId = material.defaultBatchRuleId;
    let defaultSerialRuleId = material.defaultSerialRuleId;
    if (uuid) {
      try {
        const full = await materialApi.get(uuid);
        batchManaged = full.batchManaged ?? false;
        serialManaged = full.serialManaged ?? false;
        defaultBatchRuleId = full.defaultBatchRuleId;
        defaultSerialRuleId = full.defaultSerialRuleId;
      } catch {
        // 使用列表返回字段
      }
    }
    formRef.current?.setFieldValue(['items', idx, 'material_uuid'], uuid);
    formRef.current?.setFieldValue(['items', idx, 'batch_managed'], batchManaged);
    formRef.current?.setFieldValue(['items', idx, 'serial_managed'], serialManaged);
    formRef.current?.setFieldValue(['items', idx, 'default_batch_rule_id'], defaultBatchRuleId);
    formRef.current?.setFieldValue(['items', idx, 'default_serial_rule_id'], defaultSerialRuleId);
  };

  const onScanMaterialSelect = async (_val: number | undefined, material: Material | undefined) => {
    if (!material) {
      setScanMaterialUuid(undefined);
      setScanBatchManaged(false);
      setScanSerialManaged(false);
      return;
    }
    const uuid = material.uuid;
    let batchManaged = material.batchManaged ?? false;
    let serialManaged = material.serialManaged ?? false;
    let defaultBatchRuleId = material.defaultBatchRuleId;
    let defaultSerialRuleId = material.defaultSerialRuleId;
    if (uuid) {
      try {
        const full = await materialApi.get(uuid);
        batchManaged = full.batchManaged ?? false;
        serialManaged = full.serialManaged ?? false;
        defaultBatchRuleId = full.defaultBatchRuleId;
        defaultSerialRuleId = full.defaultSerialRuleId;
      } catch {
        // 使用列表返回字段
      }
    }
    setScanMaterialUuid(uuid);
    setScanBatchManaged(batchManaged);
    setScanSerialManaged(serialManaged);
    setScanDefaultBatchRuleId(defaultBatchRuleId);
    setScanDefaultSerialRuleId(defaultSerialRuleId);
  };

  const handleGenerateBatch = async (idx: number) => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const row = items[idx];
    if (!row?.material_uuid) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectMaterialFirst'));
      return;
    }
    setGeneratingBatchIdx(idx);
    try {
      const res = await materialBatchApi.generate(row.material_uuid, {
        ruleId: row.default_batch_rule_id,
      });
      formRef.current?.setFieldValue(['items', idx, 'batch_number'], res.batch_no);
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.batchGenerated'));
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('app.kuaizhizao.customerMaterialRegistration.batchGenerateFailed'));
    } finally {
      setGeneratingBatchIdx(null);
    }
  };

  const handleGenerateSerials = async (idx: number): Promise<string[]> => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const row = items[idx];
    if (!row?.material_uuid) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectMaterialFirst'));
      return [];
    }
    const count = Math.max(1, Math.floor(Number(row.quantity) || 1));
    if (count > 100) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.serialMax100'));
      return [];
    }
    setGeneratingSerialIdx(idx);
    try {
      const res = await materialSerialApi.generate(row.material_uuid, count, {
        ruleId: row.default_serial_rule_id,
      });
      const serialNos = res.serial_nos ?? [];
      formRef.current?.setFieldValue(['items', idx, 'serial_numbers'], serialNos);
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.serialGenerated', { count: res.count }));
      return serialNos;
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('app.kuaizhizao.customerMaterialRegistration.serialGenerateFailed'));
      return [];
    } finally {
      setGeneratingSerialIdx(null);
    }
  };

  const handleGenerateScanBatch = async () => {
    if (!scanMaterialUuid) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectMaterialFirst'));
      return;
    }
    setGeneratingScanBatch(true);
    try {
      const res = await materialBatchApi.generate(scanMaterialUuid, { ruleId: scanDefaultBatchRuleId });
      formRef.current?.setFieldValue('batch_number', res.batch_no);
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.batchGenerated'));
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('app.kuaizhizao.customerMaterialRegistration.batchGenerateFailed'));
    } finally {
      setGeneratingScanBatch(false);
    }
  };

  const handleGenerateScanSerials = async (): Promise<string[]> => {
    if (!scanMaterialUuid) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectMaterialFirst'));
      return [];
    }
    const count = Math.max(1, Math.floor(Number(formRef.current?.getFieldValue('quantity') || 1)));
    if (count > 100) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.serialMax100'));
      return [];
    }
    setGeneratingScanSerial(true);
    try {
      const res = await materialSerialApi.generate(scanMaterialUuid, count, {
        ruleId: scanDefaultSerialRuleId,
      });
      const serialNos = res.serial_nos ?? [];
      formRef.current?.setFieldValue('serial_numbers', serialNos);
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.serialGenerated', { count: res.count }));
      return serialNos;
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('app.kuaizhizao.customerMaterialRegistration.serialGenerateFailed'));
      return [];
    } finally {
      setGeneratingScanSerial(false);
    }
  };

  const buildCreatePayload = (values: any) => {
    if (!values.customer_id) {
      messageApi.error(t('app.kuaizhizao.customerMaterialRegistration.selectCustomer'));
      throw new Error('no customer');
    }
    const payload: any = {
      customer_id: Number(values.customer_id),
      customer_name: values.customer_name || '',
      registration_date: coerceFormDate(values.registration_date)?.format('YYYY-MM-DD HH:mm:ss'),
      warehouse_id: values.warehouse_id,
      warehouse_name: values.warehouse_name,
      remarks: values.remarks,
      attachments: normalizeDocumentAttachments(values.attachments),
    };

    if (entryMode === 'document') {
      const validItems = (values.items || []).filter(
        (it: RegistrationItem) => it.material_id && (it.quantity || 0) > 0
      );
      if (!validItems.length) {
        messageApi.error(t('app.kuaizhizao.customerMaterialRegistration.minOneValidItem'));
        throw new Error('no items');
      }
      payload.items = validItems.map((it: RegistrationItem) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quantity: it.quantity,
        barcode: it.barcode,
        batch_number: it.batch_number || undefined,
        serial_numbers: it.serial_numbers || undefined,
      }));
    } else {
      if (!values.material_id) {
        messageApi.error(t('app.kuaizhizao.customerMaterialRegistration.selectMaterialOrCreate'));
        throw new Error('no material');
      }
      payload.barcode = values.barcode;
      payload.barcode_type = values.barcode_type || '1d';
      payload.quantity = values.quantity;
      payload.batch_number = values.batch_number;
      payload.serial_numbers = values.serial_numbers || undefined;
      payload.material_id = values.material_id;
      payload.material_code = values.material_code;
      payload.material_name = values.material_name;
    }
    return payload;
  };

  const handleCreate = async () => {
    setCreateModalVisible(true);
    setEntryMode('document');
    setScanMaterialUuid(undefined);
    setScanBatchManaged(false);
    setScanSerialManaged(false);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        registration_date: dayjs(),
        barcode_type: '1d',
        items: [{ ...defaultRegistrationItem }],
      });
    }, 0);
  };
  useNewShortcut(() => {
    void handleCreate();
  });
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.customerMaterialRegistration.createButton')),
    [t],
  );

  const handleScanBarcode = async (barcode: string) => {
    try {
      setScanning(true);
      const result = await customerMaterialRegistrationApi.parseBarcode({
        barcode,
        barcode_type: formRef.current?.getFieldValue('barcode_type') || '1d',
        customer_id: formRef.current?.getFieldValue('customer_id'),
      });
      if (result.mapped_material_id) {
        formRef.current?.setFieldsValue({
          material_id: result.mapped_material_id,
          material_code: result.mapped_material_code,
          material_name: result.mapped_material_name,
        });
        messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.barcodeMatched'));
      } else {
        messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.barcodeNotMatched'));
      }
    } catch (error: any) {
      messageApi.warning(error.message || t('app.kuaizhizao.customerMaterialRegistration.barcodeParseFailed'));
    } finally {
      setScanning(false);
    }
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      setSubmitLoading(true);
      const payload = buildCreatePayload(values);
      const created = await customerMaterialRegistrationApi.create(payload);
      if (!created?.id) {
        throw new Error(t('app.kuaizhizao.customerMaterialRegistration.createFailed'));
      }
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.draftSaved'));
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message !== 'no items' && error?.message !== 'no material' && error?.message !== 'no customer') {
        messageApi.error(error.message || t('app.kuaizhizao.customerMaterialRegistration.inboundFailed'));
      }
      throw error;
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStartProduction = async () => {
    try {
      setStartProductionLoading(true);
      const values = await formRef.current?.validateFields();
      const payload = buildCreatePayload(values);
      const result = await customerMaterialRegistrationApi.createAndStartProduction(payload);
      const woLabel = result.work_order_group_code
        ? t('app.kuaizhizao.customerMaterialRegistration.workOrderGroup', { code: result.work_order_group_code })
        : (result.work_order_codes || []).join('、') || t('app.kuaizhizao.warehouseCommon.notApplicable');
      const batchLabel = (result.batching_order_codes || []).join('、');
      messageApi.success(
        t('app.kuaizhizao.customerMaterialRegistration.startProductionSuccess', {
          registration: result.registration?.registration_code || '',
          workOrder: woLabel,
          batching: batchLabel
            ? t('app.kuaizhizao.customerMaterialRegistration.batchingOrders', { codes: batchLabel })
            : '',
        }),
      );
      if (result.warnings?.length) {
        messageApi.warning(result.warnings.join('；'));
      }
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message !== 'no items' && error?.message !== 'no material' && error?.message !== 'no customer') {
        messageApi.error(error.message || t('app.kuaizhizao.customerMaterialRegistration.startProductionFailed'));
      }
    } finally {
      setStartProductionLoading(false);
    }
  };

  const handleDetail = async (record: CustomerMaterialRegistration) => {
    if (!record.id) return;
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setCurrentRegistration(null);
    try {
      const detail = await customerMaterialRegistrationApi.get(record.id.toString());
      setCurrentRegistration(detail);
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.loadFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcess = async (record: CustomerMaterialRegistration) => {
    try {
      await customerMaterialRegistrationApi.process(record.id!.toString());
      messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.processSuccess'));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.customerMaterialRegistration.processFailed'));
    }
  };

  const handleWithdraw = async (record: CustomerMaterialRegistration) => {
    await customerMaterialRegistrationApi.withdraw(record.id!.toString());
    messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.withdrawSuccess'));
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const handleCancel = async (record: CustomerMaterialRegistration) => {
    await customerMaterialRegistrationApi.cancel(record.id!.toString());
    messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.cancelSuccess'));
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const handleDelete = async (record: CustomerMaterialRegistration) => {
    try {
      await customerMaterialRegistrationApi.delete(record.id!.toString());
      messageApi.success(t('common.deleteSuccess'));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
    }
  };

  const listRowsRef = useRef<Map<string, CustomerMaterialRegistration>>(new Map());
  const isCustomerMaterialDeletable = (record: CustomerMaterialRegistration) =>
    !!record.id && record.capabilities?.delete?.allowed === true;

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = keys
      .map((k) => listRowsRef.current.get(String(k)))
      .filter((r): r is CustomerMaterialRegistration => !!r && isCustomerMaterialDeletable(r))
      .map((r) => r.id!);
    if (ids.length === 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.batchDeleteNoneDeletable'));
      return;
    }
    try {
      await customerMaterialRegistrationApi.batchDelete(ids);
      messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: ids.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  const registrationStatusValueEnum = useMemo(() => buildCustomerMaterialRegistrationStatusValueEnum(t), [t]);

  const columns: ProColumns<CustomerMaterialRegistration>[] = useMemo(() => alignProColumns<CustomerMaterialRegistration>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: registrationStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRegistrationDate'),
      dataIndex: 'registration_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colCode'),
      dataIndex: 'registration_code',
      width: 150,
      fixed: 'left',
      sorter: true,
      search: { order: 40 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.registration_code ?? '') }} ellipsis>
          {r.registration_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colCustomer'),
      dataIndex: 'customer_name',
      width: 140,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'),
      dataIndex: 'work_order_code',
      width: 120,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
      dataIndex: 'mapped_material_name',
      width: 140,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('common.quantity'),
      dataIndex: 'total_quantity',
      width: 90,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => formatQuantity(r.total_quantity ?? r.quantity),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRegistrationDate'),
      dataIndex: 'registration_date',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.registration_date ? formatDateTime(r.registration_date) : '-'),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      hideInTable: true,
      hideInSearch: true,
    },
    ...buildDocumentAuditColumns<CustomerMaterialRegistration>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getCustomerMaterialRegistrationLifecycle(record as Record<string, unknown>, t);
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
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.capabilities?.confirm?.allowed && (resourcePerms.canAction?.('execute') ?? false) && (
            <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.confirmProcess')} onConfirm={() => handleProcess(record)}>
              <Button {...rowActionKind('execute')} {...rowActionLabelKeep()}>
                {t('app.kuaizhizao.customerMaterialRegistration.confirmInbound')}
              </Button>
            </Popconfirm>
          )}
          {record.capabilities?.cancel?.allowed && (resourcePerms.canAction?.('reject') ?? false) && (
            <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.confirmCancel')} onConfirm={() => handleCancel(record)}>
              <Button {...rowActionKind('reject')} {...rowActionLabelKeep()}>
                {t('common.cancel')}
              </Button>
            </Popconfirm>
          )}
          {record.capabilities?.withdraw?.allowed && (resourcePerms.canAction?.('revoke') ?? false) && (
            <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.confirmWithdraw')} onConfirm={() => handleWithdraw(record)}>
              <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()}>
                {t('app.kuaizhizao.customerMaterialRegistration.withdraw')}
              </Button>
            </Popconfirm>
          )}
          {record.capabilities?.delete?.allowed && resourcePerms.canDelete && (
            <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.deleteConfirmOne')} onConfirm={() => handleDelete(record)}>
              <Button {...rowActionKind('delete')} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK), [t, resourcePerms, registrationStatusValueEnum]);

  const detailBasicColumns = useMemo(() => alignDescriptionColumns([
    { title: t('app.kuaizhizao.warehouseCommon.colCode'), dataIndex: 'registration_code' },
    { title: t('app.kuaizhizao.warehouseCommon.colCustomer'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'), dataIndex: 'work_order_code', key: 'linked_work_order_code' },
    { title: t('app.kuaizhizao.warehouseCommon.colSalesOrder'), dataIndex: 'sales_order_code' },
    { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRegistrationDate'),
      dataIndex: 'registration_date',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colTotalQuantity'),
      dataIndex: 'total_quantity',
      render: (_, record) => formatQuantity(record.total_quantity ?? record.quantity),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, record) => {
        const status = String(record.status ?? '');
        const label =
          status === 'pending'
            ? t('app.kuaizhizao.warehouseCommon.statusPendingInbound')
            : status === 'processed'
              ? t('app.kuaizhizao.warehouseCommon.statusInbound')
              : status === 'cancelled'
                ? t('app.kuaizhizao.warehouseCommon.statusCancelled')
                : status || '-';
        const color =
          status === 'processed' ? 'success' : status === 'cancelled' ? 'default' : 'warning';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    { title: t('app.kuaizhizao.warehouseCommon.colConfirmedBy'), dataIndex: 'processed_by_name' },
    {
      title: t('app.kuaizhizao.warehouseCommon.colExecutedAt'),
      dataIndex: 'processed_at',
      valueType: 'dateTime',
    },
    { title: t('common.remark'), dataIndex: 'remarks', span: 3 },
  ]), [t]);

  const detailItemColumns = useMemo(() => [
    { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colMaterialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colSpec'), dataIndex: 'material_spec', width: 100, ellipsis: true },
    { title: t('common.unit'), dataIndex: 'material_unit', width: 70 },
    { title: t('common.quantity'), dataIndex: 'quantity', width: 90, align: 'right' as const , render: formatQuantity },
    { title: t('app.kuaizhizao.warehouseCommon.colBatchNo'), dataIndex: 'batch_number', width: 120, ellipsis: true },
    {
      title: t('app.kuaizhizao.warehouseCommon.colSerialNo'),
      dataIndex: 'serial_numbers',
      width: 140,
      ellipsis: true,
      render: (val: unknown) => {
        const list = Array.isArray(val) ? val : [];
        return list.length > 0 ? list.join('、') : t('app.kuaizhizao.warehouseCommon.notApplicable');
      },
    },
  ], [t]);

  const detailCollaboration = useMemo(() => {
    if (!currentRegistration) return undefined;
    const lifecycle = getCustomerMaterialRegistrationLifecycle(currentRegistration as Record<string, unknown>, t);
    const mainStages = lifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
      />
    );
  }, [currentRegistration, t]);

  const formItemColumns = useMemo(() => [
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
      dataIndex: 'material_id',
      width: 220,
      render: (_: unknown, __: unknown, index: number) => (
        <AntForm.Item
          noStyle
          shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
        >
          {({ getFieldValue }) => {
            const row = getFieldValue('items')?.[index];
            const mid = row?.material_id ? Number(row.material_id) : null;
            const fallback =
              mid && (row?.material_code || row?.material_name)
                ? {
                    value: mid,
                    label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
                  }
                : undefined;
            return (
              <div className="uni-detail-material-cell">
                <UniMaterialSelect
                  name={[index, 'material_id']}
                  label=""
                  placeholder={t('app.kuaizhizao.customerMaterialRegistration.selectIncomingMaterial')}
                  required
                  size="small"
                  listFieldKey={index}
                  listFieldName="items"
                  fillMapping={{
                    material_code: 'mainCode',
                    material_name: 'name',
                    material_spec: 'specification',
                    material_unit: 'baseUnit',
                  }}
                  fallbackOption={fallback}
                  formItemProps={{ style: { margin: 0 } }}
                  showQuickCreate
                  showAdvancedSearch
                  onChange={(v, m) => void onMaterialSelectForBatchSerial(index, v, m as Material | undefined)}
                />
                <AntForm.Item name={[index, 'material_code']} hidden />
                <AntForm.Item name={[index, 'material_name']} hidden />
              </div>
            );
          }}
        </AntForm.Item>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colSpec'),
      dataIndex: 'material_spec',
      width: 120,
      ellipsis: true,
      render: (_: unknown, __: unknown, index: number) => (
        <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
          <Input placeholder={t('app.kuaizhizao.warehouseCommon.colSpec')} size="small" readOnly />
        </AntForm.Item>
      ),
    },
    {
      title: t('common.unit'),
      dataIndex: 'material_unit',
      width: 90,
      render: (_: unknown, __: unknown, index: number) => (
        <AntForm.Item
          noStyle
          shouldUpdate={(prev, curr) =>
            prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
          }
        >
          {({ getFieldValue }) => {
            const materialId = getFieldValue(['items', index, 'material_id']);
            return (
              <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                <MaterialUnitSelect materialId={materialId} size="small" noStyle />
              </AntForm.Item>
            );
          }}
        </AntForm.Item>
      ),
    },
    {
      title: t('common.quantity'),
      dataIndex: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <AntForm.Item
          name={[index, 'quantity']}
          rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.required') }]}
          style={{ margin: 0 }}
        >
          <InputNumber min={0} precision={2} style={{ width: '100%' }} size="small" />
        </AntForm.Item>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colBatchNo'),
      dataIndex: 'batch_number',
      width: 130,
      render: (_: unknown, __: unknown, index: number) => (
        <AntForm.Item
          noStyle
          shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
        >
          {({ getFieldValue }) => {
            const row = getFieldValue('items')?.[index];
            if (!row?.batch_managed) return t('app.kuaizhizao.warehouseCommon.notApplicable');
            return (
              <Space size={2}>
                <AntForm.Item name={[index, 'batch_number']} style={{ margin: 0 }}>
                  <Input placeholder={t('app.kuaizhizao.warehouseCommon.optional')} size="small" style={{ width: 96 }} />
                </AntForm.Item>
                <Button
                  type="link"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={generatingBatchIdx === index}
                  onClick={() => void handleGenerateBatch(index)}
                  style={{ padding: 0 }}
                />
              </Space>
            );
          }}
        </AntForm.Item>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colSerialNo'),
      dataIndex: 'serial_numbers',
      width: 150,
      render: (_: unknown, __: unknown, index: number) => (
        <AntForm.Item
          noStyle
          shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
        >
          {({ getFieldValue }) => {
            const row = getFieldValue('items')?.[index];
            if (!row?.serial_managed) return t('app.kuaizhizao.warehouseCommon.notApplicable');
            const qty = Number(row?.quantity ?? 0);
            const sn = getFieldValue(['items', index, 'serial_numbers']);
            return (
              <SerialNumbersImportTrigger
                serials={Array.isArray(sn) ? sn : []}
                expectedCount={qty > 0 ? qty : undefined}
                materialLabel={row?.material_code || row?.material_name}
                generateLoading={generatingSerialIdx === index}
                onSerialsChange={(next) =>
                  formRef.current?.setFieldValue(['items', index, 'serial_numbers'], next)
                }
                onGenerate={() => handleGenerateSerials(index)}
              />
            );
          }}
        </AntForm.Item>
      ),
    },
  ], [t, generatingBatchIdx, generatingSerialIdx]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBasicColumns,
    currentRegistration,
    'customer_material_registration',
  );

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.customerMaterialRegistration.headerTitle')}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.customer-material-registration"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.customerMaterialRegistration')}
        showAdvancedSearch
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        showCreateButton
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        onTableDataChange={(rows) => {
          const next = new Map<string, CustomerMaterialRegistration>();
          for (const row of rows) {
            if (row.id != null) next.set(String(row.id), row);
          }
          listRowsRef.current = next;
        }}
        enableRowSelection={resourcePerms.canDelete}
        showDeleteButton={resourcePerms.canDelete}
        rowSelectionGetCheckboxProps={(record) => ({
          disabled: !isCustomerMaterialDeletable(record),
        })}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) =>
          t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', {
            count,
            noun: t('app.kuaizhizao.customerMaterialRegistration.headerTitle'),
          })
        }
        request={async (params, sort, _filter, searchFormValues) => {
          const pageSize = params.pageSize || 20;
          const skip = ((params.current ?? 1) - 1) * pageSize;
          const listParams = resolveCustomerMaterialRegistrationListParams(searchFormValues, sort);
          const result = await customerMaterialRegistrationApi.list({
            skip,
            limit: pageSize,
            ...listParams,
          });
          const { data, total } = normalizeWarehouseListResponse(result);
          return { data, success: true, total };
        }}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.customerMaterialRegistration.modalTitle')}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        grid={false}
        loading={submitLoading || startProductionLoading}
        submitText={t('app.kuaizhizao.customerMaterialRegistration.submitDraft')}
        extraFooter={
          canStartProduction ? (
            <Button type="default" loading={startProductionLoading} onClick={() => void handleStartProduction()}>
              {t('app.kuaizhizao.customerMaterialRegistration.startProduction')}
            </Button>
          ) : null
        }
      >
        <Segmented
          options={[
            { label: t('app.kuaizhizao.customerMaterialRegistration.entryDocument'), value: 'document' },
            { label: t('app.kuaizhizao.customerMaterialRegistration.entryScan'), value: 'scan' },
          ]}
          value={entryMode}
          onChange={(v) => {
            const mode = v as 'scan' | 'document';
            setEntryMode(mode);
            if (mode === 'document' && !(formRef.current?.getFieldValue('items') || []).length) {
              formRef.current?.setFieldsValue({ items: [{ ...defaultRegistrationItem }] });
            }
          }}
          style={{ marginBottom: 16 }}
        />
        <Row gutter={16}>
            <Col span={12}>
            <ProForm.Item
              name="customer_id"
              label={t('app.kuaizhizao.warehouseCommon.colCustomer')}
              rules={[{ required: true, message: t('app.kuaizhizao.customerMaterialRegistration.selectCustomer') }]}
            >
              <CustomerSelectDropdown
                hostResource="kuaizhizao:warehouse-management-customer-material-registration"
                placeholder={t('app.kuaizhizao.customerMaterialRegistration.selectCustomer')}
                style={{ width: '100%' }}
                onCustomerPick={(c) => {
                  formRef.current?.setFieldsValue({
                    customer_name: c?.name ?? (c as { customer_name?: string })?.customer_name,
                  });
                }}
              />
            </ProForm.Item>
            <AntForm.Item name="customer_name" hidden />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.customerMaterialRegistration.inboundWarehouse')}
              placeholder={t('app.kuaizhizao.customerMaterialRegistration.selectInboundWarehouse')}
              required
              onChange={(_val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
            />
            <AntForm.Item name="warehouse_name" hidden />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="registration_date"
              label={t('app.kuaizhizao.warehouseCommon.colRegistrationDate')}
              rules={[{ required: true }]}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
        </Row>

        {entryMode === 'scan' ? (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormText
                  name="barcode"
                  label={t('app.kuaizhizao.customerMaterialRegistration.customerBarcode')}
                  rules={[{ required: true }]}
                  fieldProps={{
                    onBlur: (e: any) => e.target.value && handleScanBarcode(e.target.value),
                    suffix: scanning ? <ScanOutlined spin /> : null,
                  }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="barcode_type"
                  label={t('app.kuaizhizao.barcodeMapping.colBarcodeType')}
                  options={[
                    { label: t('app.kuaizhizao.warehouseCommon.barcodeType1d'), value: '1d' },
                    { label: t('app.kuaizhizao.warehouseCommon.barcodeType2d'), value: '2d' },
                  ]}
                />
              </Col>
            </Row>
            <UniMaterialSelect
              name="material_id"
              label={t('app.kuaizhizao.customerMaterialRegistration.incomingMaterial')}
              placeholder={t('app.kuaizhizao.customerMaterialRegistration.selectIncomingMaterial')}
              required
              showQuickCreate
              showAdvancedSearch
              fillMapping={{
                material_code: 'mainCode',
                material_name: 'name',
              }}
              onChange={(v, m) => void onScanMaterialSelect(v, m as Material | undefined)}
            />
            <AntForm.Item name="material_code" hidden />
            <AntForm.Item name="material_name" hidden />
            <Row gutter={16}>
              <Col span={12}>
                <ProFormDigit name="quantity" label={t('app.kuaizhizao.customerMaterialRegistration.incomingQty')} rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
              </Col>
              <Col span={12}>
                {scanBatchManaged ? (
                  <ProForm.Item label={t('app.kuaizhizao.warehouseCommon.colBatchNo')}>
                    <Space size={4}>
                      <ProFormText name="batch_number" noStyle fieldProps={{ placeholder: t('app.kuaizhizao.warehouseCommon.optional') }} />
                      <Button
                        type="link"
                        icon={<ThunderboltOutlined />}
                        loading={generatingScanBatch}
                        onClick={() => void handleGenerateScanBatch()}
                      />
                    </Space>
                  </ProForm.Item>
                ) : (
                  <ProFormText name="batch_number" label={t('app.kuaizhizao.warehouseCommon.colBatchNo')} fieldProps={{ placeholder: t('app.kuaizhizao.warehouseCommon.notApplicable') }} disabled />
                )}
              </Col>
            </Row>
            {scanSerialManaged ? (
              <ProForm.Item label={t('app.kuaizhizao.warehouseCommon.colSerialNo')} shouldUpdate>
                {({ getFieldValue }) => {
                  const qty = Number(getFieldValue('quantity') ?? 0);
                  const sn = getFieldValue('serial_numbers');
                  return (
                    <SerialNumbersImportTrigger
                      serials={Array.isArray(sn) ? sn : []}
                      expectedCount={qty > 0 ? qty : undefined}
                      materialLabel={getFieldValue('material_code') || getFieldValue('material_name')}
                      generateLoading={generatingScanSerial}
                      onSerialsChange={(next) => formRef.current?.setFieldValue('serial_numbers', next)}
                      onGenerate={() => handleGenerateScanSerials()}
                    />
                  );
                }}
              </ProForm.Item>
            ) : null}
            <AntForm.Item name="serial_numbers" hidden />
          </>
        ) : (
          <UniTableDetail
            name="items"
            title={t('app.kuaizhizao.customerMaterialRegistration.itemsTitle')}
            required
            requiredMessage={t('app.kuaizhizao.customerMaterialRegistration.minOneItem')}
            initialValue={{ ...defaultRegistrationItem }}
            containerStyle={{ width: '100%' }}
            onBatchSelect={() => setMaterialPickerOpen(true)}
            columns={formItemColumns}
          />
        )}
        <DocumentAttachmentsField category="customer_material_registration_attachments" />
        <ProFormTextArea name="remarks" label={t('common.remark')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
        hostResource="kuaizhizao:warehouse-management-customer-material-registration"
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.customerMaterialRegistration.detailTitle')}${currentRegistration?.registration_code ? ` - ${currentRegistration.registration_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRegistration(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          currentRegistration ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        collaboration={detailCollaboration}
        linesTitle={t('app.kuaizhizao.customerMaterialRegistration.itemsTitle')}
        lines={
          currentRegistration?.items && currentRegistration.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey={(r) => String(r.id ?? `${r.material_id}-${r.material_code}`)}
                pagination={false}
                dataSource={currentRegistration.items}
                columns={detailItemColumns}
              />
            </>
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default CustomerMaterialRegistrationPage;
