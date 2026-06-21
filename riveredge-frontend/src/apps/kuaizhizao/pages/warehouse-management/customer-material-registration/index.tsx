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
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
  ProFormSelect,
  ProFormDatePicker,
  ProForm,
} from '@ant-design/pro-components';
import { App, Button, Space, Popconfirm, Row, Col, Typography, Segmented, Input, InputNumber, Form as AntForm, Table } from 'antd';
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ScanOutlined, RollbackOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
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
import { UniBatchButton } from '../../../../../components/uni-batch';
import {
  customerMaterialBatchCancelAllowed,
  customerMaterialBatchConfirmAllowed,
  customerMaterialBatchWithdrawAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import dayjs from 'dayjs';
import { coerceFormDate } from '../../../../../utils/formDate';
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../master-data/services/material';
import { SerialNumbersImportTrigger } from '../../../../../components/serial-numbers-import';

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
  };
}

const CustomerMaterialRegistrationPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<CustomerMaterialRegistration[]>([]);
  const [listVersion, setListVersion] = useState(0);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [entryMode, setEntryMode] = useState<'scan' | 'document'>('document');
  const formRef = useRef<any>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
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

  const selectedRegistrationsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is CustomerMaterialRegistration => row != null),
    [selectedRowKeys, listVersion],
  );

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
    const detail = await customerMaterialRegistrationApi.get(record.id!.toString());
    setCurrentRegistration(detail);
    setDetailDrawerVisible(true);
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

  const handleBatchProcess = async () => {
    if (!selectedRowKeys.length) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectRecordsFirst'));
      return;
    }
    try {
      const result = await customerMaterialRegistrationApi.batchProcess(selectedRowKeys);
      const successCount = Number(result?.success_count || 0);
      if (successCount > 0) {
        messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.batchProcessSuccess', { count: successCount }));
        invalidateMenuBadgeCounts();
        setSelectedRowKeys([]);
        actionRef.current?.reload();
        return;
      }
      messageApi.error(t('app.kuaizhizao.customerMaterialRegistration.batchProcessFailed'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.customerMaterialRegistration.batchProcessFailed'));
    }
  };

  const handleBatchWithdraw = async () => {
    if (!selectedRowKeys.length) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectRecordsFirst'));
      return;
    }
    try {
      const result = await customerMaterialRegistrationApi.batchWithdraw(selectedRowKeys);
      const successCount = Number(result?.success_count || 0);
      if (successCount > 0) {
        messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.batchWithdrawSuccess', { count: successCount }));
        invalidateMenuBadgeCounts();
        setSelectedRowKeys([]);
        actionRef.current?.reload();
        return;
      }
      messageApi.error(t('app.kuaizhizao.customerMaterialRegistration.batchWithdrawFailed'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.customerMaterialRegistration.batchWithdrawFailed'));
    }
  };

  const handleBatchCancel = async () => {
    if (!selectedRowKeys.length) {
      messageApi.warning(t('app.kuaizhizao.customerMaterialRegistration.selectRecordsFirst'));
      return;
    }
    try {
      const result = await customerMaterialRegistrationApi.batchCancel(selectedRowKeys);
      const successCount = Number(result?.success_count || 0);
      if (successCount > 0) {
        messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.batchCancelSuccess', { count: successCount }));
        invalidateMenuBadgeCounts();
        setSelectedRowKeys([]);
        actionRef.current?.reload();
        return;
      }
      messageApi.error(t('app.kuaizhizao.customerMaterialRegistration.batchCancelFailed'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.customerMaterialRegistration.batchCancelFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      const result = await customerMaterialRegistrationApi.batchDelete(keys);
      const successCount = Number(result?.success_count || 0);
      if (successCount > 0) {
        messageApi.success(t('app.kuaizhizao.customerMaterialRegistration.batchDeleteSuccess', { count: successCount }));
        invalidateMenuBadgeCounts();
        setSelectedRowKeys([]);
        actionRef.current?.reload();
        return;
      }
      messageApi.error(t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  const columns: ProColumns<CustomerMaterialRegistration>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.warehouseCommon.colCode'),
      dataIndex: 'registration_code',
      width: 150,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.registration_code ?? '') }} ellipsis>
          {r.registration_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.warehouseCommon.colCustomer'), dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'), dataIndex: 'work_order_code', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colMaterial'), dataIndex: 'mapped_material_name', width: 140, ellipsis: true, hideInSearch: true },
    {
      title: t('app.kuaizhizao.warehouseCommon.colQuantity'),
      dataIndex: 'total_quantity',
      width: 90,
      align: 'right',
      render: (_, r) => r.total_quantity ?? r.quantity ?? '-',
    },
    { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: t('app.kuaizhizao.warehouseCommon.colRegistrationDate'),
      dataIndex: 'registration_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: {
        pending: { text: t('app.kuaizhizao.warehouseCommon.statusPendingInbound'), status: 'warning' },
        processed: { text: t('app.kuaizhizao.warehouseCommon.statusInbound'), status: 'success' },
        cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled'), status: 'error' },
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getCustomerMaterialRegistrationLifecycle(record as Record<string, unknown>);
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
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'pending' && (
            <>
              <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.confirmProcess')} onConfirm={() => handleProcess(record)}>
                <Button {...rowActionKind('execute')} {...rowActionLabelKeep()}>
                  {t('app.kuaizhizao.customerMaterialRegistration.confirmInbound')}
                </Button>
              </Popconfirm>
              <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.confirmCancel')} onConfirm={() => handleCancel(record)}>
                <Button {...rowActionKind('reject')} {...rowActionLabelKeep()}>
                  {t('app.kuaizhizao.warehouseCommon.cancel')}
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'processed' && (
            <Popconfirm title={t('app.kuaizhizao.customerMaterialRegistration.confirmWithdraw')} onConfirm={() => handleWithdraw(record)}>
              <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()}>
                {t('app.kuaizhizao.customerMaterialRegistration.withdraw')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t]);

  const detailColumns = useMemo(() => [
    { title: t('app.kuaizhizao.warehouseCommon.colCode'), dataIndex: 'registration_code' },
    { title: t('app.kuaizhizao.warehouseCommon.colCustomer'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'), dataIndex: 'work_order_code' },
    { title: t('app.kuaizhizao.warehouseCommon.colSalesOrder'), dataIndex: 'sales_order_code' },
    { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
    { title: t('app.kuaizhizao.warehouseCommon.colTotalQuantity'), dataIndex: 'total_quantity' },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      valueEnum: {
        pending: { text: t('app.kuaizhizao.warehouseCommon.statusPendingInbound') },
        processed: { text: t('app.kuaizhizao.warehouseCommon.statusInbound') },
        cancelled: { text: t('app.kuaizhizao.warehouseCommon.statusCancelled') },
      },
    },
    { title: t('app.kuaizhizao.warehouseCommon.colConfirmedBy'), dataIndex: 'processed_by_name' },
    { title: t('app.kuaizhizao.warehouseCommon.colRemarks'), dataIndex: 'remarks' },
  ], [t]);

  const detailItemColumns = useMemo(() => [
    { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colMaterialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colSpec'), dataIndex: 'material_spec', width: 100, ellipsis: true },
    { title: t('app.kuaizhizao.warehouseCommon.colUnit'), dataIndex: 'material_unit', width: 70 },
    { title: t('app.kuaizhizao.warehouseCommon.colQuantity'), dataIndex: 'quantity', width: 90, align: 'right' as const },
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
      title: t('app.kuaizhizao.warehouseCommon.colUnit'),
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
      title: t('app.kuaizhizao.warehouseCommon.colQuantity'),
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

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.customerMaterialRegistration.headerTitle')}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.customer-material-registration"
        showAdvancedSearch
        showCreateButton
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.customerMaterialRegistration.deleteConfirm', { count })}
        toolBarActionsAfterBatch={[
          <UniBatchButton
            key="batch-process"
            selectedRowKeys={selectedRowKeys}
            disabled={
              selectedRegistrationsForBatch.length > 0 &&
              !customerMaterialBatchConfirmAllowed(
                selectedRegistrationsForBatch,
                resourcePerms.canAction?.('execute') ?? false,
              )
            }
            onAction={() => void handleBatchProcess()}
          >
            {t('app.kuaizhizao.customerMaterialRegistration.batchConfirmInbound')}
          </UniBatchButton>,
          <UniBatchButton
            key="batch-withdraw"
            selectedRowKeys={selectedRowKeys}
            disabled={
              selectedRegistrationsForBatch.length > 0 &&
              !customerMaterialBatchWithdrawAllowed(
                selectedRegistrationsForBatch,
                resourcePerms.canAction?.('revoke') ?? false,
              )
            }
            onAction={() => void handleBatchWithdraw()}
          >
            {t('app.kuaizhizao.customerMaterialRegistration.batchWithdraw')}
          </UniBatchButton>,
          <UniBatchButton
            key="batch-cancel"
            selectedRowKeys={selectedRowKeys}
            danger
            disabled={
              selectedRegistrationsForBatch.length > 0 &&
              !customerMaterialBatchCancelAllowed(
                selectedRegistrationsForBatch,
                resourcePerms.canAction?.('reject') ?? false,
              )
            }
            onAction={() => void handleBatchCancel()}
          >
            {t('app.kuaizhizao.customerMaterialRegistration.batchCancel')}
          </UniBatchButton>,
        ]}
        request={async (params: any) => {
          const pageSize = params.pageSize || 20;
          const skip = (params.current! - 1) * pageSize;
          const result = await customerMaterialRegistrationApi.list({
            skip,
            limit: pageSize,
            customer_id: params.customer_id,
            status: params.status,
          });
          const rows = Array.isArray(result) ? result : [];
          tableRowsRef.current = rows;
          setListVersion((v) => v + 1);
          const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
          return { data: rows, success: true, total };
        }}
        scroll={{ x: 1500 }}
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
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.customerMaterialRegistration.inboundWarehouse')}
              placeholder={t('app.kuaizhizao.customerMaterialRegistration.selectInboundWarehouse')}
              required
              onChange={(_val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
            />
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
        <ProFormTextArea name="remarks" label={t('app.kuaizhizao.warehouseCommon.colRemarks')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
        hostResource="kuaizhizao:warehouse-management-customer-material-registration"
      />

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.customerMaterialRegistration.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRegistration(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentRegistration || {}}
        columns={detailColumns}
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
