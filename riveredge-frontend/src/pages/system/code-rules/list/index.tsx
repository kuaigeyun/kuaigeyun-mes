/**
 * 编码规则管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的编码规则。
 * 支持编码规则的 CRUD 操作和编码生成测试。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Alert, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ExperimentOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getCodeRuleList,
  getCodeRuleByUuid,
  createCodeRule,
  updateCodeRule,
  deleteCodeRule,
  testGenerateCode,
  CodeRule,
  CreateCodeRuleData,
  UpdateCodeRuleData,
} from '../../../../services/codeRule';

const { Text, Paragraph } = Typography;

/**
 * 编码规则管理列表页面组件
 */
const CodeRuleListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑规则）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentRuleUuid, setCurrentRuleUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<CodeRule | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 测试生成 Modal 状态
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  const [currentRuleForTest, setCurrentRuleForTest] = useState<CodeRule | null>(null);

  /**
   * 处理新建规则
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentRuleUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      seq_start: 1,
      seq_step: 1,
      seq_reset_rule: 'never',
      is_system: false,
      is_active: true,
    });
  };

  /**
   * 处理编辑规则
   */
  const handleEdit = async (record: CodeRule) => {
    try {
      setIsEdit(true);
      setCurrentRuleUuid(record.uuid);
      setModalVisible(true);
      
      // 获取规则详情
      const detail = await getCodeRuleByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        expression: detail.expression,
        description: detail.description,
        seq_start: detail.seq_start,
        seq_step: detail.seq_step,
        seq_reset_rule: detail.seq_reset_rule || 'never',
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取规则详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: CodeRule) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getCodeRuleByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取规则详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除规则
   */
  const handleDelete = async (record: CodeRule) => {
    try {
      await deleteCodeRule(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理测试生成编码
   */
  const handleTestGenerate = async (record: CodeRule) => {
    try {
      setCurrentRuleForTest(record);
      setTestModalVisible(true);
      setTestResult('');
      setTestLoading(true);
      
      const response = await testGenerateCode({
        rule_code: record.code,
      });
      
      setTestResult(response.code);
    } catch (error: any) {
      messageApi.error(error.message || '测试生成失败');
    } finally {
      setTestLoading(false);
    }
  };

  /**
   * 处理提交表单（创建/更新规则）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      if (isEdit && currentRuleUuid) {
        await updateCodeRule(currentRuleUuid, values as UpdateCodeRuleData);
        messageApi.success('更新成功');
      } else {
        await createCodeRule(values as CreateCodeRuleData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CodeRule>[] = [
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '规则代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '规则表达式',
      dataIndex: 'expression',
      width: 250,
      ellipsis: true,
      render: (_, record) => (
        <span title={record.expression} style={{ fontFamily: 'monospace' }}>
          {record.expression}
        </span>
      ),
    },
    {
      title: '序号起始值',
      dataIndex: 'seq_start',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '序号步长',
      dataIndex: 'seq_step',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '重置规则',
      dataIndex: 'seq_reset_rule',
      width: 120,
      valueType: 'select',
      valueEnum: {
        never: { text: '不重置', status: 'Default' },
        daily: { text: '每日重置', status: 'Processing' },
        monthly: { text: '每月重置', status: 'Success' },
        yearly: { text: '每年重置', status: 'Warning' },
      },
      render: (_, record) => {
        const resetRuleMap: Record<string, { color: string; text: string }> = {
          never: { color: 'default', text: '不重置' },
          daily: { color: 'blue', text: '每日重置' },
          monthly: { color: 'green', text: '每月重置' },
          yearly: { color: 'orange', text: '每年重置' },
        };
        const ruleInfo = resetRuleMap[record.seq_reset_rule || 'never'] || { color: 'default', text: record.seq_reset_rule || '不重置' };
        return <Tag color={ruleInfo.color}>{ruleInfo.text}</Tag>;
      },
    },
    {
      title: '系统规则',
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Default' },
        false: { text: '否', status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '状态',
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
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => handleTestGenerate(record)}
            disabled={!record.is_active}
          >
            测试
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个规则吗？"
            onConfirm={() => handleDelete(record)}
            disabled={record.is_system}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_system}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <UniTable<CodeRule>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            page: params.current || 1,
            page_size: params.pageSize || 20,
          };
          
          // 状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          // 重置规则筛选
          if (searchFormValues?.seq_reset_rule) {
            apiParams.seq_reset_rule = searchFormValues.seq_reset_rule;
          }
          
          // 搜索条件处理：name 和 code 使用模糊搜索
          if (searchFormValues?.name) {
            apiParams.name = searchFormValues.name as string;
          }
          if (searchFormValues?.code) {
            apiParams.code = searchFormValues.code as string;
          }
          
          try {
            const response = await getCodeRuleList(apiParams);
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          } catch (error: any) {
            console.error('获取编码规则列表失败:', error);
            messageApi.error(error?.message || '获取编码规则列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建规则
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑规则 Modal */}
      <Modal
        title={isEdit ? '编辑规则' : '新建规则'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        size={700}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
            placeholder="请输入规则名称"
          />
          <ProFormText
            name="code"
            label="规则代码"
            rules={[{ required: true, message: '请输入规则代码' }]}
            placeholder="请输入规则代码（唯一标识）"
            disabled={isEdit}
            extra="规则代码用于程序调用，创建后不可修改"
          />
          <ProFormText
            name="expression"
            label="规则表达式"
            rules={[{ required: true, message: '请输入规则表达式' }]}
            placeholder="例如：ORDER-{YYYY}{MM}{DD}-{SEQ:4}"
            extra={
              <div>
                <Paragraph style={{ marginBottom: 8, fontSize: '12px' }}>
                  <Text strong>支持的变量：</Text>
                </Paragraph>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '12px' }}>
                  <li><Text code>{'{YYYY}'}</Text> - 4位年份（如：2025）</li>
                  <li><Text code>{'{YY}'}</Text> - 2位年份（如：25）</li>
                  <li><Text code>{'{MM}'}</Text> - 月份（01-12）</li>
                  <li><Text code>{'{DD}'}</Text> - 日期（01-31）</li>
                  <li><Text code>{'{SEQ}'}</Text> - 序号（自动递增）</li>
                  <li><Text code>{'{SEQ:4}'}</Text> - 序号（4位，不足补0，如：0001）</li>
                  <li><Text code>{'{DICT:字典代码}'}</Text> - 字典值（需要数据字典支持）</li>
                </ul>
                <Paragraph style={{ marginTop: 8, marginBottom: 0, fontSize: '12px' }}>
                  <Text type="secondary">示例：ORDER-{'{YYYY}'}{'{MM}'}{'{DD}'}-{'{SEQ:4}'} → ORDER-20250115-0001</Text>
                </Paragraph>
              </div>
            }
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入规则描述"
          />
          <Space style={{ width: '100%' }} size="large">
            <ProFormDigit
              name="seq_start"
              label="序号起始值"
              fieldProps={{ min: 0 }}
              initialValue={1}
              width="md"
            />
            <ProFormDigit
              name="seq_step"
              label="序号步长"
              fieldProps={{ min: 1 }}
              initialValue={1}
              width="md"
            />
          </Space>
          <ProFormSelect
            name="seq_reset_rule"
            label="序号重置规则"
            options={[
              { label: '不重置', value: 'never' },
              { label: '每日重置', value: 'daily' },
              { label: '每月重置', value: 'monthly' },
              { label: '每年重置', value: 'yearly' },
            ]}
            initialValue="never"
          />
          {!isEdit && (
            <ProFormSwitch
              name="is_system"
              label="是否系统规则"
            />
          )}
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="规则详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<CodeRule>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '规则名称',
                dataIndex: 'name',
              },
              {
                title: '规则代码',
                dataIndex: 'code',
              },
              {
                title: '规则表达式',
                dataIndex: 'expression',
                render: (value) => (
                  <Text code style={{ fontSize: '14px' }}>{value}</Text>
                ),
              },
              {
                title: '描述',
                dataIndex: 'description',
              },
              {
                title: '序号起始值',
                dataIndex: 'seq_start',
              },
              {
                title: '序号步长',
                dataIndex: 'seq_step',
              },
              {
                title: '重置规则',
                dataIndex: 'seq_reset_rule',
                render: (value) => {
                  const resetRuleMap: Record<string, string> = {
                    never: '不重置',
                    daily: '每日重置',
                    monthly: '每月重置',
                    yearly: '每年重置',
                  };
                  return resetRuleMap[value || 'never'] || value || '不重置';
                },
              },
              {
                title: '系统规则',
                dataIndex: 'is_system',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '状态',
                dataIndex: 'is_active',
                render: (value) => (value ? '启用' : '禁用'),
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
            ]}
          />
        )}
      </Drawer>

      {/* 测试生成编码 Modal */}
      <Modal
        title={`测试生成编码 - ${currentRuleForTest?.name || ''}`}
        open={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false);
          setCurrentRuleForTest(null);
          setTestResult('');
        }}
        footer={[
          <Button key="close" onClick={() => {
            setTestModalVisible(false);
            setCurrentRuleForTest(null);
            setTestResult('');
          }}>
            关闭
          </Button>,
        ]}
        size={600}
      >
        {currentRuleForTest && (
          <div>
            <Alert
              message="测试生成不会更新序号"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Text strong>规则表达式：</Text>
              <Text code style={{ fontSize: '14px', marginLeft: 8 }}>
                {currentRuleForTest.expression}
              </Text>
            </div>
            {testLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">正在生成编码...</Text>
              </div>
            ) : testResult ? (
              <div>
                <Text strong>生成的编码：</Text>
                <div
                  style={{
                    marginTop: 8,
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                >
                  {testResult}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
};

export default CodeRuleListPage;

