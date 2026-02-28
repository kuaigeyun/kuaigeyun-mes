/**
 * 工装台账页面
 *
 * 提供工装的 CRUD 功能，包括列表展示、创建、编辑等操作。
 * 详情抽屉包含领用记录、维保记录、校验记录 Tab。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Tag, Tabs, Table, Form, Input, InputNumber, Descriptions, DatePicker, Select, Modal, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface Tool {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  spec?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  status?: string;
  is_active?: boolean;
  maintenance_period?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  total_usage_count?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface ToolUsage {
  uuid?: string;
  usage_no?: string;
  operator_name?: string;
  source_type?: string;
  source_no?: string;
  checkout_date?: string;
  checkin_date?: string;
  status?: string;
}

interface ToolMaintenance {
  uuid?: string;
  maintenance_type?: string;
  maintenance_date?: string;
  executor?: string;
  content?: string;
  result?: string;
}

interface ToolCalibration {
  uuid?: string;
  calibration_date?: string;
  calibration_org?: string;
  certificate_no?: string;
  result?: string;
  expiry_date?: string;
}

const ToolLedgerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [toolDetail, setToolDetail] = useState<Tool | null>(null);

  const [usages, setUsages] = useState<ToolUsage[]>([]);
  const [maintenances, setMaintenances] = useState<ToolMaintenance[]>([]);
  const [calibrations, setCalibrations] = useState<ToolCalibration[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [maintLoading, setMaintLoading] = useState(false);
  const [calibLoading, setCalibLoading] = useState(false);

  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [maintModalVisible, setMaintModalVisible] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [usageForm] = Form.useForm();
  const [maintForm] = Form.useForm();
  const [calibForm] = Form.useForm();

  const loadUsages = async (toolUuid: string) => {
    setUsagesLoading(true);
    try {
      const res = await toolApi.listUsages(toolUuid, { limit: 100 });
      setUsages(res.items || []);
    } catch {
      setUsages([]);
    } finally {
      setUsagesLoading(false);
    }
  };
  const loadMaintenances = async (toolUuid: string) => {
    setMaintLoading(true);
    try {
      const res = await toolApi.listMaintenances(toolUuid, { limit: 100 });
      setMaintenances(res.items || []);
    } catch {
      setMaintenances([]);
    } finally {
      setMaintLoading(false);
    }
  };
  const loadCalibrations = async (toolUuid: string) => {
    setCalibLoading(true);
    try {
      const res = await toolApi.listCalibrations(toolUuid, { limit: 100 });
      setCalibrations(res.items || []);
    } catch {
      setCalibrations([]);
    } finally {
      setCalibLoading(false);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentTool(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  const handleEdit = async (record: Tool) => {
    try {
      if (!record.uuid) {
        messageApi.error('工装UUID不存在');
        return;
      }
      const detail = await toolApi.get(record.uuid);
      setIsEdit(true);
      setCurrentTool(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          type: detail.type,
          spec: detail.spec,
          manufacturer: detail.manufacturer,
          supplier: detail.supplier,
          purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
          warranty_expiry: detail.warranty_expiry ? dayjs(detail.warranty_expiry) : null,
          status: detail.status,
          is_active: detail.is_active,
          maintenance_period: detail.maintenance_period,
          needs_calibration: detail.needs_calibration,
          calibration_period: detail.calibration_period,
          description: detail.description,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工装详情失败');
    }
  };

  const handleDetail = async (record: Tool) => {
    try {
      if (!record.uuid) {
        messageApi.error('工装UUID不存在');
        return;
      }
      const detail = await toolApi.get(record.uuid);
      setToolDetail(detail);
      setDrawerVisible(true);
      loadUsages(record.uuid);
      loadMaintenances(record.uuid);
      loadCalibrations(record.uuid);
    } catch (error) {
      messageApi.error('获取工装详情失败');
    }
  };

  const handleCheckout = () => {
    if (!toolDetail?.uuid) return;
    usageForm.resetFields();
    usageForm.setFieldsValue({ tool_uuid: toolDetail.uuid });
    setUsageModalVisible(true);
  };
  const handleSubmitCheckout = async () => {
    try {
      const values = await usageForm.validateFields();
      await toolApi.checkout(values);
      messageApi.success('领用成功');
      setUsageModalVisible(false);
      if (toolDetail?.uuid) {
        loadUsages(toolDetail.uuid);
        const detail = await toolApi.get(toolDetail.uuid);
        setToolDetail(detail);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '领用失败');
    }
  };

  const handleCheckin = async (usageUuid: string) => {
    try {
      await toolApi.checkin(usageUuid);
      messageApi.success('归还成功');
      if (toolDetail?.uuid) {
        loadUsages(toolDetail.uuid);
        const detail = await toolApi.get(toolDetail.uuid);
        setToolDetail(detail);
      }
    } catch (e: any) {
      messageApi.error(e?.message || '归还失败');
    }
  };

  const handleRecordMaintenance = () => {
    if (!toolDetail?.uuid) return;
    maintForm.resetFields();
    maintForm.setFieldsValue({ tool_uuid: toolDetail.uuid, maintenance_date: dayjs() });
    setMaintModalVisible(true);
  };
  const handleSubmitMaintenance = async () => {
    try {
      const values = await maintForm.validateFields();
      const data = {
        ...values,
        maintenance_date: values.maintenance_date?.format?.('YYYY-MM-DD') || values.maintenance_date,
        cost: values.cost ?? 0,
      };
      await toolApi.recordMaintenance(data);
      messageApi.success('维保记录已保存');
      setMaintModalVisible(false);
      if (toolDetail?.uuid) loadMaintenances(toolDetail.uuid);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '保存失败');
    }
  };

  const handleRecordCalibration = () => {
    if (!toolDetail?.uuid) return;
    calibForm.resetFields();
    calibForm.setFieldsValue({ tool_uuid: toolDetail.uuid, calibration_date: dayjs() });
    setCalibModalVisible(true);
  };
  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      const data = {
        ...values,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
      };
      await toolApi.recordCalibration(data);
      messageApi.success('校验记录已保存');
      setCalibModalVisible(false);
      if (toolDetail?.uuid) {
        loadCalibrations(toolDetail.uuid);
        const detail = await toolApi.get(toolDetail.uuid);
        setToolDetail(detail);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '保存失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        purchase_date: values.purchase_date?.format?.('YYYY-MM-DD') || values.purchase_date,
        warranty_expiry: values.warranty_expiry?.format?.('YYYY-MM-DD') || values.warranty_expiry,
      };
      if (isEdit && currentTool?.uuid) {
        await toolApi.update(currentTool.uuid, data);
        messageApi.success('工装更新成功');
      } else {
        await toolApi.create(data);
        messageApi.success('工装创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemType<Tool>[] = [
    { title: '工装编码', dataIndex: 'code' },
    { title: '工装名称', dataIndex: 'name' },
    { title: '工装类型', dataIndex: 'type' },
    { title: '规格型号', dataIndex: 'spec' },
    { title: '制造商', dataIndex: 'manufacturer' },
    { title: '供应商', dataIndex: 'supplier' },
    { title: '采购日期', dataIndex: 'purchase_date', valueType: 'date' },
    { title: '保修到期日', dataIndex: 'warranty_expiry', valueType: 'date' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '领用中': { text: '领用中', color: 'processing' },
          '维修中': { text: '维修中', color: 'warning' },
          '校验中': { text: '校验中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '累计使用次数', dataIndex: 'total_usage_count' },
    { title: '描述', dataIndex: 'description' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  const columns: ProColumns<Tool>[] = [
    { title: '工装编码', dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '工装名称', dataIndex: 'name', width: 200, ellipsis: true },
    { title: '工装类型', dataIndex: 'type', width: 100 },
    { title: '规格型号', dataIndex: 'spec', width: 120, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '领用中': { text: '领用中', color: 'processing' },
          '维修中': { text: '维修中', color: 'warning' },
          '校验中': { text: '校验中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status as string || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '累计使用次数', dataIndex: 'total_usage_count', width: 110 },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => [
        <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>,
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Tool>
          headerTitle="工装台账"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await toolApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取工装列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条工装吗？`,
              onOk: async () => {
                try {
                  for (const uuid of keys) {
                    await toolApi.delete(String(uuid));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
          showCreateButton
          createButtonText="新建工装"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑工装' : '新建工装'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentTool(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-equipment-management-tool"
              name="code"
              label="工装编码"
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label="工装名称"
              placeholder="请输入工装名称"
              rules={[{ required: true, message: '请输入工装名称' }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="TOOL_TYPE"
              name="type"
              label="工装类型"
              placeholder="请选择工装类型"
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="spec" label="规格型号" placeholder="请输入规格型号" />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label="制造商" placeholder="请输入制造商" />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label="供应商" placeholder="请输入供应商" />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label="采购日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="warranty_expiry"
              label="保修到期日"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="TOOL_STATUS"
              name="status"
              label="工装状态"
              placeholder="请选择状态"
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="maintenance_period" label="保养周期（天）" placeholder="请输入保养周期" />
          </Col>
          <Col span={12}>
            <ProFormDigit name="calibration_period" label="校验周期（天）" placeholder="请输入校验周期" />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="description" label="备注" placeholder="请输入备注" fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label="是否启用" />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setToolDetail(null);
          setUsages([]);
          setMaintenances([]);
          setCalibrations([]);
        }}
        title={`工装详情 - ${toolDetail?.code || ''}`}
        columns={detailColumns}
        dataSource={toolDetail}
        width={DRAWER_CONFIG.HALF_WIDTH}
        customContent={
          toolDetail && (
            <Tabs
              defaultActiveKey="basic"
              items={[
                {
                  key: 'basic',
                  label: '基本信息',
                  children: (
                    <Descriptions column={2} size="small">
                      {detailColumns.map((col) => {
                        const val = (toolDetail as any)[col.dataIndex as string];
                        let content: React.ReactNode = val;
                        if (col.valueType === 'dateTime' && val) content = dayjs(val).format('YYYY-MM-DD HH:mm:ss');
                        else if (col.valueType === 'date' && val) content = dayjs(val).format('YYYY-MM-DD');
                        else if (col.render) content = col.render(val, toolDetail, 0, {}, col);
                        return (
                          <Descriptions.Item key={String(col.dataIndex)} label={col.title}>
                            {content ?? '-'}
                          </Descriptions.Item>
                        );
                      })}
                    </Descriptions>
                  ),
                },
                {
                  key: 'usages',
                  label: '领用记录',
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCheckout}>
                          新建领用
                        </Button>
                      </div>
                      <Table<ToolUsage>
                        size="small"
                        loading={usagesLoading}
                        dataSource={usages}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          { title: '领用单号', dataIndex: 'usage_no', width: 140 },
                          { title: '来源类型', dataIndex: 'source_type', width: 100 },
                          { title: '来源单号', dataIndex: 'source_no', width: 120 },
                          { title: '操作人', dataIndex: 'operator_name', width: 90 },
                          {
                            title: '领用时间',
                            dataIndex: 'checkout_date',
                            width: 160,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
                          },
                          {
                            title: '归还时间',
                            dataIndex: 'checkin_date',
                            width: 160,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
                          },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 80,
                            render: (s) => <Tag>{s || '-'}</Tag>,
                          },
                          {
                            title: '操作',
                            width: 80,
                            render: (_, record) =>
                              record.status === '使用中' ? (
                                <Button type="link" size="small" onClick={() => handleCheckin(record.uuid!)}>
                                  归还
                                </Button>
                              ) : null,
                          },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: 'maintenances',
                  label: '维保记录',
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleRecordMaintenance}>
                          新建维保记录
                        </Button>
                      </div>
                      <Table<ToolMaintenance>
                        size="small"
                        loading={maintLoading}
                        dataSource={maintenances}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          { title: '维保类型', dataIndex: 'maintenance_type', width: 100 },
                          {
                            title: '维保日期',
                            dataIndex: 'maintenance_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          { title: '执行人', dataIndex: 'executor', width: 90 },
                          { title: '内容', dataIndex: 'content', ellipsis: true },
                          { title: '结果', dataIndex: 'result', width: 80 },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: 'calibrations',
                  label: '校验记录',
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleRecordCalibration}>
                          新建校验记录
                        </Button>
                      </div>
                      <Table<ToolCalibration>
                        size="small"
                        loading={calibLoading}
                        dataSource={calibrations}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          {
                            title: '校验日期',
                            dataIndex: 'calibration_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          { title: '校验机构', dataIndex: 'calibration_org', width: 120 },
                          { title: '证书编号', dataIndex: 'certificate_no', width: 120 },
                          { title: '结果', dataIndex: 'result', width: 80 },
                          {
                            title: '有效期至',
                            dataIndex: 'expiry_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                        ]}
                      />
                    </>
                  ),
                },
              ]}
            />
          )
        }
      />

      <Modal title="新建领用" open={usageModalVisible} onOk={handleSubmitCheckout} onCancel={() => setUsageModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={usageForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tool_uuid" hidden><Input /></Form.Item>
          <Form.Item name="operator_name" label="领用人"><Input placeholder="请输入领用人" /></Form.Item>
          <Form.Item name="department_name" label="领用部门"><Input placeholder="请输入领用部门" /></Form.Item>
          <Form.Item name="source_type" label="来源类型">
            <Select placeholder="请选择" allowClear options={[
              { label: '工单', value: 'work_order' },
              { label: '生产订单', value: 'production_order' },
              { label: '其他', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="source_no" label="来源单号"><Input placeholder="请输入来源单号" /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} placeholder="请输入备注" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新建维保记录" open={maintModalVisible} onOk={handleSubmitMaintenance} onCancel={() => setMaintModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={maintForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tool_uuid" hidden><Input /></Form.Item>
          <Form.Item name="maintenance_type" label="维保类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '日常保养', value: '日常保养' },
              { label: '定期保养', value: '定期保养' },
              { label: '故障维修', value: '故障维修' },
            ]} />
          </Form.Item>
          <Form.Item name="maintenance_date" label="维保日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="executor" label="执行人"><Input placeholder="请输入执行人" /></Form.Item>
          <Form.Item name="content" label="维保内容"><Input.TextArea rows={2} placeholder="请输入维保内容" /></Form.Item>
          <Form.Item name="result" label="维保结果">
            <Select options={[{ label: '完成', value: '完成' }, { label: '未完成', value: '未完成' }]} />
          </Form.Item>
          <Form.Item name="cost" label="费用" initialValue={0}><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} placeholder="请输入备注" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新建校验记录" open={calibModalVisible} onOk={handleSubmitCalibration} onCancel={() => setCalibModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tool_uuid" hidden><Input /></Form.Item>
          <Form.Item name="calibration_date" label="校验日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="calibration_org" label="校验机构"><Input placeholder="请输入校验机构" /></Form.Item>
          <Form.Item name="certificate_no" label="证书编号"><Input placeholder="请输入证书编号" /></Form.Item>
          <Form.Item name="result" label="校验结果" rules={[{ required: true }]}>
            <Select options={[
              { label: '合格', value: '合格' },
              { label: '不合格', value: '不合格' },
              { label: '准用', value: '准用' },
            ]} />
          </Form.Item>
          <Form.Item name="expiry_date" label="有效期至">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} placeholder="请输入备注" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ToolLedgerPage;
