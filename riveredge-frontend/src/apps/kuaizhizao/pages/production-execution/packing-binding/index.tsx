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

import React, { useRef, useState, useEffect, useCallback } from 'react';
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
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
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

import { qrcodeApi } from '../../../../../services/qrcode';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getPackingBindingLifecycle } from '../../../utils/packingBindingLifecycle';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

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
  created_at?: string;
  updated_at?: string;
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
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
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

function getBindingSourceLabel(record: PackingBinding): string {
  if (record.sales_delivery_id) return '销售出库';
  if (record.finished_goods_receipt_id) return '成品入库';
  return '其他来源';
}

const PB_STAT_SPARK_1 = [3, 4, 5, 4, 6, 5, 7];
const PB_STAT_SPARK_2 = [2, 3, 2, 4, 3, 5, 4];
const PB_STAT_SPARK_3 = [1, 2, 1, 2, 1, 2, 2];

const PackingBindingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const packingBindingDetailDrawerZIndex = token.zIndexPopupBase;
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

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
      messageApi.error(error.message || '获取装箱绑定记录详情失败');
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

  const getErrorMessage = (error: any, fallback: string) => error?.message || fallback;

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
      messageApi.error(getErrorMessage(error, '获取待装箱任务池失败'));
    } finally {
      setTaskPoolLoading(false);
    }
  }, [messageApi]);

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
          messageApi.warning('未找到对应的装箱记录');
        } catch {
          messageApi.error('获取装箱记录失败');
        }
      };
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要生成二维码的装箱记录');
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
        failed.push(`${String(key)}: ${getErrorMessage(error, '生成失败')}`);
      }
    }
    if (failed.length === 0) {
      messageApi.success(`成功生成 ${successCount} 个装箱二维码`);
      return;
    }
    messageApi.warning(`成功 ${successCount} 条，失败 ${failed.length} 条`);
    Modal.error({
      title: '批量生成二维码存在失败项',
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
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取装箱绑定记录详情失败');
    }
  }, [messageApi]);

  const handleEditSubmit = async (values: any) => {
    try {
      if (!currentBindingId) {
        messageApi.error('装箱绑定记录ID不存在');
        return;
      }

      await packingBindingApi.update(currentBindingId.toString(), {
        packing_quantity: values.packing_quantity,
        box_no: values.box_no,
        remarks: values.remarks,
      });
      messageApi.success('装箱绑定记录更新成功');
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
      messageApi.error(error.message || '更新装箱绑定记录失败');
      throw error;
    }
  };

  const handleDeleteOne = async (record: PackingBinding) => {
    try {
      await packingBindingApi.delete(record.id!.toString());
      messageApi.success('装箱绑定记录删除成功');
      if (currentBinding?.id === record.id) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      setSelectedRowKeys([]);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除装箱绑定记录失败');
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的装箱绑定记录');
      return;
    }
    const failed: string[] = [];
    let successCount = 0;
    for (const key of keys) {
      try {
        await packingBindingApi.delete(String(key));
        successCount += 1;
      } catch (error: any) {
        failed.push(`${String(key)}: ${getErrorMessage(error, '删除失败')}`);
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
        messageApi.success(`已删除 ${successCount} 条记录`);
        return;
      }
      messageApi.warning(`删除成功 ${successCount} 条，失败 ${failed.length} 条`);
      Modal.error({
        title: '批量删除存在失败项',
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
      messageApi.error(getErrorMessage(error, '批量删除失败'));
    }
  };

  const bindingMethodTag = (m?: string) => {
    const v = (m || '').trim();
    if (v === 'scan') return <Tag color="success">扫码</Tag>;
    if (v === 'manual') return <Tag>手动</Tag>;
    return <Tag>{v || '-'}</Tag>;
  };

  const detailBaseColumns: ProDescriptionsItemProps<PackingBinding>[] = [
    {
      title: '箱号',
      dataIndex: 'box_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.box_no ?? '') }}>{r.box_no ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '产品编号',
      dataIndex: 'product_code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.product_code ?? '') }}>{r.product_code ?? '-'}</Typography.Text>
      ),
    },
    { title: '产品名称', dataIndex: 'product_name' },
    { title: '产品序列号', dataIndex: 'product_serial_no', render: (t) => t || '-' },
    { title: '装箱数量', dataIndex: 'packing_quantity', valueType: 'digit' },
    { title: '包装物料编号', dataIndex: 'packing_material_code', render: (t) => t || '-' },
    { title: '包装物料名称', dataIndex: 'packing_material_name', render: (t) => t || '-' },
    {
      title: '绑定方式',
      dataIndex: 'binding_method',
      render: (_, r) => bindingMethodTag(r.binding_method),
    },
    {
      title: '条码',
      dataIndex: 'barcode',
      render: (t) =>
        t ? <Typography.Text copyable={{ text: String(t) }}>{String(t)}</Typography.Text> : '-',
    },
    {
      title: '成品入库单ID',
      dataIndex: 'finished_goods_receipt_id',
      render: (t) => (t != null ? String(t) : '-'),
    },
    {
      title: '销售出库单ID',
      dataIndex: 'sales_delivery_id',
      render: (t) => (t != null ? String(t) : '-'),
    },
    { title: '绑定人', dataIndex: 'bound_by_name' },
    { title: '绑定时间', dataIndex: 'bound_at', valueType: 'dateTime' },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 3,
      render: (text) => text || '-',
    },
  ];

  const renderPbRowActionNodes = (record: PackingBinding): React.ReactNode[] => {
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
        详情
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
        编辑
      </Button>
    );
    nodes.push(
      <Popconfirm {...rowActionKind('delete')}
        key="del"
        title="确定要删除这个装箱绑定记录吗？"
        onConfirm={() => void handleDeleteOne(record)}
        okText="确定"
        cancelText="取消"
      >
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()}
        >
          删除
        </Button>
      </Popconfirm>
    );
    return nodes;
  };

  const columns: ProColumns<PackingBinding>[] = [
    {
      title: '箱号',
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
      title: '产品编号',
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
      title: '产品名称',
      dataIndex: 'product_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '产品序列号',
      dataIndex: 'product_serial_no',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.product_serial_no || '-',
    },
    {
      title: '装箱数量',
      dataIndex: 'packing_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '包装物料',
      dataIndex: 'packing_material_name',
      width: 140,
      ellipsis: true,
      render: (_, r) => r.packing_material_name || '-',
    },
    {
      title: '绑定方式',
      dataIndex: 'binding_method',
      width: 100,
      render: (_, r) => bindingMethodTag(r.binding_method),
    },
    {
      title: '来源',
      dataIndex: 'source_type',
      width: 110,
      hideInSearch: true,
      render: (_, r) => <Tag>{getBindingSourceLabel(r)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'binding_status',
      width: 90,
      hideInSearch: true,
      render: () => <Tag color="processing">已绑定</Tag>,
    },
    {
      title: '绑定人',
      dataIndex: 'bound_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '绑定时间',
      dataIndex: 'bound_at',
      valueType: 'dateTime',
      width: 168,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => {
        const d = r.updated_at;
        return d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '生命周期',
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
      title: '操作',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderPbRowActions(renderPbRowActionNodes(record), `pb-${record.id ?? 'row'}`),
    },
  ];

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
      return {
        data,
        success: true,
        total: Number(result?.total || 0),
      };
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, '获取装箱绑定列表失败'));
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = [
    {
      title: '装箱绑定总数',
      value: localStats.total,
      valueStyle: { color: token.colorPrimary },
      backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_1} color={token.colorPrimary} />,
    },
    {
      title: '扫码绑定',
      value: localStats.scan,
      valueStyle: { color: token.colorSuccess },
      backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_2} color={token.colorSuccess} />,
    },
    {
      title: '手动绑定',
      value: localStats.manual,
      valueStyle: { color: token.colorWarning },
      backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_3} color={token.colorWarning} />,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="口径说明：本页“装箱绑定总数”仅统计已创建的装箱绑定记录；“待装箱任务池”统计来自销售出库单待审核/待出库任务。"
        />
        <UniTable<PackingBinding>
          headerTitle="装箱绑定"
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
          deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条装箱绑定记录吗？`}
          scroll={{ x: 1900 }}
          toolBarActionsAfterCreate={[
            <Button {...rowActionKind('read')} key="task-pool" onClick={() => void openTaskPool()}>
              待装箱任务池
            </Button>,
          ]}
          toolBarActionsAfterDelete={[
            <UniBatchMenuButton
              key="packing-binding-batch-menu"
              selectedRowKeys={selectedRowKeys}
              menuItems={[
                {
                  key: 'batch-qrcode',
                  label: '批量生成二维码',
                  icon: <QrcodeOutlined />,
                  onClick: () => void handleBatchGenerateQRCode(),
                },
              ]}
            />,
          ]}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title="编辑装箱绑定记录"
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
          label="装箱数量"
          placeholder="请输入装箱数量"
          rules={[{ required: true, message: '请输入装箱数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="box_no"
          label="箱号"
          placeholder="请输入箱号（留空则自动生成）"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`装箱绑定详情${currentBinding?.box_no ? ` - ${currentBinding.box_no}` : ''}`}
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
              <DetailDrawerSection title="基本信息">
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

              <DetailDrawerSection title="生命周期">
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

              <DetailDrawerSection title="明细信息">
                <Descriptions
                  size="small"
                  column={2}
                  items={[
                    {
                      key: 'sourceDoc',
                      label: '来源单据',
                      children: currentBinding.sales_delivery_id
                        ? `销售出库单 #${currentBinding.sales_delivery_id}`
                        : currentBinding.finished_goods_receipt_id
                          ? `成品入库单 #${currentBinding.finished_goods_receipt_id}`
                          : '-',
                    },
                    {
                      key: 'sourceType',
                      label: '创建来源',
                      children: getBindingSourceLabel(currentBinding),
                    },
                    {
                      key: 'status',
                      label: '状态',
                      children: <Tag color="processing">已绑定</Tag>,
                    },
                    {
                      key: 'bindingMethod',
                      label: '绑定方式',
                      children: bindingMethodTag(currentBinding.binding_method),
                    },
                    {
                      key: 'boxNo',
                      label: '箱号',
                      children: currentBinding.box_no || '-',
                    },
                    {
                      key: 'qty',
                      label: '数量',
                      children: currentBinding.packing_quantity != null ? String(currentBinding.packing_quantity) : '-',
                    },
                    {
                      key: 'operator',
                      label: '操作人',
                      children: currentBinding.bound_by_name || '-',
                    },
                    {
                      key: 'opTime',
                      label: '操作时间',
                      children: currentBinding.bound_at ? dayjs(currentBinding.bound_at).format('YYYY-MM-DD HH:mm:ss') : '-',
                    },
                  ]}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />

      <Modal
        title="待装箱任务池（只读）"
        open={taskPoolVisible}
        onCancel={() => setTaskPoolVisible(false)}
        footer={null}
        width={920}
      >
        <Alert
          showIcon
          type="info"
          message={`待审核 ${taskPool.pending_review} / 待出库 ${taskPool.pending_outbound} / 总计 ${taskPool.total}`}
          style={{ marginBottom: 12 }}
        />
        <Table<PackingTaskPoolItem>
          rowKey="id"
          loading={taskPoolLoading}
          dataSource={taskPool.items}
          pagination={false}
          size="small"
          columns={[
            { title: '出库单号', dataIndex: 'delivery_code', width: 180 },
            { title: '客户', dataIndex: 'customer_name', width: 200 },
            { title: '审核状态', dataIndex: 'review_status', width: 120 },
            { title: '单据状态', dataIndex: 'status', width: 120 },
            {
              title: '更新时间',
              dataIndex: 'updated_at',
              render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default PackingBindingPage;
