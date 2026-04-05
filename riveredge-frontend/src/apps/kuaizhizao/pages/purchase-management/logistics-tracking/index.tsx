/**
 * 采购物流跟踪页面
 *
 * 供应商发货后录入运单号，集中查看在途物流并跟踪轨迹。
 * 列表与详情遵循 UI_Standard / riveredge-detail-drawer-ui。
 *
 * @author RiverEdge Team
 * @date 2026-03-04
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  Row,
  Col,
  Descriptions,
  Empty,
  Typography,
  Divider,
  theme,
} from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import LogisticsTrackingPanel from '../../../../../components/logistics-tracking-panel';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { purchaseLogisticsApi, type PurchaseLogistics } from '../../../services/purchase-logistics';
import { listPurchaseOrders, getPurchaseOrder } from '../../../services/purchase';
import { usePageMetrics } from '../../../../../hooks/usePageMetrics';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  在途: { text: '在途', color: 'processing' },
  已签收: { text: '已签收', color: 'success' },
  异常: { text: '异常', color: 'error' },
};

/** 指标卡迷你图：稳定引用，避免 SimpleSparkline 重复 update */
const LT_STAT_SPARK_1 = [12, 14, 13, 15, 16, 18, 17];
const LT_STAT_SPARK_2 = [8, 6, 7, 5, 4, 3, 2];
const LT_STAT_SPARK_3 = [20, 22, 25, 28, 30, 32, 35];
const LT_STAT_SPARK_4 = [1, 2, 1, 3, 2, 1, 2];

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
      content = col.render(content, dataSource, index, {}, col);
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

/** 物流状态 → UniLifecycle（列表列与详情步骤条共用） */
function getLogisticsLifecycle(record: PurchaseLogistics) {
  const s = (record.status || '').trim();
  const main: SubStage[] = [
    { key: 'transit', label: '在途', status: 'pending' },
    { key: 'signed', label: '已签收', status: 'pending' },
  ];
  if (s === '已签收') {
    main[0].status = 'done';
    main[1].status = 'done';
    return {
      percent: 100,
      stageName: '已签收',
      status: 'success',
      mainStages: main,
    };
  }
  if (s === '异常') {
    return {
      percent: 50,
      stageName: '异常',
      status: 'exception',
      mainStages: [
        { key: 'transit', label: '在途', status: 'done' },
        { key: 'err', label: '异常', status: 'active' },
      ],
    };
  }
  main[0].status = 'active';
  main[1].status = 'pending';
  return {
    percent: 45,
    stageName: '在途',
    status: 'active',
    mainStages: main,
  };
}

const LogisticsTrackingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const location = useLocation();
  const actionRef = useRef<ActionType>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, inTransit: 0, delivered: 0, exception: 0 });

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics(location.pathname);

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await purchaseLogisticsApi.list({ skip: 0, limit: 5000 });
      const data = Array.isArray(response) ? response : (response as any)?.items || (response as any)?.data || [];
      const arr = Array.isArray(data) ? data : [];
      setLocalStats({
        total: (response as any)?.total ?? arr.length,
        inTransit: arr.filter((x: PurchaseLogistics) => (x.status || '').trim() === '在途').length,
        delivered: arr.filter((x: PurchaseLogistics) => (x.status || '').trim() === '已签收').length,
        exception: arr.filter((x: PurchaseLogistics) => (x.status || '').trim() === '异常').length,
      });
    } catch {
      setLocalStats({ total: 0, inTransit: 0, delivered: 0, exception: 0 });
    }
  }, []);

  useEffect(() => {
    if (!hasPageMetricConfig) {
      refreshLocalStats();
    }
  }, [hasPageMetricConfig, statsVersion, refreshLocalStats]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<PurchaseLogistics | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<any>(null);
  const [purchaseOrderList, setPurchaseOrderList] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await listPurchaseOrders({ limit: 500 });
        setPurchaseOrderList(res?.data || []);
      } catch {
        setPurchaseOrderList([]);
      }
    };
    load();
  }, []);

  const openDetail = async (record: PurchaseLogistics) => {
    try {
      const detail = await purchaseLogisticsApi.get(record.id!.toString());
      setDetailRecord(detail as PurchaseLogistics);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const detailColumns: ProDescriptionsItemProps<PurchaseLogistics>[] = [
    {
      title: '采购订单',
      dataIndex: 'purchase_order_code',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.purchase_order_code ?? '') }}>
          {entity.purchase_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '承运商', dataIndex: 'carrier' },
    {
      title: '运单号',
      dataIndex: 'tracking_number',
      render: (_, entity) => (
        <Typography.Text copyable={{ text: String(entity.tracking_number ?? '') }}>
          {entity.tracking_number ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => {
        const c = STATUS_MAP[String(v) || ''] || { text: String(v || '-'), color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '发货日期', dataIndex: 'shipped_at', valueType: 'date' },
    { title: '预计到货', dataIndex: 'expected_arrival', valueType: 'date' },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 3,
      render: (t) => t || '-',
    },
  ];

  const columns: ProColumns<PurchaseLogistics>[] = [
    {
      title: '采购订单',
      dataIndex: 'purchase_order_code',
      width: 148,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_order_code ?? '') }} ellipsis>
          {r.purchase_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name', width: 140, ellipsis: true },
    { title: '承运商', dataIndex: 'carrier', width: 100 },
    {
      title: '运单号',
      dataIndex: 'tracking_number',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.tracking_number ?? '') }} ellipsis>
          {r.tracking_number ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '发货日期', dataIndex: 'shipped_at', valueType: 'date', width: 110 },
    { title: '预计到货', dataIndex: 'expected_arrival', valueType: 'date', width: 110 },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getLogisticsLifecycle(record);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
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
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); openDetail(record); }}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(record); }}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(record); }}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleEdit = async (record: PurchaseLogistics) => {
    try {
      const detail = await purchaseLogisticsApi.get(record.id!.toString());
      formRef.current?.setFieldsValue({
        carrier: detail.carrier,
        tracking_number: detail.tracking_number,
        shipped_at: detail.shipped_at ? dayjs(detail.shipped_at) : undefined,
        expected_arrival: detail.expected_arrival ? dayjs(detail.expected_arrival) : undefined,
        status: detail.status,
        notes: detail.notes,
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleDelete = (record: PurchaseLogistics) => {
    Modal.confirm({
      title: '删除物流记录',
      content: `确定要删除运单号 "${record.tracking_number}" 的物流记录吗？`,
      onOk: async () => {
        try {
          await purchaseLogisticsApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          if (detailRecord?.id === record.id) {
            setDetailRecord(null);
            setDetailDrawerVisible(false);
          }
          setStatsVersion((v) => v + 1);
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '删除失败');
        }
      },
    });
  };

  const onPurchaseOrderSelect = async (orderId: number) => {
    const order = purchaseOrderList.find((o: any) => (o.id ?? o.purchase_order_id) === orderId);
    if (!order) return;
    let detail = order;
    try {
      detail = await getPurchaseOrder(orderId);
    } catch {
      // use list data
    }
    const code = detail.order_code || detail.purchase_order_code || detail.code;
    formRef.current?.setFieldsValue({
      purchase_order_code: code,
      supplier_id: detail.supplier_id,
      supplier_name: detail.supplier_name,
    });
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      await purchaseLogisticsApi.create({
        purchase_order_id: values.purchase_order_id,
        purchase_order_code: values.purchase_order_code,
        supplier_id: values.supplier_id,
        supplier_name: values.supplier_name,
        carrier: values.carrier,
        tracking_number: values.tracking_number,
        shipped_at: values.shipped_at ? dayjs(values.shipped_at).format('YYYY-MM-DD') : undefined,
        expected_arrival: values.expected_arrival ? dayjs(values.expected_arrival).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setStatsVersion((v) => v + 1);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '创建失败');
      throw e;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    try {
      await purchaseLogisticsApi.update(editingId.toString(), {
        carrier: values.carrier,
        tracking_number: values.tracking_number,
        shipped_at: values.shipped_at ? dayjs(values.shipped_at).format('YYYY-MM-DD') : undefined,
        expected_arrival: values.expected_arrival ? dayjs(values.expected_arrival).format('YYYY-MM-DD') : undefined,
        status: values.status,
        notes: values.notes,
      });
      messageApi.success('更新成功');
      setEditModalVisible(false);
      setStatsVersion((v) => v + 1);
      actionRef.current?.reload();
      if (detailRecord?.id === editingId) {
        const fresh = await purchaseLogisticsApi.get(editingId.toString());
        setDetailRecord(fresh as PurchaseLogistics);
      }
    } catch (e: any) {
      messageApi.error(e?.message || '更新失败');
      throw e;
    }
  };

  const statCards: StatCard[] =
    hasPageMetricConfig && pageMetricCards.length > 0
    ? pageMetricCards
    : [
        {
          title: '物流记录数',
          value: localStats.total,
          valueStyle: { color: token.colorPrimary },
          backgroundChart: <SimpleSparkline data={LT_STAT_SPARK_1} color={token.colorPrimary} />,
        },
        {
          title: '在途',
          value: localStats.inTransit,
          valueStyle: { color: '#faad14' },
          backgroundChart: <SimpleSparkline data={LT_STAT_SPARK_2} color="#faad14" />,
        },
        {
          title: '已签收',
          value: localStats.delivered,
          valueStyle: { color: token.colorSuccess },
          backgroundChart: <SimpleSparkline data={LT_STAT_SPARK_3} color={token.colorSuccess} />,
        },
        {
          title: '异常',
          value: localStats.exception,
          valueStyle: { color: token.colorError },
          backgroundChart: <SimpleSparkline data={LT_STAT_SPARK_4} color={token.colorError} />,
        },
      ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseLogistics>
          headerTitle="采购物流跟踪"
          columnPersistenceId="kuaizhizao-logistics-tracking"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新建物流跟踪"
          onCreate={() => {
            setCreateModalVisible(true);
            setTimeout(() => formRef.current?.resetFields(), 0);
          }}
          request={async (params) => {
            try {
              const response = await purchaseLogisticsApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                purchase_order_id: params.purchase_order_id,
                supplier_id: params.supplier_id,
                tracking_number: params.tracking_number,
                carrier: params.carrier,
                status: params.status,
                keyword: params.keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : (response as any)?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1280 }}
          onRow={(record) => ({
            onClick: () => openDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate<PurchaseLogistics>
        title={detailRecord ? `物流跟踪 - ${detailRecord.tracking_number || detailRecord.purchase_order_code || ''}` : '物流跟踪'}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDetailRecord(null);
        }}
        dataSource={detailRecord || undefined}
        columns={[]}
        column={3}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detailRecord && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setDetailDrawerVisible(false);
                        handleEdit(detailRecord);
                      }}
                    >
                      编辑
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  render: () => (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(detailRecord)}>
                      删除
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        customContent={
          detailRecord && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(detailRecord, detailColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getLogisticsLifecycle(detailRecord);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                      />
                    );
                  })()}
                  {detailRecord.carrier && detailRecord.tracking_number && (
                    <>
                      <Divider style={{ margin: 0 }} />
                      <Typography.Title level={5} style={{ margin: '0 0 8px' }}>
                        物流轨迹
                      </Typography.Title>
                      <LogisticsTrackingPanel carrier={detailRecord.carrier} trackingNumber={detailRecord.tracking_number} />
                    </>
                  )}
                  <Divider style={{ margin: 0 }} />
                  <Typography.Title level={5} style={{ margin: '0 0 8px' }}>
                    地图轨迹
                  </Typography.Title>
                  <Empty
                    description="若物流数据支持经纬度，将在此显示地图轨迹"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本单据无行明细，物流节点见「生命周期」" />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无系统操作记录" />
              </DetailDrawerSection>
            </>
          )
        }
      />

      <FormModalTemplate
        title="新建物流跟踪"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.DEFAULT_WIDTH}
        grid={false}
      >
        <Form.Item name="purchase_order_code" label="采购订单号" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="supplier_id" label="供应商ID" hidden>
          <Input />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="purchase_order_id" label="采购订单" rules={[{ required: true }]}>
              <Select
                placeholder="请选择采购订单"
                options={purchaseOrderList.map((o: any) => ({
                  value: o.id ?? o.purchase_order_id,
                  label: `${o.order_code || o.purchase_order_code || o.code || ''} - ${o.supplier_name || ''}`,
                }))}
                onChange={onPurchaseOrderSelect}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="supplier_name" label="供应商" rules={[{ required: true }]}>
              <Input placeholder="供应商名称" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="carrier" label="承运商" rules={[{ required: true }]}>
              <Input placeholder="如：顺丰、中通、圆通" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tracking_number" label="运单号" rules={[{ required: true }]}>
              <Input placeholder="物流运单号" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="shipped_at" label="发货日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="expected_arrival" label="预计到货日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} placeholder="可选" />
        </Form.Item>
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑物流记录"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.DEFAULT_WIDTH}
        grid={false}
      >
        <Form.Item name="carrier" label="承运商" rules={[{ required: true }]}>
          <Input placeholder="如：顺丰、中通、圆通" />
        </Form.Item>
        <Form.Item name="tracking_number" label="运单号" rules={[{ required: true }]}>
          <Input placeholder="物流运单号" />
        </Form.Item>
        <Form.Item name="shipped_at" label="发货日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="expected_arrival" label="预计到货日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            options={[
              { label: '在途', value: '在途' },
              { label: '已签收', value: '已签收' },
              { label: '异常', value: '异常' },
            ]}
          />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
      </FormModalTemplate>
    </>
  );
};

export default LogisticsTrackingPage;
