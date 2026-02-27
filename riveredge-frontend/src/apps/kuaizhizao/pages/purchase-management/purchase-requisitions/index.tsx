/**
 * 采购申请管理页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Table, Form, Input, Select, Dropdown, Row, Col } from 'antd';
import { EyeOutlined, SendOutlined, SwapOutlined, ThunderboltOutlined, MoreOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerActions, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import {
  listPurchaseRequisitions,
  getPurchaseRequisition,
  submitPurchaseRequisition,
  convertToPurchaseOrder,
  urgentPurchase,
  PurchaseRequisition,
  PurchaseRequisitionItem,
} from '../../../services/purchase-requisition';
import { getPurchaseRequisitionLifecycle } from '../../../utils/purchaseRequisitionLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { supplierApi } from '../../../../master-data/services/supply-chain';

const PurchaseRequisitionsPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReq, setCurrentReq] = useState<PurchaseRequisition | null>(null);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; code?: string; name: string }>>([]);

  useEffect(() => {
    supplierApi.list?.({ isActive: true } as any).then((res: any) => {
      const list = Array.isArray(res) ? res : res?.data || res?.results || [];
      setSupplierList(list);
    }).catch(() => setSupplierList([]));
  }, []);

  const columns: ProColumns<PurchaseRequisition>[] = [
    { title: '申请编码', dataIndex: 'requisition_code', width: 150, fixed: 'left' },
    { title: '申请名称', dataIndex: 'requisition_name', width: 180 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'Default' },
        '待审核': { text: '待审核', status: 'Processing' },
        '已驳回': { text: '已驳回', status: 'Error' },
        '已通过': { text: '已通过', status: 'Success' },
        '部分转单': { text: '部分转单', status: 'Warning' },
        '全部转单': { text: '全部转单', status: 'Success' },
      },
      render: (_, record) => {
        const lifecycle = getPurchaseRequisitionLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'processing',
          已驳回: 'error',
          已通过: 'success',
          部分转单: 'warning',
          全部转单: 'success',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    { title: '来源', dataIndex: 'source_code', width: 140 },
    { title: '要求到货日期', dataIndex: 'required_date', valueType: 'date', width: 120 },
    { title: '明细数', dataIndex: 'items_count', width: 80, align: 'center' },
    {
      title: '紧急',
      dataIndex: 'is_urgent',
      width: 70,
      render: (v) => (v ? <Tag color="red">紧急</Tag> : '-'),
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const moreItems = [
          ...(record.status === '草稿' || record.status === '待审核'
            ? [{ key: 'urgent', label: '紧急采购', icon: <ThunderboltOutlined />, onClick: () => handleUrgent(record) }]
            : []),
        ]
        return (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
            {record.status === '草稿' && (
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSubmit(record)}>提交</Button>
            )}
            {(record.status === '已通过' || record.status === '部分转单') && (
              <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(record)}>转采购单</Button>
            )}
            {moreItems.length > 0 && (
              <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                <Button type="link" size="small" icon={<MoreOutlined />}>更多</Button>
              </Dropdown>
            )}
          </Space>
        )
      },
    },
  ];

  const handleDetail = async (record: PurchaseRequisition) => {
    try {
      const detail = await getPurchaseRequisition(record.id!);
      setCurrentReq(detail);
      setDetailVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleSubmit = async (record: PurchaseRequisition) => {
    modalApi.confirm({
      title: '提交采购申请',
      content: `确定要提交采购申请 ${record.requisition_code} 吗？`,
      onOk: async () => {
        try {
          await submitPurchaseRequisition(record.id!);
          messageApi.success('提交成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || '提交失败');
        }
      },
    });
  };

  const convertFormRef = React.useRef<{ selectedIds: number[]; supplierId: number; supplierName: string }>({
    selectedIds: [],
    supplierId: 0,
    supplierName: '',
  });

  const handleConvert = async (record: PurchaseRequisition) => {
    try {
      const detail = await getPurchaseRequisition(record.id!);
      const unconverted = (detail.items || []).filter((i) => !i.purchase_order_id);
      if (unconverted.length === 0) {
        messageApi.info('无可转单的明细');
        return;
      }
      convertFormRef.current = {
        selectedIds: unconverted.map((i) => i.id!).filter(Boolean),
        supplierId: unconverted[0]?.supplier_id || supplierList[0]?.id || 0,
        supplierName: supplierList.find((s) => s.id === (unconverted[0]?.supplier_id || supplierList[0]?.id))?.name || '',
      };

      modalApi.confirm({
        title: '转采购单',
        width: 560,
        content: (
          <ConvertForm
            items={unconverted}
            suppliers={supplierList}
            formRef={convertFormRef}
          />
        ),
        onOk: async () => {
          const { selectedIds, supplierId, supplierName } = convertFormRef.current;
          if (selectedIds.length === 0 || !supplierId) {
            messageApi.error('请选择要转单的明细和供应商');
            return Promise.reject();
          }
          try {
            const res = await convertToPurchaseOrder(record.id!, {
              item_ids: selectedIds,
              supplier_id: supplierId,
              supplier_name: supplierName,
            });
            messageApi.success(res.message || '转单成功');
            actionRef.current?.reload();
          } catch (e: any) {
            messageApi.error(e?.response?.data?.detail || '转单失败');
            return Promise.reject();
          }
        },
      });
    } catch {
      messageApi.error('加载详情失败');
    }
  };

  const handleUrgent = (record: PurchaseRequisition) => {
    let reason = '';
    modalApi.confirm({
      title: '紧急采购',
      content: (
        <Form layout="vertical">
          <Form.Item label="紧急原因" required>
            <Input.TextArea
              rows={3}
              placeholder="请输入紧急原因（如：客户加急、设备故障补件）"
              onChange={(e) => (reason = e.target.value)}
            />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!reason?.trim()) {
          messageApi.error('请填写紧急原因');
          return Promise.reject();
        }
        try {
          await urgentPurchase(record.id!, { urgent_reason: reason.trim() });
          messageApi.success('紧急采购完成');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || '操作失败');
          return Promise.reject();
        }
      },
    });
  };

  const detailColumns: ProDescriptionsItemProps<PurchaseRequisition>[] = [
    { title: '申请编码', dataIndex: 'requisition_code' },
    { title: '申请名称', dataIndex: 'requisition_name' },
    { title: '状态', dataIndex: 'status', render: (v: any) => <Tag>{v}</Tag> },
    { title: '来源', dataIndex: 'source_code' },
    { title: '要求到货日期', dataIndex: 'required_date' },
    { title: '是否紧急', dataIndex: 'is_urgent', render: (v: any) => (v ? '是' : '否') },
    { title: '紧急原因', dataIndex: 'urgent_reason', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="采购申请"
          actionRef={actionRef}
          request={async (params: any) => {
            const res = await listPurchaseRequisitions({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              status: params.lifecycle ?? params.status,
              source_type: params.source_type,
            });
            return {
              data: res.data || [],
              total: res.total || 0,
              success: res.success ?? true,
            };
          }}
          columns={columns}
          rowKey="id"
          showAdvancedSearch={true}
          search={false}
          toolBarRender={() => []}
        />
      </ListPageTemplate>
      <DetailDrawerTemplate
        title={`采购申请详情 - ${currentReq?.requisition_code || ''}`}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setCurrentReq(null);
        }}
        dataSource={currentReq || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentReq && (
            <DetailDrawerActions
              items={[
                { key: 'submit', visible: currentReq.status === '草稿', render: () => <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSubmit(currentReq)}>提交</Button> },
                { key: 'convert', visible: currentReq.status === '已通过' || currentReq.status === '部分转单', render: () => <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(currentReq)}>转采购单</Button> },
              ]}
            />
          )
        }
        customContent={
          currentReq && (
            <>
              <DetailDrawerSection title="基本信息">
                <Row gutter={16}>
                  <Col span={8}><strong>申请编码：</strong>{currentReq.requisition_code}</Col>
                  <Col span={8}><strong>申请名称：</strong>{currentReq.requisition_name}</Col>
                  <Col span={8}><strong>状态：</strong><Tag>{currentReq.status}</Tag></Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}><strong>来源：</strong>{currentReq.source_code || '-'}</Col>
                  <Col span={8}><strong>要求到货日期：</strong>{currentReq.required_date || '-'}</Col>
                  <Col span={8}><strong>是否紧急：</strong>{currentReq.is_urgent ? '是' : '否'}</Col>
                </Row>
              </DetailDrawerSection>
              {(() => {
                const lifecycle = getPurchaseRequisitionLifecycle(currentReq);
                const mainStages = lifecycle.mainStages ?? [];
                const subStages = lifecycle.subStages ?? [];
                if (mainStages.length === 0 && subStages.length === 0) return null;
                return (
                  <DetailDrawerSection title="生命周期">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {mainStages.length > 0 && (
                        <UniLifecycleStepper
                          steps={mainStages}
                          status={lifecycle.status}
                          showLabels
                          nextStepSuggestions={lifecycle.nextStepSuggestions}
                        />
                      )}
                      {subStages.length > 0 && (
                        <div>
                          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                            执行中 · 全链路
                          </div>
                          <UniLifecycleStepper steps={subStages} showLabels />
                        </div>
                      )}
                    </div>
                  </DetailDrawerSection>
                );
              })()}
              {currentReq.items && currentReq.items.length > 0 && (
            <DetailDrawerSection title="申请明细">
              <Table
                size="small"
                columns={[
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' },
                  { title: '单位', dataIndex: 'unit', width: 60 },
                  { title: '建议单价', dataIndex: 'suggested_unit_price', width: 100, align: 'right' },
                  { title: '要求到货日期', dataIndex: 'required_date', width: 120 },
                  {
                    title: '已转单',
                    dataIndex: 'purchase_order_id',
                    width: 80,
                    render: (v) => (v ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
                  },
                ]}
                dataSource={currentReq.items}
                pagination={false}
                rowKey="id"
                bordered
              />
            </DetailDrawerSection>
              )}
              {currentReq?.id && (
                <DetailDrawerSection title="操作历史">
                  <DocumentTrackingPanel documentType="purchase_requisition" documentId={currentReq.id} />
                </DetailDrawerSection>
              )}
            </>
          )
        }
      />
    </>
  );
};

const ConvertForm: React.FC<{
  items: PurchaseRequisitionItem[];
  suppliers: Array<{ id: number; code?: string; name: string }>;
  formRef: React.MutableRefObject<{ selectedIds: number[]; supplierId: number; supplierName: string }>;
}> = ({ items, suppliers, formRef }) => {
  const [selected, setSelected] = useState<number[]>(items.map((i) => i.id!).filter(Boolean));
  const [supplierId, setSupplierId] = useState<number>(items[0]?.supplier_id || suppliers[0]?.id || 0);

  useEffect(() => {
    formRef.current.selectedIds = selected;
    formRef.current.supplierId = supplierId;
    formRef.current.supplierName = suppliers.find((x) => x.id === supplierId)?.name || '';
  }, [selected, supplierId, suppliers, formRef]);

  return (
    <div>
      <p style={{ marginBottom: 8 }}>选择要转单的明细（可多选）：</p>
      <Table
        size="small"
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as number[]),
        }}
        columns={[
          { title: '物料编码', dataIndex: 'material_code', width: 110 },
          { title: '物料名称', dataIndex: 'material_name', width: 140 },
          { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
        ]}
        dataSource={items}
        pagination={false}
        rowKey="id"
      />
      <p style={{ marginTop: 16, marginBottom: 8 }}>选择供应商：</p>
      <Select
        style={{ width: '100%' }}
        placeholder="请选择供应商"
        value={supplierId || undefined}
        onChange={(v: number) => setSupplierId(v)}
        options={suppliers.map((s) => ({ label: `${s.code || ''} - ${s.name}`.trim(), value: s.id }))}
      />
    </div>
  );
};

export default PurchaseRequisitionsPage;
