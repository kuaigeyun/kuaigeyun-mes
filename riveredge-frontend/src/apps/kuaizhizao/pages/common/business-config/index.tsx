/**
 * 业务配置页面
 *
 * 提供业务参数配置、编码规则设置等业务级配置功能
 * 区别于系统级的系统设置，此页面为应用级业务配置
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useState, useRef } from 'react';
import { App, Card, Form, Input, Button, Select, Switch, Tabs, Space, Tag, message, InputNumber, Modal } from 'antd';
import { SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProFormText, ProFormSelect, ProFormTextArea, ProFormDigit, ActionType, ProColumns } from '@ant-design/pro-components';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';

// 系统参数接口定义
interface SystemParameter {
  id: number;
  key: string;
  name: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  category: string;
  description: string;
  options?: string[];
  required: boolean;
}

// 编码规则接口定义
interface CodeRule {
  id: number;
  code: string;
  name: string;
  prefix: string;
  dateFormat: string;
  sequenceLength: number;
  currentSequence: number;
  sample: string;
  description: string;
}

const BusinessConfigPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [parametersForm] = Form.useForm();
  const codeRuleFormRef = useRef<any>();
  const codeRuleActionRef = useRef<ActionType>();
  const [activeTab, setActiveTab] = useState('parameters');
  const [codeRuleModalVisible, setCodeRuleModalVisible] = useState(false);
  const [codeRuleIsEdit, setCodeRuleIsEdit] = useState(false);
  const [currentCodeRule, setCurrentCodeRule] = useState<CodeRule | null>(null);

  // 系统参数数据
  const [systemParameters] = useState<SystemParameter[]>([
    {
      id: 1,
      key: 'company_name',
      name: '公司名称',
      value: '快格轻制造',
      type: 'string',
      category: '基本信息',
      description: '公司或组织名称',
      required: true,
    },
    {
      id: 2,
      key: 'default_warehouse',
      name: '默认仓库',
      value: 'MAIN',
      type: 'select',
      category: '仓储设置',
      description: '系统默认使用的仓库',
      options: ['MAIN', 'SUB1', 'SUB2'],
      required: true,
    },
    {
      id: 3,
      key: 'auto_generate_codes',
      name: '自动生成编码',
      value: 'true',
      type: 'boolean',
      category: '编码设置',
      description: '是否自动生成各类编码',
      required: false,
    },
    {
      id: 4,
      key: 'max_upload_size',
      name: '最大上传大小',
      value: '10',
      type: 'number',
      category: '文件设置',
      description: '文件上传最大大小(MB)',
      required: true,
    },
    {
      id: 5,
      key: 'quality_check_required',
      name: '质量检验必填',
      value: 'true',
      type: 'boolean',
      category: '质量设置',
      description: '是否要求必须进行质量检验',
      required: false,
    },
  ]);

  // 编码规则数据
  const [codeRules, setCodeRules] = useState<CodeRule[]>([
    {
      id: 1,
      code: 'WO',
      name: '工单编码',
      prefix: 'WO',
      dateFormat: 'YYYYMMDD',
      sequenceLength: 3,
      currentSequence: 12,
      sample: 'WO20251229012',
      description: '生产工单的编码规则',
    },
    {
      id: 2,
      code: 'SO',
      name: '销售订单编码',
      prefix: 'SO',
      dateFormat: 'YYYYMMDD',
      sequenceLength: 3,
      currentSequence: 5,
      sample: 'SO20251229005',
      description: '销售订单的编码规则',
    },
    {
      id: 3,
      code: 'IQ',
      name: '来料检验编码',
      prefix: 'IQ',
      dateFormat: 'YYYYMMDD',
      sequenceLength: 3,
      currentSequence: 8,
      sample: 'IQ20251229008',
      description: '来料检验单的编码规则',
    },
    {
      id: 4,
      code: 'PAY',
      name: '应付单编码',
      prefix: 'PAY',
      dateFormat: 'YYYYMMDD',
      sequenceLength: 3,
      currentSequence: 3,
      sample: 'PAY20251229003',
      description: '应付单的编码规则',
    },
  ]);

  // 保存系统参数
  const handleSaveParameters = async (values: any) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      messageApi.success('系统参数保存成功');
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    }
  };

  // 处理编码规则编辑
  const handleEditCodeRule = (record: CodeRule) => {
    setCurrentCodeRule(record);
    setCodeRuleIsEdit(true);
    setCodeRuleModalVisible(true);
    codeRuleFormRef.current?.setFieldsValue(record);
  };

  // 处理编码规则新增
  const handleAddCodeRule = () => {
    setCurrentCodeRule(null);
    setCodeRuleIsEdit(false);
    setCodeRuleModalVisible(true);
    codeRuleFormRef.current?.resetFields();
  };

  // 保存编码规则
  const handleSaveCodeRule = async (values: any) => {
    try {
      const newRule: CodeRule = {
        ...values,
        id: currentCodeRule?.id || Date.now(),
        currentSequence: currentCodeRule?.currentSequence || 0,
        sample: generateSampleCode(values),
      };

      if (currentCodeRule) {
        // 编辑
        setCodeRules(prev => prev.map(rule =>
          rule.id === currentCodeRule.id ? newRule : rule
        ));
        messageApi.success('编码规则更新成功');
      } else {
        // 新增
        setCodeRules(prev => [...prev, newRule]);
        messageApi.success('编码规则创建成功');
      }

      setCodeRuleModalVisible(false);
      codeRuleFormRef.current?.resetFields();
      codeRuleActionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    }
  };

  // 生成示例编码
  const generateSampleCode = (values: any): string => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sequence = String(values.currentSequence || 1).padStart(values.sequenceLength || 3, '0');
    return `${values.prefix}${date}${sequence}`;
  };

  // 删除编码规则
  const handleDeleteCodeRule = (record: CodeRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除编码规则 "${record.name}" 吗？此操作不可撤销。`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setCodeRules(prev => prev.filter(rule => rule.id !== record.id));
        messageApi.success('编码规则删除成功');
      },
    });
  };

  // 编码规则表格列定义
  const codeRuleColumns = [
    {
      title: '编码类型',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '前缀',
      dataIndex: 'prefix',
      width: 80,
    },
    {
      title: '日期格式',
      dataIndex: 'dateFormat',
      width: 100,
    },
    {
      title: '流水号长度',
      dataIndex: 'sequenceLength',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '当前流水号',
      dataIndex: 'currentSequence',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '示例',
      dataIndex: 'sample',
      width: 140,
      render: (sample: string) => <Tag color="blue">{sample}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: CodeRule) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditCodeRule(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteCodeRule(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 渲染参数表单项
  const renderParameterItem = (param: SystemParameter) => {
    switch (param.type) {
      case 'boolean':
        return (
          <Form.Item
            key={param.key}
            label={param.name}
            name={param.key}
            valuePropName="checked"
            tooltip={param.description}
            rules={param.required ? [{ required: true, message: `请输入${param.name}` }] : []}
          >
            <Switch />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item
            key={param.key}
            label={param.name}
            name={param.key}
            tooltip={param.description}
            rules={param.required ? [{ required: true, message: `请输入${param.name}` }] : []}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item
            key={param.key}
            label={param.name}
            name={param.key}
            tooltip={param.description}
            rules={param.required ? [{ required: true, message: `请选择${param.name}` }] : []}
          >
            <Select>
              {param.options?.map(option => (
                <Select.Option key={option} value={option}>{option}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      default:
        return (
          <Form.Item
            key={param.key}
            label={param.name}
            name={param.key}
            tooltip={param.description}
            rules={param.required ? [{ required: true, message: `请输入${param.name}` }] : []}
          >
            <Input />
          </Form.Item>
        );
    }
  };

  // 初始化表单数据
  const initialFormValues = systemParameters.reduce((acc, param) => {
    acc[param.key] = param.type === 'boolean' ? param.value === 'true' : param.value;
    return acc;
  }, {} as any);

  const tabItems = [
    {
      key: 'parameters',
      label: '系统参数',
      children: (
        <Card title="系统参数配置">
          <Form
            form={parametersForm}
            layout="vertical"
            initialValues={initialFormValues}
            onFinish={handleSaveParameters}
          >
            {/* 按类别分组显示 */}
            {['基本信息', '仓储设置', '编码设置', '文件设置', '质量设置'].map(category => {
              const categoryParams = systemParameters.filter(p => p.category === category);
              if (categoryParams.length === 0) return null;

              return (
                <Card
                  key={category}
                  type="inner"
                  title={category}
                  style={{ marginBottom: 16 }}
                >
                  {categoryParams.map(renderParameterItem)}
                </Card>
              );
            })}

            <Form.Item style={{ marginTop: 24 }}>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                保存参数
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'code-rules',
      label: '编码规则',
      children: (
        <UniTable<CodeRule>
              actionRef={codeRuleActionRef}
              headerTitle="编码规则管理"
              rowKey="id"
              columns={codeRuleColumns}
              request={async () => {
                return {
                  data: codeRules,
                  success: true,
                  total: codeRules.length,
                };
              }}
              toolBarRender={() => [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddCodeRule}
                >
                  新增规则
                </Button>,
              ]}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
              }}
            />
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* 编码规则编辑Modal */}
      <FormModalTemplate
        title={codeRuleIsEdit ? '编辑编码规则' : '新增编码规则'}
        open={codeRuleModalVisible}
        onClose={() => {
          setCodeRuleModalVisible(false);
          codeRuleFormRef.current?.resetFields();
        }}
        onFinish={handleSaveCodeRule}
        isEdit={codeRuleIsEdit}
        initialValues={currentCodeRule || {}}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={codeRuleFormRef}
      >
        <ProFormText
          name="name"
          label="规则名称"
          placeholder="请输入规则名称"
          rules={[{ required: true, message: '请输入规则名称' }]}
        />
        <ProFormText
          name="code"
          label="规则编码"
          placeholder="请输入规则编码"
          rules={[{ required: true, message: '请输入规则编码' }]}
        />
        <ProFormText
          name="prefix"
          label="前缀"
          placeholder="请输入编码前缀"
          rules={[{ required: true, message: '请输入前缀' }]}
        />
        <ProFormSelect
          name="dateFormat"
          label="日期格式"
          placeholder="请选择日期格式"
          options={[
            { label: 'YYYYMMDD (20251229)', value: 'YYYYMMDD' },
            { label: 'YYYY-MM-DD (2025-12-29)', value: 'YYYY-MM-DD' },
            { label: 'YYMMDD (251229)', value: 'YYMMDD' },
          ]}
          rules={[{ required: true, message: '请选择日期格式' }]}
        />
        <ProFormDigit
          name="sequenceLength"
          label="流水号长度"
          placeholder="请输入流水号长度"
          min={1}
          max={10}
          rules={[{ required: true, message: '请输入流水号长度' }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入规则描述"
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default BusinessConfigPage;
