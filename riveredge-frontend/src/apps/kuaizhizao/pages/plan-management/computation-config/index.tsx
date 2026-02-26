/**
 * 需求计算参数配置页面
 *
 * 提供需求计算参数配置管理功能，支持按不同维度配置参数。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDigit, ProFormTextArea, ProFormSwitch, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Collapse, Row, Col, InputNumber, Input, Switch } from 'antd';
import { EyeOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { 
  listComputationConfigs, 
  getComputationConfig, 
  createComputationConfig, 
  updateComputationConfig, 
  deleteComputationConfig,
  ComputationConfig
} from '../../../services/computation-config';

const { Panel } = Collapse;

const ComputationConfigPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  
  // Modal 相关状态（新建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  
  // 配置维度
  const [configScope, setConfigScope] = useState<'global' | 'material' | 'warehouse' | 'material_warehouse'>('global');

  /**
   * 处理新建配置
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentId(null);
    setConfigScope('global');
    setModalVisible(true);
    formRef.current?.resetFields();
    // 设置默认值
    formRef.current?.setFieldsValue({
      config_scope: 'global',
      is_template: false,
      is_active: true,
      priority: 0,
      computation_params: {
        safety_stock: 0,
        lead_time: 0,
        reorder_point: 0,
        lot_size_rule: 'LFL',  // Lot-for-Lot
        lot_size: 1,
        planning_horizon: 30,
        time_bucket: '周',
      },
    });
  };

  /**
   * 处理编辑配置
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getComputationConfig(id);
        formRef.current?.setFieldsValue(data);
        setConfigScope(data.config_scope || 'global');
      } catch (error: any) {
        messageApi.error('获取配置详情失败');
      }
    }
  };

  /**
   * 处理删除配置
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的配置');
      return;
    }
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${keys.length} 个配置吗？`,
      onOk: async () => {
        try {
          for (const key of keys) {
            await deleteComputationConfig(Number(key));
          }
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error('删除失败');
        }
      },
    });
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      if (isEdit && currentId) {
        await updateComputationConfig(currentId, values);
        messageApi.success('更新成功');
      } else {
        await createComputationConfig(values);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(isEdit ? '更新失败' : '创建失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ComputationConfig>[] = [
    {
      title: '配置编码',
      dataIndex: 'config_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '配置名称',
      dataIndex: 'config_name',
      width: 200,
    },
    {
      title: '配置维度',
      dataIndex: 'config_scope',
      width: 120,
      valueEnum: {
        global: { text: '全局', status: 'Default' },
        material: { text: '按物料', status: 'Processing' },
        warehouse: { text: '按仓库', status: 'Success' },
        material_warehouse: { text: '物料+仓库', status: 'Warning' },
      },
      render: (_, record) => {
        const scopeMap: Record<string, { text: string; color: string }> = {
          global: { text: '全局', color: 'default' },
          material: { text: '按物料', color: 'processing' },
          warehouse: { text: '按仓库', color: 'success' },
          material_warehouse: { text: '物料+仓库', color: 'warning' },
        };
        const scope = scopeMap[record.config_scope || 'global'];
        return <Tag color={scope.color}>{scope.text}</Tag>;
      },
    },
    {
      title: '物料',
      dataIndex: 'material_name',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '是否模板',
      dataIndex: 'is_template',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_template ? 'success' : 'default'}>
          {record.is_template ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
  ];

  /**
   * 处理表格请求
   */
  const handleRequest = async (params: any) => {
    try {
      const response = await listComputationConfigs({
        skip: (params.current - 1) * params.pageSize,
        limit: params.pageSize,
        config_scope: params.config_scope,
        is_template: params.is_template,
        is_active: params.is_active,
        keyword: params.keyword,
      });
      return {
        data: response.data,
        success: true,
        total: response.total,
      };
    } catch (error) {
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<ComputationConfig>
          actionRef={actionRef}
          columns={columns}
          request={handleRequest}
          rowKey="id"
          showCreateButton={true}
          onCreate={handleCreate}
          showEditButton={true}
          onEdit={handleEdit}
          showDeleteButton={true}
          onDelete={handleDelete}
          showAdvancedSearch={true}
        />
      </ListPageTemplate>

      {/* 新建/编辑Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => formRef.current?.submit()}
        title={isEdit ? '编辑参数配置' : '新建参数配置'}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          layout="vertical"
          submitter={false}
        >
          <ProFormText
            name="config_code"
            label="配置编码"
            rules={[{ required: true, message: '请输入配置编码' }]}
            disabled={isEdit}
          />
          <ProFormText
            name="config_name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          />
          
          <ProFormSelect
            name="config_scope"
            label="配置维度"
            options={[
              { label: '全局', value: 'global' },
              { label: '按物料', value: 'material' },
              { label: '按仓库', value: 'warehouse' },
              { label: '物料+仓库', value: 'material_warehouse' },
            ]}
            rules={[{ required: true, message: '请选择配置维度' }]}
            fieldProps={{
              onChange: (value) => setConfigScope(value),
            }}
          />

          <ProFormDependency name={['config_scope']}>
            {({ config_scope }) => {
              if (config_scope === 'material' || config_scope === 'material_warehouse') {
                return (
                  <>
                    <ProFormDigit
                      name="material_id"
                      label="物料ID"
                      rules={[{ required: true, message: '请输入物料ID' }]}
                    />
                    <ProFormText
                      name="material_code"
                      label="物料编码"
                    />
                    <ProFormText
                      name="material_name"
                      label="物料名称"
                    />
                  </>
                );
              }
              return null;
            }}
          </ProFormDependency>

          <ProFormDependency name={['config_scope']}>
            {({ config_scope }) => {
              if (config_scope === 'warehouse' || config_scope === 'material_warehouse') {
                return (
                  <>
                    <ProFormDigit
                      name="warehouse_id"
                      label="仓库ID"
                      rules={[{ required: true, message: '请输入仓库ID' }]}
                    />
                    <ProFormText
                      name="warehouse_code"
                      label="仓库编码"
                    />
                    <ProFormText
                      name="warehouse_name"
                      label="仓库名称"
                    />
                  </>
                );
              }
              return null;
            }}
          </ProFormDependency>

          {/* 计算参数配置（使用Collapse组织） */}
          <ProForm.Item
            name="computation_params"
            label="计算参数"
            rules={[{ required: true, message: '请配置计算参数' }]}
          >
            <ComputationParamsForm />
          </ProForm.Item>

          <ProFormSwitch
            name="is_template"
            label="是否为模板"
          />
          
          <ProFormDependency name={['is_template']}>
            {({ is_template }) => {
              if (is_template) {
                return (
                  <ProFormText
                    name="template_name"
                    label="模板名称"
                    rules={[{ required: true, message: '请输入模板名称' }]}
                  />
                );
              }
              return null;
            }}
          </ProFormDependency>

          <ProFormSwitch
            name="is_active"
            label="是否启用"
            initialValue={true}
          />

          <ProFormDigit
            name="priority"
            label="优先级"
            initialValue={0}
            fieldProps={{ min: 0 }}
          />

          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入配置描述"
          />
        </ProForm>
      </Modal>
    </>
  );
};

