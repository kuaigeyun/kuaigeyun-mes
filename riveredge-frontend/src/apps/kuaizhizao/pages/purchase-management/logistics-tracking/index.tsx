/**
 * 采购物流跟踪页面
 *
 * 供应商发货后录入运单号，集中查看在途物流并跟踪轨迹。
 *
 * @author RiverEdge Team
 * @date 2026-03-04
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Form, Select, Input, DatePicker, Row, Col, Card, Descriptions, Empty } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import LogisticsTrackingPanel from '../../../../../components/logistics-tracking-panel';
import { purchaseLogisticsApi, type PurchaseLogistics } from '../../../services/purchase-logistics';
import { listPurchaseOrders, getPurchaseOrder } from '../../../services/purchase';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  在途: { text: '在途', color: 'processing' },
  已签收: { text: '已签收', color: 'success' },
  异常: { text: '异常', color: 'error' },
};

const LogisticsTrackingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRecord, setSelectedRecord] = useState<PurchaseLogistics | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<any>(null);
  const [purchaseOrderList, setPurchaseOrderList] = useState<any[]>([]);

  React.useEffect(() => {
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

  const columns: ProColumns<PurchaseLogistics>[] = [
    { title: '采购订单', dataIndex: 'purchase_order_code', width: 140, ellipsis: true },
    { title: '供应商', dataIndex: 'supplier_name', width: 140, ellipsis: true },
    { title: '承运商', dataIndex: 'carrier', width: 100 },
    { title: '运单号', dataIndex: 'tracking_number', width: 140, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => {
        const c = STATUS_MAP[record.status || ''] || { text: record.status || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '发货日期', dataIndex: 'shipped_at', valueType: 'date', width: 110 },
    { title: '预计到货', dataIndex: 'expected_arrival', valueType: 'date', width: 110 },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
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

  const handleSelectRecord = async (record: PurchaseLogistics) => {
    try {
      const detail = await purchaseLogisticsApi.get(record.id!.toString());
      setSelectedRecord(detail as PurchaseLogistics);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

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

  const handleDeleteSuccess = () => {
    if (selectedRecord) {
      setSelectedRecord(null);
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
          handleDeleteSuccess();
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
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '更新失败');
      throw e;
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <UniTable<PurchaseLogistics>
            headerTitle="采购物流跟踪"
            actionRef={actionRef}
            rowKey="id"
            columns={columns}
            showAdvancedSearch
            showCreateButton
            createButtonText="新建物流记录"
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
                });
                const data = Array.isArray(response) ? response : response?.items || response?.data || [];
                const total = Array.isArray(response) ? response.length : (response as any)?.total ?? data.length;
                return { data, success: true, total };
              } catch {
                messageApi.error('获取列表失败');
                return { data: [], success: false, total: 0 };
              }
            }}
            scroll={{ x: 1000 }}
            onRow={(record) => ({
              onClick: () => handleSelectRecord(record),
              style: { cursor: 'pointer' },
              className: selectedRecord?.id === record.id ? 'ant-table-row-selected' : '',
            })}
          />
        </div>

        <div style={{ width: 400, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="物流跟踪数据" size="small" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {selectedRecord ? (
              <>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="采购订单">{selectedRecord.purchase_order_code}</Descriptions.Item>
                  <Descriptions.Item label="供应商">{selectedRecord.supplier_name}</Descriptions.Item>
                  <Descriptions.Item label="承运商">{selectedRecord.carrier}</Descriptions.Item>
                  <Descriptions.Item label="运单号">{selectedRecord.tracking_number}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    {(() => {
                      const c = STATUS_MAP[selectedRecord.status || ''] || { text: selectedRecord.status || '-', color: 'default' };
                      return <Tag color={c.color}>{c.text}</Tag>;
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="发货日期">{selectedRecord.shipped_at || '-'}</Descriptions.Item>
                  <Descriptions.Item label="预计到货">{selectedRecord.expected_arrival || '-'}</Descriptions.Item>
                  {selectedRecord.notes && <Descriptions.Item label="备注">{selectedRecord.notes}</Descriptions.Item>}
                </Descriptions>
                {selectedRecord.carrier && selectedRecord.tracking_number && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>物流轨迹</div>
                    <LogisticsTrackingPanel
                      carrier={selectedRecord.carrier}
                      trackingNumber={selectedRecord.tracking_number}
                    />
                  </div>
                )}
              </>
            ) : (
              <Empty description="点击左侧列表行查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
            )}
          </Card>

          <Card title="地图轨迹" size="small" style={{ flex: 1, minHeight: 200 }}>
            <Empty
              description="若物流数据支持经纬度，将在此显示地图轨迹"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: 24 }}
            />
          </Card>
        </div>
      </div>

      <FormModalTemplate
        title="新建物流记录"
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
