import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 装箱打包绑定管理页面
 *
 * 提供装箱打包绑定记录的管理功能，包括查看、更新、删除等。
 * 归属生产管理：产线末端打包/装箱时记录每箱内含产品批次，用于出货追溯。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import type { DescriptionsProps } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  Typography,
  Empty,
  Spin,
  Modal,
  Table,
  theme as AntdTheme,
  Tag,
} from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchButton } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { packingBindingBatchPrintAllowed } from '../../../../../hooks/useDocumentCapabilities';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import { packingBindingApi } from '../../../services/packing-binding';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

import { qrcodeApi } from '../../../../../services/qrcode';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getPackingBindingLifecycle } from '../../../utils/packingBindingLifecycle';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../../../utils/format';

interface PackingBinding {
  id?: number;
  uuid?: string;
  finished_goods_receipt_id?: number;
  sales_delivery_id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  product_serial_no?: string;
  packing_material_id?: number;
  packing_material_code?: string;
  packing_material_name?: string;
  packing_quantity?: number;
  box_no?: string;
  binding_method?: string;
  barcode?: string;
  bound_by?: number;
  bound_by_name?: string;
  bound_at?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    update?: { allowed?: boolean; reason?: string };
    delete?: { allowed?: boolean; reason?: string };
    print?: { allowed?: boolean; reason?: string };
  };
}

interface PackingBindingPageResult {
  items: PackingBinding[];
  total: number;
}

interface PackingTaskPoolItem {
  id: number;
  delivery_code: string;
  customer_name: string;
  review_status: string;
  status: string;
  updated_at: string;
}

interface PackingTaskPoolResult {
  pending_review: number;
  pending_outbound: number;
  total: number;
  items: PackingTaskPoolItem[];
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
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

function renderPbRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}


const PB_STAT_SPARK_1 = [3, 4, 5, 4, 6, 5, 7];
const PB_STAT_SPARK_2 = [2, 3, 2, 4, 3, 5, 4];
const PB_STAT_SPARK_3 = [1, 2, 1, 2, 1, 2, 2];

const PB_RESOURCE = 'kuaizhizao:production-execution-packing-binding';

const PackingBindingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const packingBindingDetailDrawerZIndex = token.zIndexPopupBase;
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<PackingBinding[]>([]);
  const packingBindingPerms = useResourcePermissions(PB_RESOURCE);
  const selectedBindingsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PackingBinding => row != null),
    [selectedRowKeys],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const getBindingSourceLabel = useCallback(
    (record: PackingBinding) => {
      if (record.sales_delivery_id) return t('app.kuaizhizao.packingBinding.sourceSalesDelivery');
      if (record.finished_goods_receipt_id) return t('app.kuaizhizao.packingBinding.sourceFinishedGoodsReceipt');
      return t('app.kuaizhizao.packingBinding.sourceOther');
    },
    [t],
  );

  const bindingMethodTag = useCallback(
    (m?: string) => {
      const v = (m || '').trim();
      if (v === 'scan') return <Tag color="success">{t('app.kuaizhizao.packingBinding.bindingMethodScan')}</Tag>;
      if (v === 'manual') return <Tag>{t('app.kuaizhizao.packingBinding.bindingMethodManual')}</Tag>;
      return <Tag>{v || '-'}</Tag>;
    },
    [t],
  );

  const getErrorMessage = useCallback(
    (error: any, fallbackKey: string) => error?.message || t(fallbackKey),
    [t],
  );

  const [statsVersion, setStatsVersion] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBinding, setCurrentBinding] = useState<PackingBinding | null>(null);

  const [pbTrackingRefreshKey, setPbTrackingRefreshKey] = useState(0);

  const handleDetail = useCallback(async (record: PackingBinding) => {
    try {
      const detail = await packingBindingApi.get(record.id!.toString());
      setCurrentBinding(detail);
      setDetailDrawerVisible(true);
      setPbTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.fetchDetailFailed'));
    }
  }, [messageApi]);

  const [localStats, setLocalStats] = useState({ total: 0, scan: 0, manual: 0 });
  const [taskPoolVisible, setTaskPoolVisible] = useState(false);
  const [taskPoolLoading, setTaskPoolLoading] = useState(false);
  const [taskPool, setTaskPool] = useState<PackingTaskPoolResult>({
    pending_review: 0,
    pending_outbound: 0,
    total: 0,
    items: [],
  });

  const refreshLocalStats = useCallback(async () => {
    try {
      const stats = await packingBindingApi.statistics();
      setLocalStats({
        total: Number(stats?.total || 0),
        scan: Number(stats?.scan || 0),
        manual: Number(stats?.manual || 0),
      });
    } catch {
      setLocalStats({ total: 0, scan: 0, manual: 0 });
    }
  }, []);

  const openTaskPool = useCallback(async () => {
    setTaskPoolVisible(true);
    setTaskPoolLoading(true);
    try {
      const result = await packingBindingApi.taskPool({ limit: 20 });
      setTaskPool({
        pending_review: Number(result?.pending_review || 0),
        pending_outbound: Number(result?.pending_outbound || 0),
        total: Number(result?.total || 0),
        items: Array.isArray(result?.items) ? result.items : [],
      });
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.taskPoolFetchFailed'));
    } finally {
      setTaskPoolLoading(false);
    }
  }, [getErrorMessage, messageApi]);

  useEffect(() => {
    void refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);


  const packingTracking = useDocumentTracking(
    detailDrawerVisible && currentBinding?.id ? 'packing_binding' : undefined,
    currentBinding?.id,
    pbTrackingRefreshKey,
  );

  const [currentBindingId, setCurrentBindingId] = useState<number | null>(null);

  useEffect(() => {
    const boxUuid = searchParams.get('uuid');
    const boxNo = searchParams.get('box_no');
    const action = searchParams.get('action');

    if (action === 'detail' && (boxUuid || boxNo)) {
      const load = async () => {
        try {
          // 先按 uuid 精确匹配（新协议），找不到再回退箱号模糊匹配（兼容旧参数）
          if (boxUuid) {
            const byUuid = await packingBindingApi.list({ uuid: boxUuid, skip: 0, limit: 1 });
            if (Array.isArray(byUuid) && byUuid.length > 0) {
              await handleDetail(byUuid[0]);
              setSearchParams({}, { replace: true });
              return;
            }
          }
          const fallbackBoxNo = boxNo || boxUuid;
          const byBoxNo = await packingBindingApi.list({ box_no: fallbackBoxNo, skip: 0, limit: 1 });
          if (Array.isArray(byBoxNo) && byBoxNo.length > 0) {
            await handleDetail(byBoxNo[0]);
            setSearchParams({}, { replace: true });
            return;
          }
          messageApi.warning(t('app.kuaizhizao.packingBinding.recordNotFound'));
        } catch {
          messageApi.error(t('app.kuaizhizao.packingBinding.fetchRecordFailed'));
        }
      };
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.packingBinding.selectForQrcode'));
      return;
    }

    const failed: string[] = [];
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        const binding = await packingBindingApi.get(String(key));
        await qrcodeApi.generateBox({
          box_uuid: binding.box_no || binding.uuid || '',
          box_code: binding.box_no || '',
          material_codes: binding.product_code ? [binding.product_code] : [],
        });
        successCount += 1;
      } catch (error: any) {
        failed.push(`${String(key)}: ${getErrorMessage(error, 'app.kuaizhizao.packingBinding.generateFailed')}`);
      }
    }
    if (failed.length === 0) {
      messageApi.success(t('app.kuaizhizao.packingBinding.qrcodeSuccess', { count: successCount }));
      return;
    }
    messageApi.warning(t('app.kuaizhizao.packingBinding.qrcodePartial', { success: successCount, failed: failed.length }));
    Modal.error({
      title: t('app.kuaizhizao.packingBinding.qrcodeBatchFailedTitle'),
      content: (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {failed.map((msg) => (
            <div key={msg}>{msg}</div>
          ))}
        </div>
      ),
      width: 640,
    });
  };


  const handleEdit = useCallback(async (record: PackingBinding) => {
    try {
      setCurrentBindingId(record.id!);
      setEditModalVisible(true);
      const detail = await packingBindingApi.get(record.id!.toString());
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        packing_quantity: detail.packing_quantity,
        box_no: detail.box_no,
        remarks: detail.remarks,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.fetchDetailFailed'));
    }
  }, [messageApi]);

  const handleEditSubmit = async (values: any) => {
    try {
      if (!currentBindingId) {
        messageApi.error(t('app.kuaizhizao.packingBinding.idNotFound'));
        return;
      }

      await packingBindingApi.update(currentBindingId.toString(), {
        packing_quantity: values.packing_quantity,
        box_no: values.box_no,
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.packingBinding.updateSuccess'));
      const oid = currentBindingId;
      setEditModalVisible(false);
      setCurrentBindingId(null);
      formRef.current?.resetFields();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (oid != null && currentBinding?.id === oid) {
        try {
          const fresh = await packingBindingApi.get(String(oid));
          setCurrentBinding(fresh);
          setPbTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.updateFailed'));
      throw error;
    }
  };

  const handleDeleteOne = async (record: PackingBinding) => {
    try {
      await packingBindingApi.delete(record.id!.toString());
      messageApi.success(t('app.kuaizhizao.packingBinding.deleteSuccess'));
      if (currentBinding?.id === record.id) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      setSelectedRowKeys([]);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.packingBinding.selectToDelete'));
      return;
    }
    const failed: string[] = [];
    let successCount = 0;
    for (const key of keys) {
      try {
        await packingBindingApi.delete(String(key));
        successCount += 1;
      } catch (error: any) {
        failed.push(`${String(key)}: ${getErrorMessage(error, 'common.deleteFailed')}`);
      }
    }
    try {
      setSelectedRowKeys([]);
      if (currentBinding?.id != null && keys.map(Number).includes(currentBinding.id)) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      if (failed.length === 0) {
        messageApi.success(t('app.kuaizhizao.packingBinding.batchDeleteSuccess', { count: successCount }));
        return;
      }
      messageApi.warning(t('app.kuaizhizao.packingBinding.batchDeletePartial', { success: successCount, failed: failed.length }));
      Modal.error({
        title: t('app.kuaizhizao.packingBinding.batchDeleteFailedTitle'),
        content: (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {failed.map((msg) => (
              <div key={msg}>{msg}</div>
            ))}
          </div>
        ),
        width: 640,
      });
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.batchDeleteFailed'));
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<PackingBinding>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.packingBinding.colBoxNo'),
        dataIndex: 'box_no',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.box_no ?? '') }}>{r.box_no ?? '-'}</Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductCode'),
        dataIndex: 'product_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.product_code ?? '') }}>{r.product_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.packingBinding.colProductName'), dataIndex: 'product_name' },
      {
        title: t('app.kuaizhizao.packingBinding.colProductSerialNo'),
        dataIndex: 'product_serial_no',
        render: (val) => val || '-',
      },
      { title: t('app.kuaizhizao.packingBinding.colPackingQty'), dataIndex: 'packing_quantity', valueType: 'digit' },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingMaterialCode'),
        dataIndex: 'packing_material_code',
        render: (val) => val || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingMaterialName'),
        dataIndex: 'packing_material_name',
        render: (val) => val || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBindingMethod'),
        dataIndex: 'binding_method',
        render: (_, r) => bindingMethodTag(r.binding_method),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBarcode'),
        dataIndex: 'barcode',
        render: (val) =>
          val ? <Typography.Text copyable={{ text: String(val) }}>{String(val)}</Typography.Text> : '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colFinishedGoodsReceiptId'),
        dataIndex: 'finished_goods_receipt_id',
        render: (val) => (val != null ? String(val) : '-'),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colSalesDeliveryId'),
        dataIndex: 'sales_delivery_id',
        render: (val) => (val != null ? String(val) : '-'),
      },
      { title: t('app.kuaizhizao.packingBinding.colBoundBy'), dataIndex: 'bound_by_name' },
      { title: t('app.kuaizhizao.packingBinding.colBoundAt'), dataIndex: 'bound_at', valueType: 'dateTime' },
      {
        title: t('app.kuaizhizao.common.fieldNotes'),
        dataIndex: 'remarks',
        span: 3,
        render: (text) => text || '-',
      },
    ],
    [bindingMethodTag, t],
  );

  const renderPbRowActionNodes = useCallback(
    (record: PackingBinding): React.ReactNode[] => {
      const nodes: React.ReactNode[] = [];
      nodes.push(
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
        </Button>
      );
      nodes.push(
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
        </Button>
      );
      nodes.push(
        <Popconfirm {...rowActionKind('delete')}
          key="del"
          title={t('app.kuaizhizao.packingBinding.confirmDeleteOne')}
          onConfirm={() => void handleDeleteOne(record)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => e.stopPropagation()}
          >
            {t('common.delete')}
          </Button>
        </Popconfirm>
      );
      return nodes;
    },
    [handleDetail, handleEdit, t],
  );

  const columns: ProColumns<PackingBinding>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.packingBinding.colBoxNo'),
        dataIndex: 'box_no',
        width: 168,
        ellipsis: true,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.box_no ?? '') }} ellipsis>
            {r.box_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductCode'),
        dataIndex: 'product_code',
        width: 128,
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.product_code ?? '') }} ellipsis>
            {r.product_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductName'),
        dataIndex: 'product_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductSerialNo'),
        dataIndex: 'product_serial_no',
        width: 140,
        ellipsis: true,
        render: (_, r) => r.product_serial_no || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingQty'),
        dataIndex: 'packing_quantity',
        width: 100,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingMaterial'),
        dataIndex: 'packing_material_name',
        width: 140,
        ellipsis: true,
        render: (_, r) => r.packing_material_name || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBindingMethod'),
        dataIndex: 'binding_method',
        width: 100,
        render: (_, r) => bindingMethodTag(r.binding_method),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colSource'),
        dataIndex: 'source_type',
        width: 110,
        hideInSearch: true,
        render: (_, r) => <Tag>{getBindingSourceLabel(r)}</Tag>,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colStatus'),
        dataIndex: 'binding_status',
        width: 90,
        hideInSearch: true,
        render: () => <Tag color="processing">{t('app.kuaizhizao.packingBinding.statusBound')}</Tag>,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBoundBy'),
        dataIndex: 'bound_by_name',
        width: 100,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBoundAt'),
        dataIndex: 'bound_at',
        valueType: 'dateTime',
        width: 168,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colUpdatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        render: (_, r) => {
          const d = r.updated_at;
          return d ? formatDateTime(d, 'YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: t('app.kuaizhizao.packingBinding.colLifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getPackingBindingLifecycle(record as Record<string, unknown>);
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
        width: 200,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          renderPbRowActions(renderPbRowActionNodes(record), `pb-${record.id ?? 'row'}`),
      },
    ],
    [bindingMethodTag, getBindingSourceLabel, renderPbRowActionNodes, t],
  );

  const handleRequest = async (params: any) => {
    try {
      const searchBoxNo = params.box_no || params.keyword;
      const result = (await packingBindingApi.listPage({
        skip: (params.current! - 1) * params.pageSize!,
        limit: params.pageSize,
        receipt_id: params.receipt_id,
        product_id: params.product_id,
        box_no: searchBoxNo,
        uuid: params.uuid,
      })) as PackingBindingPageResult;
      const data = Array.isArray(result?.items) ? result.items : [];
      tableRowsRef.current = data;
      return {
        data,
        success: true,
        total: Number(result?.total || 0),
      };
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.fetchListFailed'));
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.packingBinding.statTotal'),
        value: localStats.total,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_1} color={token.colorPrimary} />,
      },
      {
        title: t('app.kuaizhizao.packingBinding.statScan'),
        value: localStats.scan,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_2} color={token.colorSuccess} />,
      },
      {
        title: t('app.kuaizhizao.packingBinding.statManual'),
        value: localStats.manual,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_3} color={token.colorWarning} />,
      },
    ],
    [localStats.manual, localStats.scan, localStats.total, t, token.colorPrimary, token.colorSuccess, token.colorWarning],
  );

  const taskPoolColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.packingBinding.taskPoolColDeliveryCode'), dataIndex: 'delivery_code', width: 180 },
      { title: t('app.kuaizhizao.packingBinding.taskPoolColCustomer'), dataIndex: 'customer_name', width: 200 },
      { title: t('app.kuaizhizao.packingBinding.taskPoolColReviewStatus'), dataIndex: 'review_status', width: 120 },
      { title: t('app.kuaizhizao.packingBinding.taskPoolColDocStatus'), dataIndex: 'status', width: 120 },
      {
        title: t('app.kuaizhizao.packingBinding.taskPoolColUpdatedAt'),
        dataIndex: 'updated_at',
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('app.kuaizhizao.packingBinding.scopeAlert')}
        />
        <UniTable<PackingBinding>
          headerTitle={t('app.kuaizhizao.packingBinding.title')}
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.packing-binding"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={handleRequest}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.packingBinding.confirmBatchDelete', { count })}
          scroll={{ x: 1900 }}
          toolBarActionsAfterCreate={[
            <Button {...rowActionKind('read')} key="task-pool" onClick={() => void openTaskPool()}>
              {t('app.kuaizhizao.packingBinding.taskPoolButton')}
            </Button>,
          ]}
          toolBarActionsAfterDelete={[
            <UniBatchButton
              key="packing-binding-batch-qrcode"
              selectedRowKeys={selectedRowKeys}
              size="middle"
              icon={<QrcodeOutlined />}
              disabled={
                selectedBindingsForBatch.length > 0 &&
                !packingBindingBatchPrintAllowed(
                  selectedBindingsForBatch,
                  packingBindingPerms.canPrint,
                )
              }
              onAction={() => void handleBatchGenerateQRCode()}
            >
              {t('app.kuaizhizao.packingBinding.batchGenerateQrcode')}
            </UniBatchButton>,
          ]}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={t('app.kuaizhizao.packingBinding.editTitle')}
        open={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setCurrentBindingId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleEditSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormDigit
          name="packing_quantity"
          label={t('app.kuaizhizao.packingBinding.fieldPackingQty')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderPackingQty')}
          rules={[{ required: true, message: t('app.kuaizhizao.packingBinding.ruleEnterPackingQty') }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="box_no"
          label={t('app.kuaizhizao.packingBinding.fieldBoxNo')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderBoxNo')}
        />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.common.fieldNotes')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
        <DocumentAttachmentsField category="packing_binding_attachments" />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.packingBinding.detailTitle')}${currentBinding?.box_no ? ` - ${currentBinding.box_no}` : ''}`}
        open={detailDrawerVisible}
        zIndex={packingBindingDetailDrawerZIndex}
        width={DRAWER_CONFIG.HALF_WIDTH}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBinding(null);
        }}
        columns={[]}
        column={3}
        dataSource={currentBinding || undefined}
        customContent={
          currentBinding && (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Row gutter={16}>
                  <Col xs={24} lg={24}>
                    <Descriptions
                      column={3}
                      size="small"
                      items={buildDescriptionItemsFromColumns(currentBinding, detailBaseColumns)}
                    />
                  </Col>
                </Row>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPackingBindingLifecycle(currentBinding as Record<string, unknown>);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {currentBinding.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='packing_binding'
                      documentId={currentBinding.id}
                      active={detailDrawerVisible}
                      selfDocumentId={currentBinding.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setCurrentBinding(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <Descriptions
                  size="small"
                  column={2}
                  items={[
                    {
                      key: 'sourceDoc',
                      label: t('app.kuaizhizao.packingBinding.detailSourceDoc'),
                      children: currentBinding.sales_delivery_id
                        ? t('app.kuaizhizao.packingBinding.salesDeliveryDoc', { id: currentBinding.sales_delivery_id })
                        : currentBinding.finished_goods_receipt_id
                          ? t('app.kuaizhizao.packingBinding.finishedGoodsReceiptDoc', { id: currentBinding.finished_goods_receipt_id })
                          : '-',
                    },
                    {
                      key: 'sourceType',
                      label: t('app.kuaizhizao.packingBinding.detailCreateSource'),
                      children: getBindingSourceLabel(currentBinding),
                    },
                    {
                      key: 'status',
                      label: t('app.kuaizhizao.packingBinding.colStatus'),
                      children: <Tag color="processing">{t('app.kuaizhizao.packingBinding.statusBound')}</Tag>,
                    },
                    {
                      key: 'bindingMethod',
                      label: t('app.kuaizhizao.packingBinding.colBindingMethod'),
                      children: bindingMethodTag(currentBinding.binding_method),
                    },
                    {
                      key: 'boxNo',
                      label: t('app.kuaizhizao.packingBinding.colBoxNo'),
                      children: currentBinding.box_no || '-',
                    },
                    {
                      key: 'qty',
                      label: t('app.kuaizhizao.packingBinding.detailQty'),
                      children: currentBinding.packing_quantity != null ? String(currentBinding.packing_quantity) : '-',
                    },
                    {
                      key: 'operator',
                      label: t('app.kuaizhizao.packingBinding.detailOperator'),
                      children: currentBinding.bound_by_name || '-',
                    },
                    {
                      key: 'opTime',
                      label: t('app.kuaizhizao.packingBinding.detailOpTime'),
                      children: currentBinding.bound_at ? formatDateTime(currentBinding.bound_at, 'YYYY-MM-DD HH:mm:ss') : '-',
                    },
                  ]}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                {packingTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {packingTracking.error && !packingTracking.loading && (
                  <Typography.Text type="danger">{packingTracking.error}</Typography.Text>
                )}
                {packingTracking.data && !packingTracking.loading && (
                  <DocumentTrackingTimelineBody data={packingTracking.data} />
                )}
                {!packingTracking.loading && !packingTracking.data && !packingTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.noOperations')} />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />

      <Modal
        title={t('app.kuaizhizao.packingBinding.taskPoolTitle')}
        open={taskPoolVisible}
        onCancel={() => setTaskPoolVisible(false)}
        footer={null}
        width={920}
      >
        <Alert
          showIcon
          type="info"
          message={t('app.kuaizhizao.packingBinding.taskPoolSummary', {
            pendingReview: taskPool.pending_review,
            pendingOutbound: taskPool.pending_outbound,
            total: taskPool.total,
          })}
          style={{ marginBottom: 12 }}
        />
        <Table<PackingTaskPoolItem>
          rowKey="id"
          loading={taskPoolLoading}
          dataSource={taskPool.items}
          pagination={false}
          size="small"
          columns={taskPoolColumns}
        />
      </Modal>
    </>
  );
};

export default PackingBindingPage;
