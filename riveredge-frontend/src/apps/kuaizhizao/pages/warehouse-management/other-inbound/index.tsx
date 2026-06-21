/**
 * 其他入库单管理页面
 *
 * 提供其他入库单的创建、查看、确认和管理功能（盘盈/样品/报废/其他）
 * 支持批号规则选择与自动生成批号
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, InputNumber, Input, Row, Col, Select, Typography, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, ThunderboltOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getOtherInboundLifecycle } from '../../../utils/otherInboundLifecycle';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../master-data/services/material';
import { SerialNumbersImportTrigger } from '../../../../../components/serial-numbers-import';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatDateTime } from '../../../../../utils/format';

const REASON_TYPES_FALLBACK = [
  { value: '盘盈', label: '盘盈' },
  { value: '调拨', label: '调拨' },
  { value: '样品', label: '样品' },
  { value: '报废', label: '报废' },
  { value: '其他', label: '其他' },
];

const REASON_TYPE_I18N: Record<string, string> = {
  '盘盈': 'app.kuaizhizao.warehouseOtherInbound.reason.surplus',
  '调拨': 'app.kuaizhizao.warehouseOtherInbound.reason.transfer',
  '样品': 'app.kuaizhizao.warehouseOtherInbound.reason.sample',
  '报废': 'app.kuaizhizao.warehouseOtherInbound.reason.scrap',
  '其他': 'app.kuaizhizao.warehouseOtherInbound.reason.other',
};

function translateReasonTypeLabel(t: (key: string) => string, value: string | undefined): string {
  if (!value) return '-';
  const key = REASON_TYPE_I18N[value];
  return key ? t(key) : value;
}

interface OtherInbound {
  id?: number;
  tenant_id?: number;
  inbound_code?: string;
  reason_type?: string;
  reason_desc?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  status?: string;
  receiver_id?: number;
  receiver_name?: string;
  receipt_time?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

interface OtherInboundDetail extends OtherInbound {
  items?: OtherInboundItem[];
}

interface OtherInboundItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  location_code?: string;
  inbound_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  notes?: string;
}

const defaultInboundItem = {
  material_id: undefined,
  material_code: '',
  material_name: '',
  material_unit: '',
  inbound_quantity: 1,
  unit_price: 0,
  material_uuid: undefined,
  batch_managed: false,
  serial_managed: false,
  batch_rule_id: undefined,
  default_batch_rule_id: undefined,
  serial_rule_id: undefined,
  default_serial_rule_id: undefined,
  location_code: undefined,
  batch_number: undefined,
  serial_numbers: undefined,
};

const OTHER_INBOUND_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_other_inbounds';

const OtherInboundPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [inboundDetail, setInboundDetail] = useState<OtherInboundDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  const {
    customFields: otherInboundFormCustomFields,
    customFieldValues: otherInboundFormCustomFieldValues,
    extractFormValues: extractOtherInboundFormValues,
    saveCustomFieldValues: saveOtherInboundCustomFieldValues,
    resetFieldValues: resetOtherInboundFormFieldValues,
  } = useCustomFields({
    tableName: OTHER_INBOUND_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: createModalVisible,
  });

  const {
    customFields: otherInboundListCustomFields,
    generateCustomFieldColumns: generateOtherInboundCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichOtherInboundRecordsWithCustomFields,
    customFieldValues: otherInboundDetailCustomFieldValues,
    loadFieldValuesForDetail: loadOtherInboundFieldValuesForDetail,
    resetDetailFieldValues: resetOtherInboundDetailFieldValues,
  } = useCustomFieldsForList<OtherInbound>({ tableName: OTHER_INBOUND_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (otherInboundListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [otherInboundListCustomFields.length]);

  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [reasonTypeOptions, setReasonTypeOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [reasonTypeLoading, setReasonTypeLoading] = useState(false);
  const [generatingBatchIdx, setGeneratingBatchIdx] = useState<number | null>(null);
  const [generatingSerialIdx, setGeneratingSerialIdx] = useState<number | null>(null);
  const {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  } = useWarehouseLocationOptions();

  useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, is_active: true });
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
      } catch (e) {
        console.error('加载仓库/规则失败', e);
      }
    };
    load();
  }, []);

  const fallbackReasonTypeOptions = useMemo(
    () => REASON_TYPES_FALLBACK.map(({ value }) => ({ value, label: t(REASON_TYPE_I18N[value]) })),
    [t],
  );

  useEffect(() => {
    setReasonTypeOptions(fallbackReasonTypeOptions);
  }, [fallbackReasonTypeOptions]);

  useEffect(() => {
    const loadReasonType = async () => {
      setReasonTypeLoading(true);
      try {
        const dictList = await getDataDictionaryList({
          code: 'INBOUND_REASON_TYPE',
          page: 1,
          page_size: 1,
        });
        const dict = dictList.items?.[0];
        if (!dict) {
          setReasonTypeOptions(fallbackReasonTypeOptions);
          return;
        }
        const items = await getDictionaryItemList(dict.uuid, true);
        setReasonTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setReasonTypeOptions(fallbackReasonTypeOptions);
      } finally {
        setReasonTypeLoading(false);
      }
    };
    loadReasonType();
  }, [fallbackReasonTypeOptions]);

  const otherInboundCustomFieldColumns = generateOtherInboundCustomFieldColumns();

  const columns: ProColumns<OtherInbound>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.inboundCode'),
        dataIndex: 'inbound_code',
        width: 140,
        ellipsis: true,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.inbound_code ?? '') }} ellipsis>
            {r.inbound_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.warehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.reasonType'),
        dataIndex: 'reason_type',
        width: 100,
        render: (v) => <Tag>{translateReasonTypeLabel(t, String(v || ''))}</Tag>,
      },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.receiver'), dataIndex: 'receiver_name', width: 100 },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.receiptTime'), dataIndex: 'receipt_time', valueType: 'dateTime', width: 160 },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getOtherInboundLifecycle(record as Record<string, unknown>);
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
      ...otherInboundCustomFieldColumns,
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.actions'),
        width: 180,
        fixed: 'right',
        render: (_, record) => {
          const actions: React.ReactNode[] = [
            <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />,
          ];
          if (record.status === '待入库') {
            actions.push(
              <Button
                key="confirm"
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={() => handleConfirm(record)}
              >
                {t('app.kuaizhizao.warehouseOtherInbound.action.confirmInbound')}
              </Button>,
            );
            actions.push(
              <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDelete(record)} />,
            );
          }
          if (record.status === '已入库') {
            actions.push(
              <Button
                key="withdraw"
                {...rowActionKind('revoke')}
                {...rowActionLabelKeep()}
                onClick={() => handleWithdraw(record)}
              >
                {t('app.kuaizhizao.warehouseOtherInbound.action.withdraw')}
              </Button>,
            );
          }
          if (record.id) {
            actions.push(
              <Button
                key="print"
                {...rowActionKind('print')}
                onClick={() => openPrint({ documentType: 'other_inbound', documentId: record.id! })}
              />,
            );
          }
          return <Space>{actions}</Space>;
        },
      },
    ],
    [t, otherInboundCustomFieldColumns, openPrint],
  );

  const handleDetail = async (record: OtherInbound) => {
    try {
      const detail = await warehouseApi.otherInbound.get(record.id!.toString());
      setInboundDetail(detail as OtherInboundDetail);
      setDetailDrawerVisible(true);
      if (record.id != null) {
        await loadOtherInboundFieldValuesForDetail(record.id);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseOtherInbound.msg.loadDetailFailed'));
    }
  };

  const handleConfirm = async (record: OtherInbound) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseOtherInbound.confirm.title'),
      content: t('app.kuaizhizao.warehouseOtherInbound.confirm.content', { code: record.inbound_code }),
      onOk: async () => {
        try {
          await warehouseApi.otherInbound.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.confirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.warehouseOtherInbound.msg.confirmFailed'));
        }
      },
    });
  };

  const handleDelete = async (record: OtherInbound) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseOtherInbound.confirm.deleteTitle'),
      content: t('app.kuaizhizao.warehouseOtherInbound.confirm.deleteContent', { code: record.inbound_code }),
      onOk: async () => {
        try {
          await warehouseApi.otherInbound.delete(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.warehouseOtherInbound.msg.deleteFailed'));
        }
      },
    });
  };

  const handleWithdraw = async (record: OtherInbound) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseOtherInbound.confirm.withdrawTitle'),
      content: t('app.kuaizhizao.warehouseOtherInbound.confirm.withdrawContent', { code: record.inbound_code }),
      onOk: async () => {
        try {
          await warehouseApi.otherInbound.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.withdrawSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.warehouseOtherInbound.msg.withdrawFailed'));
        }
      },
    });
  };

  const appendOtherInboundItemsFromMaterials = useCallback(
    async (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = await Promise.all(
        selected.map(async (m) => {
          const row = {
            ...defaultInboundItem,
            material_id: m.id,
            material_code: m.mainCode ?? m.code ?? '',
            material_name: m.name ?? '',
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
        }),
      );
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t],
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    resetSelectedWarehouseId();
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ items: [defaultInboundItem] });
    }, 0);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.warehouseOtherInbound.create')),
    [t],
  );

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.inbound_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error(t('app.kuaizhizao.warehouseOtherInbound.msg.needValidLine'));
        throw new Error(t('app.kuaizhizao.warehouseOtherInbound.msg.needValidLine'));
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      const { standardValues, customData } = extractOtherInboundFormValues(values);
      const created = await warehouseApi.otherInbound.create({
        inbound_code: standardValues.inbound_code,
        reason_type: standardValues.reason_type,
        reason_desc: standardValues.reason_desc,
        warehouse_id: standardValues.warehouse_id,
        warehouse_name: warehouseName,
        notes: standardValues.notes,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          location_code: it.location_code || undefined,
          inbound_quantity: Number(it.inbound_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          batch_number: it.batch_number || undefined,
          serial_numbers: it.serial_numbers || undefined,
        })),
      });
      const recordId = Number((created as { id?: number })?.id ?? 0);
      if (recordId > 0 && Object.keys(customData).length > 0) {
        await saveOtherInboundCustomFieldValues(recordId, customData);
      }
      messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.createSuccess'));
      resetOtherInboundFormFieldValues();
      resetSelectedWarehouseId();
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== t('app.kuaizhizao.warehouseOtherInbound.msg.needValidLine')) {
        messageApi.error(error.message || t('app.kuaizhizao.warehouseOtherInbound.msg.createFailed'));
      }
      throw error;
    }
  };

  const handleGenerateBatch = async (idx: number) => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const row = items[idx];
    if (!row?.material_uuid) {
      messageApi.warning(t('app.kuaizhizao.warehouseOtherInbound.msg.selectMaterialFirst'));
      return;
    }
    setGeneratingBatchIdx(idx);
    try {
      const res = await materialBatchApi.generate(row.material_uuid, {
        ruleId: row.batch_rule_id ?? row.default_batch_rule_id,
      });
      formRef.current?.setFieldValue(['items', idx, 'batch_number'], res.batch_no);
      messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.batchGenerated'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.warehouseOtherInbound.msg.batchGenerateFailed'));
    } finally {
      setGeneratingBatchIdx(null);
    }
  };

  const handleGenerateSerials = async (idx: number): Promise<string[]> => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const row = items[idx];
    if (!row?.material_uuid) {
      messageApi.warning(t('app.kuaizhizao.warehouseOtherInbound.msg.selectMaterialFirst'));
      return [];
    }
    const count = Math.max(1, Math.floor(Number(row.inbound_quantity) || 1));
    if (count > 100) {
      messageApi.warning(t('app.kuaizhizao.warehouseOtherInbound.msg.serialMax100'));
      return [];
    }
    setGeneratingSerialIdx(idx);
    try {
      const res = await materialSerialApi.generate(row.material_uuid, count, {
        ruleId: row.serial_rule_id ?? row.default_serial_rule_id,
      });
      const serialNos = res.serial_nos ?? [];
      formRef.current?.setFieldValue(['items', idx, 'serial_numbers'], serialNos);
      messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.serialGenerated', { count: res.count }));
      return serialNos;
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.warehouseOtherInbound.msg.serialGenerateFailed'));
      return [];
    } finally {
      setGeneratingSerialIdx(null);
    }
  };

  const onMaterialSelectForBatchSerial = async (idx: number, _val: number | undefined, material: any | undefined) => {
    if (!material) return;
    const uuid = material.uuid || material.UUID;
    let batchManaged = material.batchManaged ?? material.batch_managed ?? false;
    let serialManaged = material.serialManaged ?? material.serial_managed ?? false;
    let defaultBatchRuleId = material.defaultBatchRuleId ?? material.default_batch_rule_id;
    let defaultSerialRuleId = material.defaultSerialRuleId ?? material.default_serial_rule_id;
    if (uuid) {
      try {
        const full = await materialApi.get(uuid);
        batchManaged = full.batchManaged ?? false;
        serialManaged = full.serialManaged ?? false;
        defaultBatchRuleId = full.defaultBatchRuleId;
        defaultSerialRuleId = full.defaultSerialRuleId;
      } catch {
        // 使用列表返回的字段
      }
    }
    formRef.current?.setFieldValue(['items', idx, 'material_uuid'], uuid);
    formRef.current?.setFieldValue(['items', idx, 'batch_managed'], batchManaged);
    formRef.current?.setFieldValue(['items', idx, 'serial_managed'], serialManaged);
    formRef.current?.setFieldValue(['items', idx, 'default_batch_rule_id'], defaultBatchRuleId);
    formRef.current?.setFieldValue(['items', idx, 'default_serial_rule_id'], defaultSerialRuleId);
  };

  const detailColumns: ProDescriptionsItemProps<OtherInboundDetail>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.inboundCode'), dataIndex: 'inbound_code' },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.reasonType'),
        dataIndex: 'reason_type',
        render: (_, record) => translateReasonTypeLabel(t, record.reason_type),
      },
      { title: t('app.kuaizhizao.warehouseOtherInbound.field.reasonDesc'), dataIndex: 'reason_desc', span: 2 },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.warehouse'), dataIndex: 'warehouse_name' },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.field.status'),
        dataIndex: 'status',
        render: (s) => {
          const map: Record<string, { textKey: string; color: string }> = {
            '待入库': { textKey: 'app.kuaizhizao.warehouseOtherInbound.status.pending', color: 'default' },
            '已入库': { textKey: 'app.kuaizhizao.warehouseOtherInbound.status.posted', color: 'success' },
            '已取消': { textKey: 'app.kuaizhizao.warehouseOtherInbound.status.cancelled', color: 'error' },
          };
          const c = map[(s as string) || ''] || { textKey: '', color: 'default' };
          return <Tag color={c.color}>{c.textKey ? t(c.textKey) : (s as string) || '-'}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.receiver'), dataIndex: 'receiver_name' },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.receiptTime'), dataIndex: 'receipt_time', valueType: 'dateTime' },
    ],
    [t],
  );

  const detailNotesColumn: ProDescriptionsItemProps<OtherInboundDetail> = useMemo(
    () => ({
      title: t('app.kuaizhizao.warehouseOtherInbound.col.notes'),
      dataIndex: 'notes',
      span: 2,
    }),
    [t],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.materialName'), dataIndex: 'material_name', width: 150 },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.unit'),
        dataIndex: 'material_unit',
        width: 60,
        render: (val: unknown) => <DictionaryLabel dictionaryCode="unit" value={val} />,
      },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.location'), dataIndex: 'location_code', width: 100, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.inboundQty'), dataIndex: 'inbound_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.unitPrice'), dataIndex: 'unit_price', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.amount'), dataIndex: 'total_amount', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.batchNo'), dataIndex: 'batch_number', width: 120, ellipsis: true },
      {
        title: t('app.kuaizhizao.warehouseOtherInbound.col.serialNo'),
        dataIndex: 'serial_numbers',
        width: 140,
        ellipsis: true,
        render: (val: unknown) => {
          const list = Array.isArray(val) ? val : [];
          return list.length > 0 ? list.join('、') : '—';
        },
      },
      { title: t('app.kuaizhizao.warehouseOtherInbound.col.notes'), dataIndex: 'notes' },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.warehouseOtherInbound.title')}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.other-inbound"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.otherInbound.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                reason_type: params.reason_type,
                warehouse_id: params.warehouse_id,
                keyword: (params as any).keyword,
              });
              const raw = Array.isArray(response) ? response : response?.items || response?.data || [];
              const data = await enrichOtherInboundRecordsWithCustomFields(raw);
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.warehouseOtherInbound.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await warehouseApi.otherInbound.delete(String(id));
              }
              messageApi.success(t('app.kuaizhizao.warehouseOtherInbound.msg.batchDeleteSuccess', { count: keys.length }));
              invalidateMenuBadgeCounts();
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error.message || t('app.kuaizhizao.warehouseOtherInbound.msg.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.warehouseOtherInbound.confirm.batchDelete', { count })}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.warehouseOtherInbound.detailTitle')}${inboundDetail?.inbound_code ? ` - ${inboundDetail.inbound_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setInboundDetail(null);
          resetOtherInboundDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          inboundDetail ? (
            <>
              <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, inboundDetail)} />
              {hasCustomFieldsDetailContent(otherInboundListCustomFields, otherInboundDetailCustomFieldValues) ? (
                <div style={{ marginTop: 16 }}>
                  <CustomFieldsDetailSection
                    customFields={otherInboundListCustomFields}
                    customFieldValues={otherInboundDetailCustomFieldValues}
                  />
                </div>
              ) : null}
              {inboundDetail.notes ? (
                <Descriptions
                  column={2}
                  style={{ marginTop: 16 }}
                  items={detailDrawerDescriptionItems([detailNotesColumn], inboundDetail)}
                />
              ) : null}
            </>
          ) : undefined
        }
        lines={
          inboundDetail?.items && inboundDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={detailItemColumns}
                dataSource={inboundDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.warehouseOtherInbound.createModal')}
        open={createModalVisible}
        onClose={() => {
          resetSelectedWarehouseId();
          setCreateModalVisible(false);
          resetOtherInboundFormFieldValues();
        }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        submitText={t('app.kuaizhizao.warehouseOtherInbound.action.saveDraft')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        initialValues={{ reason_type: '其他' }}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-other-inbound"
              name="inbound_code"
              label={t('app.kuaizhizao.warehouseOtherInbound.field.inboundCode')}
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseOtherInbound.field.warehouse')}
              placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.selectWarehouse')}
              required
              onChange={(val, wh) => {
                updateSelectedWarehouseId(val);
                formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' });
              }}
            />
          </Col>
        </Row>
        <AntForm.Item name="warehouse_name" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="reason_type" label={t('app.kuaizhizao.warehouseOtherInbound.field.reasonType')} rules={[{ required: true }]}>
              <UniDropdown
                placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.selectReasonType')}
                showSearch
                allowClear
                loading={reasonTypeLoading}
                style={{ width: '100%' }}
                options={reasonTypeOptions}
                quickCreate={{ label: t('app.kuaizhizao.warehouseOtherInbound.field.dictManage'), onClick: () => navigate('/system/data-dictionaries') }}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormItem name="reason_desc" label={t('app.kuaizhizao.warehouseOtherInbound.field.reasonDesc')}>
              <Input placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.optional')} />
            </ProFormItem>
          </Col>
          <CustomFieldsFormSection
            customFields={otherInboundFormCustomFields}
            customFieldValues={otherInboundFormCustomFieldValues}
            gridColumns={2}
            embedInParentRow
          />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title={t('app.kuaizhizao.warehouseOtherInbound.field.lines')} required />
          <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.material'),
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <div className="warehouse-detail-material-cell">
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.selectMaterial')}
                                required
                                size="small"
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                  material_unit: 'baseUnit',
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate
                                showAdvancedSearch
                                onChange={(v, m) => onMaterialSelectForBatchSerial(index, v, m)}
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.unit'),
                    dataIndex: 'material_unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          return (
                            <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                              <MaterialUnitSelect 
                                materialId={materialId} 
                                size="small" 
                                noStyle 
                              />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.quantity'),
                    dataIndex: 'inbound_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'inbound_quantity']} rules={[{ required: true, message: t('app.kuaizhizao.warehouseOtherInbound.field.required') }, { type: 'number', min: 0.01, message: t('app.kuaizhizao.warehouseOtherInbound.field.quantityMin') }]} style={{ margin: 0 }}>
                        <InputNumber placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.location'),
                    dataIndex: 'location_code',
                    width: 150,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'location_code']} style={{ margin: 0 }}>
                        <Select
                          options={locationOptions}
                          placeholder={selectedWarehouseId ? t('app.kuaizhizao.warehouseOtherInbound.field.selectLocation') : t('app.kuaizhizao.warehouseOtherInbound.field.selectWarehouseFirst')}
                          style={{ width: '100%' }}
                          size="small"
                          showSearch
                          optionFilterProp="label"
                          allowClear
                          disabled={!selectedWarehouseId}
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.batchNo'),
                    dataIndex: 'batch_number',
                    width: 130,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
                      >
                        {({ getFieldValue }) => {
                          const row = getFieldValue('items')?.[index];
                          if (!row?.batch_managed) return '—';
                          return (
                            <Space size={2}>
                              <AntForm.Item name={[index, 'batch_number']} style={{ margin: 0 }}>
                                <Input placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.optional')} size="small" style={{ width: 96 }} />
                              </AntForm.Item>
                              <Button
                                type="link"
                                size="small"
                                icon={<ThunderboltOutlined />}
                                loading={generatingBatchIdx === index}
                                onClick={() => handleGenerateBatch(index)}
                                style={{ padding: 0 }}
                              />
                            </Space>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.serialNo'),
                    dataIndex: 'serial_numbers',
                    width: 150,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
                      >
                        {({ getFieldValue }) => {
                          const row = getFieldValue('items')?.[index];
                          if (!row?.serial_managed) return '—';
                          const qty = Number(row?.inbound_quantity ?? 0);
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
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.unitPrice'),
                    dataIndex: 'unit_price',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                        <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOtherInbound.col.actions'),
                    width: 60,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                    ),
                  },
                ];
                const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="warehouse-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultInboundItem)}>
                              {t('app.kuaizhizao.warehouseOtherInbound.action.addLine')}
                            </Button>
                            <Button
                              type="default"
                              icon={<ShoppingOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => setMaterialPickerOpen(true)}
                            >
                              {t('app.kuaizhizao.common.materialBatchSelect')}
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
        </div>
        <DocumentAttachmentsField category="other_inbound_attachments" />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.warehouseOtherInbound.field.notes')} placeholder={t('app.kuaizhizao.warehouseOtherInbound.field.optional')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendOtherInboundItemsFromMaterials}
      />
      {PrintModal}
    </>
  );
};

export default OtherInboundPage;