/**
 * 计算参数表单组件
 */
const ComputationParamsForm: React.FC<{ value?: Record<string, any>; onChange?: (value: Record<string, any>) => void }> = ({ value, onChange }) => {
  const [params, setParams] = useState<Record<string, any>>(value || {
    safety_stock: 0,
    lead_time: 0,
    reorder_point: 0,
    lot_size_rule: 'LFL',
    lot_size: 1,
    planning_horizon: 30,
    time_bucket: '周',
    include_safety_stock: true,
    include_in_transit: false,
    include_reserved: false,
    include_reorder_point: false,
    consider_capacity: true,
    consider_material_readiness: true,
    consider_equipment_availability: false,
    consider_mold_tool_availability: false,
  });

  React.useEffect(() => {
    if (value) {
      setParams(value);
    }
  }, [value]);

  const handleChange = (key: string, val: any) => {
    const newParams = { ...params, [key]: val };
    setParams(newParams);
    onChange?.(newParams);
  };

  return (
    <Collapse defaultActiveKey={['basic', 'inventory', 'lot', '4m']}>
      <Panel header="基本参数" key="basic">
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>提前期（天）</label>
              <InputNumber
                value={params.lead_time}
                onChange={(val) => handleChange('lead_time', val)}
                min={0}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>时间粒度</label>
              <Input
                value={params.time_bucket}
                onChange={(e) => handleChange('time_bucket', e.target.value)}
                placeholder="日/周/月"
                style={{ width: '100%' }}
              />
            </div>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>计划周期（天）</label>
              <InputNumber
                value={params.planning_horizon}
                onChange={(val) => handleChange('planning_horizon', val)}
                min={1}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
        </Row>
      </Panel>
      
      <Panel header="库存参数" key="inventory">
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>安全库存</label>
              <InputNumber
                value={params.safety_stock}
                onChange={(val) => handleChange('safety_stock', val)}
                min={0}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>再订货点</label>
              <InputNumber
                value={params.reorder_point}
                onChange={(val) => handleChange('reorder_point', val)}
                min={0}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>是否考虑安全库存</label>
              <Switch
                checked={params.include_safety_stock !== false}
                onChange={(checked) => handleChange('include_safety_stock', checked)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>是否考虑在途库存</label>
              <Switch
                checked={params.include_in_transit === true}
                onChange={(checked) => handleChange('include_in_transit', checked)}
              />
            </div>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>是否考虑预留量</label>
              <Switch
                checked={params.include_reserved === true}
                onChange={(checked) => handleChange('include_reserved', checked)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>是否考虑再订货点</label>
              <Switch
                checked={params.include_reorder_point === true}
                onChange={(checked) => handleChange('include_reorder_point', checked)}
              />
            </div>
          </Col>
        </Row>
      </Panel>
      
      <Panel header="批量规则" key="lot">
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>批量规则</label>
              <Input
                value={params.lot_size_rule}
                onChange={(e) => handleChange('lot_size_rule', e.target.value)}
                placeholder="LFL/FOQ/POQ/MIN/MAX"
                style={{ width: '100%' }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>批量大小</label>
              <InputNumber
                value={params.lot_size}
                onChange={(val) => handleChange('lot_size', val)}
                min={1}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
        </Row>
      </Panel>

      <Panel header="4M 人机料法（LRP 计算约束）" key="4m">
        <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>
          勾选表示需求计算时考虑该约束，取消勾选则忽略（适合中小企业按实情选择）
        </div>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>机：考虑产能约束</label>
              <Switch
                checked={params.consider_capacity !== false}
                onChange={(checked) => handleChange('consider_capacity', checked)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>料：考虑物料齐套日期</label>
              <Switch
                checked={params.consider_material_readiness === true}
                onChange={(checked) => handleChange('consider_material_readiness', checked)}
              />
            </div>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>机：考虑设备可用性</label>
              <Switch
                checked={params.consider_equipment_availability === true}
                onChange={(checked) => handleChange('consider_equipment_availability', checked)}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>法：考虑模具/工装占用</label>
              <Switch
                checked={params.consider_mold_tool_availability === true}
                onChange={(checked) => handleChange('consider_mold_tool_availability', checked)}
              />
            </div>
          </Col>
        </Row>
      </Panel>
    </Collapse>
  );
};

export default ComputationConfigPage;
