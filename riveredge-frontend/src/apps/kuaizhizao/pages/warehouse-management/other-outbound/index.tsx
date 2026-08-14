/**
 * 其他出库单管理页面
 *
 * 提供其他出库单的创建、查看、确认和管理功能（盘亏/样品/报废/其他）
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
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, ShoppingOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DocumentLineUnitSelect } from '../../../../../components/quantity-with-unit';
import { resolveMaterialScenarioUnit } from '../../../../../utils/materialScenarioUnit';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import CodeField from '../../../../../components/code-field';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { detailDrawerDescriptionItems, detailDrawerBasicColumn, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getOtherOutboundLifecycle } from '../../../utils/otherOutboundLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import dayjs from 'dayjs';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { useTranslation } from 'react-i18next';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { renderWarehouseReasonTypeMarkerTag } from '../shared/warehouseMarkerTags';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildOtherOutboundStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveWarehouseDocListParams,
} from '../../../utils/warehouseListCore';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const REASON_TYPES_FALLBACK = [
  { value: '盘亏', label: '盘亏' },
  { value: '样品', label: '样品' },
  { value: '报废', label: '报废' },
  { value: '其他', label: '其他' },
];

const REASON_TYPE_I18N: Record<string, string> = {
  '盘亏': 'app.kuaizhizao.otherOutbound.reason.loss',
  '样品': 'app.kuaizhizao.otherOutbound.reason.sample',
  '报废': 'app.kuaizhizao.otherOutbound.reason.scrap',
  '其他': 'app.kuaizhizao.otherOutbound.reason.other',
};

function translateReasonTypeLabel(t: (key: string) => string, value: string | undefined): string {
  if (!value) return '-';
  const key = REASON_TYPE_I18N[value];
  return key ? t(key) : value;
}

function mapReasonTypeOptions(
  items: Array<{ label: string; value: string }>,
  t: (key: string) => string,
): Array<{ label: string; value: string }> {
  return items.map(({ value, label }) => ({
    value,
    label: REASON_TYPE_I18N[value] ? t(REASON_TYPE_I18N[value]) : label,
  }));
}

interface OtherOutbound {
  id?: number;
  tenant_id?: number;
  outbound_code?: string;
  reason_type?: string;
  reason_desc?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  status?: string;
  deliverer_id?: number;
  deliverer_name?: string;
  delivery_time?: string;
  total_quantity?: number;
  total_items?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

interface OtherOutboundDetail extends OtherOutbound {
  items?: OtherOutboundItem[];
}

interface OtherOutboundItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  location_code?: string;
  outbound_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  notes?: string;
}

const OTHER_OUTBOUND_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_other_outbounds';

const OtherOutboundPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [outboundDetail, setOutboundDetail] = useState<OtherOutboundDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<any>(null);

  const {
    customFields: otherOutboundFormCustomFields,
    customFieldValues: otherOutboundFormCustomFieldValues,
    extractFormValues: extractOtherOutboundFormValues,
    saveCustomFieldValues: saveOtherOutboundCustomFieldValues,
    resetFieldValues: resetOtherOutboundFormFieldValues,
  } = useCustomFields({
    tableName: OTHER_OUTBOUND_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: createModalVisible,
  });

  const {
    customFields: otherOutboundListCustomFields,
    generateCustomFieldColumns: generateOtherOutboundCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichOtherOutboundRecordsWithCustomFields,
    customFieldValues: otherOutboundDetailCustomFieldValues,
    loadFieldValuesForDetail: loadOtherOutboundFieldValuesForDetail,
    resetDetailFieldValues: resetOtherOutboundDetailFieldValues,
  } = useCustomFieldsForList<OtherOutbound>({ tableName: OTHER_OUTBOUND_CUSTOM_FIELD_TABLE });
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  } = useWarehouseLocationOptions();
  const [reasonTypeOptions, setReasonTypeOptions] = useState<Array<{ label: string; value: string }>>([]);

  const defaultOutboundItem = {
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_unit: '',
    location_code: undefined,
    outbound_quantity: 1,
    unit_price: 0,
  };
  const [reasonTypeLoading, setReasonTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, is_active: true });
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
      } catch (e) {
        console.error('加载仓库失败', e);
      }
    };
    load();
  }, []);

  const fallbackReasonTypeOptions = useMemo(
    () => mapReasonTypeOptions(REASON_TYPES_FALLBACK, t),
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
          code: 'OUTBOUND_REASON_TYPE',
          page: 1,
          page_size: 1,
        });
        const dict = dictList.items?.[0];
        if (!dict) {
          setReasonTypeOptions(fallbackReasonTypeOptions);
          return;
        }
        const items = await getDictionaryItemList(dict.uuid, true);
        const sorted = items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }));
        setReasonTypeOptions(mapReasonTypeOptions(sorted, t));
      } catch {
        setReasonTypeOptions(fallbackReasonTypeOptions);
      } finally {
        setReasonTypeLoading(false);
      }
    };
    loadReasonType();
  }, [fallbackReasonTypeOptions, t]);

  const otherOutboundCustomFieldColumns = generateOtherOutboundCustomFieldColumns();
  const otherOutboundStatusValueEnum = useMemo(() => buildOtherOutboundStatusValueEnum(t), [t]);

  const columns: ProColumns<OtherOutbound>[] = useMemo(() => alignProColumns<OtherOutbound>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: otherOutboundStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.otherOutbound.col.reasonType'),
      dataIndex: 'reason_type',
      valueType: 'select',
      fieldProps: { options: reasonTypeOptions, loading: reasonTypeLoading },
      hideInTable: true,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.otherOutbound.col.deliveryTime'),
      dataIndex: 'doc_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 40 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.otherOutbound.col.outboundCode'),
      dataIndex: 'outbound_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 50 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.outbound_code ?? '') }} ellipsis>
          {r.outbound_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.otherOutbound.col.reasonType'),
      dataIndex: 'reason_type',
      width: 100,
      sorter: true,
      hideInSearch: true,
      render: (v) =>
        renderWarehouseReasonTypeMarkerTag(
          translateReasonTypeLabel(t, v as string | undefined),
          v as string | undefined,
        ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colTotalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: formatQuantity,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colMaterialKindCount'),
      dataIndex: 'total_items',
      width: 90,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (v: number | null | undefined) => (v != null ? v : '-'),
    },
    {
      title: t('app.kuaizhizao.otherOutbound.col.deliverer'),
      dataIndex: 'deliverer_name',
      width: 100,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.otherOutbound.col.deliveryTime'),
      dataIndex: 'delivery_time',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.delivery_time ? formatDateTime(r.delivery_time) : '-'),
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getOtherOutboundLifecycle(record as Record<string, unknown>, t);
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
    ...otherOutboundCustomFieldColumns,
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        const actions: React.ReactNode[] = [
          <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />,
        ];
        if (record.status === '待出库') {
          actions.push(
            <Button
              key="confirm"
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              onClick={() => handleConfirm(record)}
            >
              {t('app.kuaizhizao.warehouseOutbound.action.confirmOutbound')}
            </Button>,
          );
          actions.push(
            <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDelete(record)} />,
          );
        }
        if (record.status === '已出库') {
          actions.push(
            <Button key="withdraw" {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
              {t('app.kuaizhizao.warehouseOutbound.action.withdraw')}
            </Button>,
          );
        }
        return <Space>{actions}</Space>;
      },
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK), [t, otherOutboundCustomFieldColumns, otherOutboundStatusValueEnum, reasonTypeOptions, reasonTypeLoading]);

  const handleDetail = async (record: OtherOutbound) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setOutboundDetail(null);
    resetOtherOutboundDetailFieldValues();
    try {
      const detail = await warehouseApi.otherOutbound.get(record.id!.toString());
      setOutboundDetail(detail as OtherOutboundDetail);
      if (record.id != null) {
        await loadOtherOutboundFieldValuesForDetail(record.id);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.otherOutbound.msg.loadDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirm = async (record: OtherOutbound) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.otherOutbound.msg.confirmTitle'),
      content: t('app.kuaizhizao.otherOutbound.msg.confirmContent', { code: record.outbound_code }),
      onOk: async () => {
        try {
          await warehouseApi.otherOutbound.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.otherOutbound.msg.confirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.otherOutbound.msg.confirmFailed'));
        }
      },
    });
  };

  const handleWithdraw = async (record: OtherOutbound) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.otherOutbound.msg.withdrawTitle'),
      content: t('app.kuaizhizao.otherOutbound.msg.withdrawContent', { code: record.outbound_code }),
      onOk: async () => {
        try {
          await warehouseApi.otherOutbound.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.otherOutbound.msg.withdrawSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.otherOutbound.msg.withdrawFailed'));
        }
      },
    });
  };

  const handlePrint = (record: OtherOutbound) => {
    if (!record.id) return;
    openPrint({ documentType: 'other_outbound', documentId: record.id });
  };

  const handleDelete = async (record: OtherOutbound) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.otherOutbound.msg.deleteTitle'),
      content: t('app.kuaizhizao.otherOutbound.msg.deleteContent', { code: record.outbound_code }),
      onOk: async () => {
        try {
          await warehouseApi.otherOutbound.delete(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.otherOutbound.msg.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.otherOutbound.msg.deleteFailed'));
        }
      },
    });
  };

  const listRowsRef = useRef<Map<string, OtherOutbound>>(new Map());
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const isOtherOutboundDeletable = (record: OtherOutbound) => record.status === '待出库' && !!record.id;
  const isOtherOutboundPrintable = (record: OtherOutbound) =>
    record.status === '已出库' && !!record.id;

  const selectedOtherOutboundForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => listRowsRef.current.get(String(key)))
        .filter((row): row is OtherOutbound => row != null),
    [selectedRowKeys],
  );

  const canToolbarPrint =
    selectedRowKeys.length === 1 &&
    !!selectedOtherOutboundForBatch[0] &&
    isOtherOutboundPrintable(selectedOtherOutboundForBatch[0]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const rows = keys
      .map((k) => listRowsRef.current.get(String(k)))
      .filter((r): r is OtherOutbound => !!r && isOtherOutboundDeletable(r));
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.batchDeleteNoneDeletable'));
      return;
    }
    try {
      for (const row of rows) {
        await warehouseApi.otherOutbound.delete(String(row.id));
      }
      messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: rows.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  const appendOtherOutboundItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultOutboundItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    resetSelectedWarehouseId();
    setCreateModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.otherOutbound.create')),
    [t],
  );

  const handleCreateSubmit = async (values: any) => {
    const needValidLinesMsg = t('app.kuaizhizao.otherOutbound.msg.needValidLines');
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.outbound_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error(needValidLinesMsg);
        throw new Error(needValidLinesMsg);
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      const { standardValues, customData } = extractOtherOutboundFormValues(values);
      const created = await warehouseApi.otherOutbound.create({
        outbound_code: standardValues.outbound_code,
        reason_type: standardValues.reason_type,
        reason_desc: standardValues.reason_desc,
        warehouse_id: standardValues.warehouse_id,
        warehouse_name: warehouseName,
        notes: standardValues.notes,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
        items: validItems.map((it: any) => {
          const outboundQty = Number(it.outbound_quantity) || 0;
          const unitPrice = Number(it.unit_price) || 0;
          return {
            material_id: it.material_id,
            material_code: it.material_code || undefined,
            material_name: it.material_name || undefined,
            material_unit: it.material_unit || '',
            location_code: it.location_code || undefined,
            outbound_quantity: outboundQty,
            unit_price: unitPrice,
            total_amount: outboundQty * unitPrice,
          };
        }),
      });
      const recordId = Number((created as { id?: number })?.id ?? 0);
      if (recordId > 0 && Object.keys(customData).length > 0) {
        await saveOtherOutboundCustomFieldValues(recordId, customData);
      }
      messageApi.success(t('app.kuaizhizao.otherOutbound.msg.createSuccess'));
      resetOtherOutboundFormFieldValues();
      resetSelectedWarehouseId();
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== needValidLinesMsg) messageApi.error(error.message || t('app.kuaizhizao.otherOutbound.msg.createFailed'));
      throw error;
    }
  };

  const detailColumns = useMemo(() => alignDescriptionColumns([
    { title: t('app.kuaizhizao.otherOutbound.col.outboundCode'), dataIndex: 'outbound_code' },
    {
      title: t('app.kuaizhizao.otherOutbound.col.reasonType'),
      dataIndex: 'reason_type',
      render: (_, record) =>
        renderWarehouseReasonTypeMarkerTag(translateReasonTypeLabel(t, record.reason_type), record.reason_type),
    },
    { title: t('app.kuaizhizao.otherOutbound.field.reasonDesc'), dataIndex: 'reason_desc', span: 3 },
    { title: t('app.kuaizhizao.warehouseReports.colWarehouse'), dataIndex: 'warehouse_name' },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.status'),
      dataIndex: 'status',
      render: (s) => {
        const map: Record<string, { text: string; color: string }> = {
          '待出库': { text: '待出库', color: 'default' },
          '已出库': { text: '已出库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(s as any) || ''] || { text: (s as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: t('app.kuaizhizao.otherOutbound.col.deliverer'), dataIndex: 'deliverer_name' },
    { title: t('app.kuaizhizao.otherOutbound.col.deliveryTime'), dataIndex: 'delivery_time', valueType: 'dateTime' },
  ]), [t]);

  const detailNotesColumn: ProDescriptionsItemProps<OtherOutboundDetail> = useMemo(() => ({
    title: t('app.kuaizhizao.common.fieldNotes'),
    dataIndex: 'notes',
    span: 3,
  }), [t]);

  const detailCollaboration = useMemo(() => {
    if (!outboundDetail) return undefined;
    const lifecycle = getOtherOutboundLifecycle(outboundDetail as unknown as Record<string, unknown>, t);
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
  }, [outboundDetail, t]);

  const detailSupplementary = useMemo(() => {
    if (!outboundDetail) return undefined;
    const nodes: React.ReactNode[] = [];
    if (hasCustomFieldsDetailContent(otherOutboundListCustomFields, otherOutboundDetailCustomFieldValues)) {
      nodes.push(
        <CustomFieldsDetailSection
          key="custom-fields"
          customFields={otherOutboundListCustomFields}
          customFieldValues={otherOutboundDetailCustomFieldValues}
        />,
      );
    }
    if (outboundDetail.notes) {
      nodes.push(
        <Descriptions
          key="notes"
          column={detailDrawerBasicColumn(false)}
          size="small"
          style={nodes.length > 0 ? { marginTop: 16 } : undefined}
          items={detailDrawerDescriptionItems([detailNotesColumn], outboundDetail)}
        />,
      );
    }
    if (nodes.length === 0) return undefined;
    return <>{nodes}</>;
  }, [detailNotesColumn, outboundDetail, otherOutboundDetailCustomFieldValues, otherOutboundListCustomFields]);

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.otherOutbound.title')}
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.other-outbound.v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          showCreateButton
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          enableRowSelection
          onTableDataChange={(rows) => {
            const next = new Map<string, OtherOutbound>();
            for (const row of rows) {
              if (row.id != null) next.set(String(row.id), row);
            }
            listRowsRef.current = next;
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          rowSelectionGetCheckboxProps={(record) => ({
            disabled: !isOtherOutboundDeletable(record) && !isOtherOutboundPrintable(record),
          })}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) =>
            t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', {
              count,
              noun: t('app.kuaizhizao.otherOutbound.title'),
            })
          }
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            try {
              const listParams = resolveWarehouseDocListParams(searchFormValues, sort, {
                docDateParamPrefix: 'delivery',
              });
              const response = await warehouseApi.otherOutbound.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...listParams,
              });
              const { data: raw, total } = normalizeWarehouseListResponse(response);
              const data = meta?.purpose === 'prefetch'
                ? raw
                : await enrichOtherOutboundRecordsWithCustomFields(raw);
              return { data, success: true, total };
            } catch {
              messageApi.error(t('app.kuaizhizao.otherOutbound.msg.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarActionsAfterBatch={[
            <Button
              key="other-outbound-toolbar-print"
              icon={<PrinterOutlined />}
              disabled={!canToolbarPrint}
              onClick={() => {
                const row = selectedOtherOutboundForBatch[0];
                if (row) handlePrint(row);
              }}
            >
              {t('components.uniAction.print')}
            </Button>,
          ]}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.otherOutbound.detailTitle')}${outboundDetail?.outbound_code ? ` - ${outboundDetail.outbound_code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOutboundDetail(null);
          resetOtherOutboundDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          outboundDetail ? (
            <Descriptions column={detailDrawerBasicColumn(false)} size="small" items={detailDrawerDescriptionItems(detailColumns, outboundDetail)} />
          ) : undefined
        }
        collaboration={detailCollaboration}
        supplementary={detailSupplementary}
        linesTitle={t('app.kuaizhizao.warehouseOutbound.section.lines')}
        lines={
          outboundDetail?.items && outboundDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={[
                  { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
                    dataIndex: 'material_unit',
                    width: 60,
                    render: (val) => <DictionaryLabel dictionaryCode="unit" value={val} />,
                  },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.deliveryQty'), dataIndex: 'outbound_quantity', width: 100, align: 'right' },
                  { title: t('app.kuaizhizao.warehouseOutbound.field.unitPrice'), dataIndex: 'unit_price', width: 100, align: 'right' },
                  { title: t('app.kuaizhizao.warehouseOutbound.field.amount'), dataIndex: 'total_amount', width: 100, align: 'right' },
                  { title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'), dataIndex: 'batch_number', width: 100 },
                  { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes' },
                ]}
                dataSource={outboundDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.otherOutbound.createModal')}
        open={createModalVisible}
        onClose={() => {
          resetSelectedWarehouseId();
          setCreateModalVisible(false);
          resetOtherOutboundFormFieldValues();
        }}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        initialValues={{ reason_type: '其他' }}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-other-outbound"
              name="outbound_code"
              label={t('app.kuaizhizao.otherOutbound.col.outboundCode')}
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseReports.colWarehouse')}
              placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectWarehouse')}
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
            <ProFormItem name="reason_type" label={t('app.kuaizhizao.otherOutbound.field.reasonType')} rules={[{ required: true }]}>
              <UniDropdown
                placeholder={t('app.kuaizhizao.otherOutbound.field.selectReasonType')}
                showSearch
                allowClear
                loading={reasonTypeLoading}
                style={{ width: '100%' }}
                options={reasonTypeOptions}
                quickCreate={{
                  label: t('app.kuaizhizao.otherOutbound.field.dataDictionary'),
                  onClick: () => navigate('/system/data-dictionaries?keyword=OUTBOUND_REASON_TYPE'),
                }}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormItem name="reason_desc" label={t('app.kuaizhizao.otherOutbound.field.reasonDesc')}>
              <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.warehouseOutbound.field.optional')} />
            </ProFormItem>
          </Col>
          <CustomFieldsFormSection
            customFields={otherOutboundFormCustomFields}
            customFieldValues={otherOutboundFormCustomFieldValues}
            gridColumns={2}
            embedInParentRow
          />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title={t('app.kuaizhizao.warehouseOutbound.section.lines')} required />
          <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.field.material'),
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
                              <AntForm.Item name={[index, 'material_code']} hidden>
                                <input type="hidden" />
                              </AntForm.Item>
                              <AntForm.Item name={[index, 'material_name']} hidden>
                                <input type="hidden" />
                              </AntForm.Item>
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectMaterial')}
                                required
                                size="small"
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                }}
                                onChange={(_val, material) => {
                                  if (!material) return;
                                  formRef.current?.setFieldValue(
                                    ['items', index, 'material_unit'],
                                    resolveMaterialScenarioUnit(material, 'sale'),
                                  );
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate
                                showAdvancedSearch
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
                    dataIndex: 'material_unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          if (!formRef.current) return null;
                          return (
                            <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                              <DocumentLineUnitSelect
                                form={formRef.current}
                                listName="items"
                                rowIndex={index}
                                fields={{ quantity: 'outbound_quantity', unit: 'material_unit' }}
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
                    title: t('app.kuaizhizao.warehouseOutbound.field.quantity'),
                    dataIndex: 'outbound_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'outbound_quantity']} rules={[{ required: true, message: t('app.kuaizhizao.warehouseOutbound.field.required') }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder={t('app.kuaizhizao.warehouseOutbound.field.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.warehouseOutbound.col.location'),
                    dataIndex: 'location_code',
                    width: 180,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'location_code']} style={{ margin: 0 }}>
                        <Select
                          options={locationOptions}
                          placeholder={selectedWarehouseId ? t('app.kuaizhizao.warehouseOutbound.field.selectLocation') : t('app.kuaizhizao.warehouseOutbound.field.selectWarehouseFirst')}
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
                    title: t('app.kuaizhizao.warehouseOutbound.field.unitPrice'),
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
                    title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
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
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultOutboundItem)}>
                              {t('app.kuaizhizao.warehouseOutbound.action.addLine')}
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
        <DocumentAttachmentsField category="other_outbound_attachments" />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.warehouseOutbound.field.optional')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendOtherOutboundItemsFromMaterials}
      />
      {PrintModal}
    </>
  );
};

export default OtherOutboundPage;
