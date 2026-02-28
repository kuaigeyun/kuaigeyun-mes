/**
 * 模具管理页面
 *
 * 提供模具的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持模具信息、模具使用、模具维护、模具追溯等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { App, Button, Tag, Space, message, Modal, Tabs, Table, Form, Input, InputNumber, Descriptions, DatePicker, Select, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface Mold {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  status?: string;
  is_active?: boolean;
  description?: string;
  total_usage_count?: number;
  cavity_count?: number;
  design_lifetime?: number;
  maintenance_interval?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface MoldUsage {
  uuid?: string;
  usage_no?: string;
  source_type?: string;
  source_no?: string;
  usage_date?: string;
  usage_count?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
}

interface MoldCalibration {
  uuid?: string;
  mold_uuid?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
}

const MoldsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑模具）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMold, setCurrentMold] = useState<Mold | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [moldDetail, setMoldDetail] = useState<Mold | null>(null);

  // 使用记录相关状态
  const [usages, setUsages] = useState<MoldUsage[]>([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [usageForm] = Form.useForm();

  // 校验记录相关状态
  const [calibrations, setCalibrations] = useState<MoldCalibration[]>([]);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  /**
   * 处理新建模具
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMold(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑模具
   */
  const handleEdit = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error('模具UUID不存在');
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setIsEdit(true);
      setCurrentMold(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          type: detail.type,
          category: detail.category,
          brand: detail.brand,
          model: detail.model,
          serial_number: detail.serial_number,
          manufacturer: detail.manufacturer,
          supplier: detail.supplier,
          purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
          installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
          warranty_period: detail.warranty_period,
          status: detail.status,
          is_active: detail.is_active,
          cavity_count: detail.cavity_count,
          design_lifetime: detail.design_lifetime,
          description: detail.description,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取模具详情失败');
    }
  };

  /**
   * 加载模具使用记录
   */
  const loadUsages = async (moldUuid: string) => {
    setUsagesLoading(true);
    try {
      const res = await moldApi.listUsages({ mold_uuid: moldUuid, limit: 100 });
      setUsages(res.items || []);
    } catch {
      setUsages([]);
    } finally {
      setUsagesLoading(false);
    }
  };

  /**
   * 加载模具校验记录
   */
  const loadCalibrations = async (moldUuid: string) => {
    setCalibLoading(true);
    try {
      const res = await moldApi.listCalibrations(moldUuid, { limit: 100 });
      setCalibrations(res.items || []);
    } catch {
      setCalibrations([]);
    } finally {
      setCalibLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error('模具UUID不存在');
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setMoldDetail(detail);
      setDrawerVisible(true);
      loadUsages(record.uuid);
      loadCalibrations(record.uuid);
    } catch (error) {
      messageApi.error('获取模具详情失败');
    }
  };

  /**
   * 新建使用记录
   */
  const handleCreateUsage = () => {
    if (!moldDetail?.uuid) return;
    usageForm.resetFields();
    usageForm.setFieldsValue({
      mold_uuid: moldDetail.uuid,
      usage_date: dayjs(),
      usage_count: 1,
      status: '使用中',
    });
    setUsageModalVisible(true);
  };

  /**
   * 新建校验记录
   */
  const handleRecordCalibration = () => {
    if (!moldDetail?.uuid) return;
    calibForm.resetFields();
    calibForm.setFieldsValue({ mold_uuid: moldDetail.uuid, calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  /**
   * 提交校验记录
   */
  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      const data = {
        mold_uuid: moldDetail!.uuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
      };
      await moldApi.createCalibration(data);
      messageApi.success('校验记录已保存');
      setCalibModalVisible(false);
      if (moldDetail?.uuid) {
        loadCalibrations(moldDetail.uuid);
        const detail = await moldApi.get(moldDetail.uuid);
        setMoldDetail(detail);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '保存失败');
    }
  };

  /**
   * 提交使用记录
   */
  const handleSubmitUsage = async () => {
    try {
      const values = await usageForm.validateFields();
      const data = {
        mold_uuid: moldDetail!.uuid,
        source_type: values.source_type,
        source_no: values.source_no,
        usage_date: values.usage_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.usage_date,
        usage_count: values.usage_count ?? 1,
        operator_name: values.operator_name,
        status: values.status || '使用中',
      };
      await moldApi.createUsage(data);
      messageApi.success('使用记录创建成功');
      setUsageModalVisible(false);
      if (moldDetail?.uuid) loadUsages(moldDetail.uuid);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '创建失败');
    }
  };

  /**
   * 处理批量删除模具（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条模具吗？`,
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await moldApi.delete(String(uuid));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: values.installation_date ? values.installation_date.format('YYYY-MM-DD') : null,
        cavity_count: values.cavity_count ?? null,
        design_lifetime: values.design_lifetime ?? null,
      };

      if (isEdit && currentMold?.uuid) {
        await moldApi.update(currentMold.uuid, submitData);
        messageApi.success('模具更新成功');
      } else {
        await moldApi.create(submitData);
        messageApi.success('模具创建成功');
      }
      setModalVisible(false);
      setCurrentMold(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<Mold>[] = [
    {
      title: '模具编码',
      dataIndex: 'code',
    },
    {
      title: '模具名称',
      dataIndex: 'name',
    },
    {
      title: '模具类型',
      dataIndex: 'type',
    },
    {
      title: '模具分类',
      dataIndex: 'category',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
    },
    {
      title: '型号',
      dataIndex: 'model',
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
    },
    {
      title: '采购日期',
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: '安装日期',
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: '保修期（月）',
      dataIndex: 'warranty_period',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '使用中': { text: '使用中', color: 'processing' },
          '维护中': { text: '维护中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '腔数（模数）',
      dataIndex: 'cavity_count',
    },
    {
      title: '设计寿命（次）',
      dataIndex: 'design_lifetime',
    },
    {
      title: '累计使用次数',
      dataIndex: 'total_usage_count',
    },
    {
      title: '保养间隔（次）',
      dataIndex: 'maintenance_interval',
    },
    {
      title: '需要校验',
      dataIndex: 'needs_calibration',
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '校验周期（天）',
      dataIndex: 'calibration_period',
    },
    {
      title: '上次校验日期',
      dataIndex: 'last_calibration_date',
      valueType: 'date',
    },
    {
      title: '下次校验日期',
      dataIndex: 'next_calibration_date',
      valueType: 'date',
    },
    {
      title: '描述',
      dataIndex: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<Mold>[] = [
    {
      title: '模具编码',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '模具名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '模具类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '模具分类',
      dataIndex: 'category',
      width: 120,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '使用中': { text: '使用中', color: 'processing' },
          '维护中': { text: '维护中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '累计使用次数',
      dataIndex: 'total_usage_count',
      width: 110,
    },
    {
      title: '寿命进度',
      dataIndex: ['total_usage_count', 'design_lifetime'],
      width: 100,
      render: (_: any, record: Mold) => {
        const total = record.total_usage_count ?? 0;
        const lifetime = record.design_lifetime;
        if (!lifetime || lifetime <= 0) return '-';
        const pct = Math.round((total / lifetime) * 100);
        if (pct >= 100) return <Tag color="error">{pct}%</Tag>;
        if (pct >= 90) return <Tag color="warning">{pct}%</Tag>;
        return `${pct}%`;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_text, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除模具"${record.name}"吗？`,
                onOk: () => handleDelete([record]),
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Mold>
          headerTitle="模具管理"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await moldApi.list({
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
              messageApi.error('获取模具列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText="新建模具"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      {/* 创建/编辑模具 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑模具' : '新建模具'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentMold(null);
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
              pageCode="kuaizhizao-equipment-management-mold"
              name="code"
              label="模具编码"
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label="模具名称"
              placeholder="请输入模具名称"
              rules={[{ required: true, message: '请输入模具名称' }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_TYPE"
              name="type"
              label="模具类型"
              placeholder="请选择模具类型"
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="category" label="模具分类" placeholder="请输入模具分类" />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label="品牌" placeholder="请输入品牌" />
          </Col>
          <Col span={12}>
            <ProFormText name="model" label="型号" placeholder="请输入型号" />
          </Col>
          <Col span={12}>
            <ProFormText name="serial_number" label="序列号" placeholder="请输入序列号" />
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
              placeholder="请选择采购日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label="安装日期"
              placeholder="请选择安装日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="warranty_period"
              label="保修期（月）"
              placeholder="请输入保修期（月）"
              min={0}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="MOLD_STATUS"
              name="status"
              label="模具状态"
              placeholder="请选择模具状态"
              required={true}
              rules={[{ required: true, message: '请选择模具状态' }]}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="cavity_count"
              label="腔数（模数）"
              placeholder="一次成型产出件数"
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="design_lifetime"
              label="设计寿命（次）"
              placeholder="模具设计寿命，用于寿命预警"
              min={1}
              fieldProps={{ precision: 0 }}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label="描述"
              placeholder="请输入描述（可选）"
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label="是否启用" />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 模具详情 Drawer */}
      <DetailDrawerTemplate
        title="模具详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setMoldDetail(null);
          setUsages([]);
          setCalibrations([]);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={moldDetail}
        columns={detailColumns}
        customContent={
          moldDetail && (
            <Tabs
              defaultActiveKey="basic"
              items={[
                {
                  key: 'basic',
                  label: '基本信息',
                  children: (
                    <>
                      {moldDetail.design_lifetime && moldDetail.design_lifetime > 0 && (() => {
                        const total = moldDetail.total_usage_count ?? 0;
                        const threshold = moldDetail.design_lifetime * 0.9;
                        if (total >= moldDetail.design_lifetime) {
                          return <Tag color="error" style={{ marginBottom: 12 }}>寿命已到期，请关注</Tag>;
                        }
                        if (total >= threshold) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>寿命即将到期，请关注</Tag>;
                        }
                        return null;
                      })()}
                      {moldDetail.maintenance_interval && moldDetail.maintenance_interval > 0 && (() => {
                        const total = moldDetail.total_usage_count ?? 0;
                        const remainder = total % moldDetail.maintenance_interval;
                        const nextAt = (Math.floor(total / moldDetail.maintenance_interval) + 1) * moldDetail.maintenance_interval;
                        const left = nextAt - total;
                        if (left > 0 && left <= moldDetail.maintenance_interval * 0.2) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>即将到达保养周期（剩余 {left} 次）</Tag>;
                        }
                        return null;
                      })()}
                      {moldDetail.needs_calibration && moldDetail.next_calibration_date && (() => {
                        const next = dayjs(moldDetail.next_calibration_date);
                        const now = dayjs();
                        const daysLeft = next.diff(now, 'day');
                        if (daysLeft < 0) {
                          return <Tag color="error" style={{ marginBottom: 12 }}>校验已过期，请尽快安排校验</Tag>;
                        }
                        if (daysLeft <= 7) {
                          return <Tag color="warning" style={{ marginBottom: 12 }}>校验即将到期（{daysLeft} 天内）</Tag>;
                        }
                        return null;
                      })()}
                      <Descriptions column={2} size="small">
                        {detailColumns.map((col) => {
                          const val = (moldDetail as any)[col.dataIndex as string];
                          let content: React.ReactNode = val;
                          if (col.valueType === 'dateTime' && val) content = dayjs(val).format('YYYY-MM-DD HH:mm:ss');
                          else if (col.valueType === 'date' && val) content = dayjs(val).format('YYYY-MM-DD');
                          else if (col.render) content = col.render(val, moldDetail, 0, {}, col);
                          return (
                            <Descriptions.Item key={String(col.dataIndex)} label={col.title}>
                              {content ?? '-'}
                            </Descriptions.Item>
                          );
                        })}
                      </Descriptions>
                    </>
                  ),
                },
                {
                  key: 'usages',
                  label: '使用记录',
                  children: (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateUsage}>
                          新建使用记录
                        </Button>
                      </div>
                      <Table<MoldUsage>
                        size="small"
                        loading={usagesLoading}
                        dataSource={usages}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          { title: '使用单号', dataIndex: 'usage_no', width: 140 },
                          { title: '来源类型', dataIndex: 'source_type', width: 100 },
                          { title: '来源单号', dataIndex: 'source_no', width: 120 },
                          {
                            title: '使用日期',
                            dataIndex: 'usage_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          { title: '使用次数', dataIndex: 'usage_count', width: 80 },
                          { title: '操作人', dataIndex: 'operator_name', width: 90 },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 80,
                            render: (s) => <Tag>{s || '-'}</Tag>,
                          },
                          {
                            title: '归还日期',
                            dataIndex: 'return_date',
                            width: 110,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
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
                      <Table<MoldCalibration>
                        size="small"
                        loading={calibLoading}
                        dataSource={calibrations}
                        rowKey="uuid"
                        pagination={false}
                        columns={[
                          {
                            title: '校验日期',
                            dataIndex: 'calibration_date',
                            width: 120,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          {
                            title: '结果',
                            dataIndex: 'result',
                            width: 100,
                            render: (r) => <Tag>{r || '-'}</Tag>,
                          },
                          { title: '证书编号', dataIndex: 'certificate_no', width: 140 },
                          {
                            title: '有效期至',
                            dataIndex: 'expiry_date',
                            width: 120,
                            render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
                          },
                          { title: '备注', dataIndex: 'remark', ellipsis: true },
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

      {/* 新建校验记录 Modal */}
      <Modal
        title="新建校验记录"
        open={calibModalVisible}
        onOk={handleSubmitCalibration}
        onCancel={() => setCalibModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="calibration_date" label="校验日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="校验结果" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '合格', value: '合格' },
                { label: '不合格', value: '不合格' },
                { label: '准用', value: '准用' },
              ]}
            />
          </Form.Item>
          <Form.Item name="certificate_no" label="证书编号">
            <Input placeholder="请输入证书编号" />
          </Form.Item>
          <Form.Item name="expiry_date" label="有效期至">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建使用记录 Modal */}
      <Modal
        title="新建使用记录"
        open={usageModalVisible}
        onOk={handleSubmitUsage}
        onCancel={() => setUsageModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={usageForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型">
            <Select placeholder="请选择" allowClear options={[
              { label: '工单', value: 'work_order' },
              { label: '生产订单', value: 'production_order' },
              { label: '其他', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="source_no" label="来源单号">
            <Input placeholder="请输入来源单号" />
          </Form.Item>
          <Form.Item name="usage_date" label="使用日期" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="usage_count" label="使用次数" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="operator_name" label="操作人">
            <Input placeholder="请输入操作人" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { label: '使用中', value: '使用中' },
              { label: '已归还', value: '已归还' },
              { label: '已报废', value: '已报废' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MoldsPage;

