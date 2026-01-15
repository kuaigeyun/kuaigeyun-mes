/**
 * 库存预警管理页面
 *
 * 提供库存预警的管理功能，包括预警规则配置、预警记录查看、预警处理等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Popconfirm, Badge, Card, Row, Col, Statistic } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { inventoryAlertApi } from '../../../services/inventory-alert';

interface InventoryAlert {
  id?: number;
  uuid?: string;
  alert_rule_id?: number;
  alert_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  current_quantity?: number;
  threshold_value?: number;
  alert_level?: string;
  alert_message?: string;
  status?: string;
  handled_by?: number;
  handled_by_name?: string;
  handled_at?: string;
  handling_notes?: string;
  triggered_at?: string;
  resolved_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface InventoryAlertRule {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  alert_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  threshold_type?: string;
  threshold_value?: number;
  is_enabled?: boolean;
  notify_users?: number[];
  notify_roles?: number[];
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const InventoryAlertPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');

  // Modal 相关状态
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const handleFormRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<InventoryAlert | null>(null);

  // 当前编辑的规则ID
  const [currentRuleId, setCurrentRuleId] = useState<number | null>(null);
  const [currentAlertId, setCurrentAlertId] = useState<number | null>(null);

  // 统计信息
  const [statistics, setStatistics] = useState<any>(null);

  /**
   * 加载统计信息
   */
  const loadStatistics = async () => {
    try {
      const stats = await inventoryAlertApi.getStatistics();
      setStatistics(stats);
    } catch (error) {
      // 忽略错误
    }
  };

  useEffect(() => {
    if (activeTab === 'alerts') {
      loadStatistics();
    }
  }, [activeTab]);

  /**
   * 处理新建预警规则
   */
  const handleCreateRule = () => {
    setCurrentRuleId(null);
    setRuleModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_enabled: true,
      threshold_type: 'quantity',
    });
  };

  /**
   * 处理编辑预警规则
   */
  const handleEditRule = async (record: InventoryAlertRule) => {
    try {
      setCurrentRuleId(record.id!);
      setRuleModalVisible(true);
      const detail = await inventoryAlertApi.getRule(record.id!.toString());
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        name: detail.name,
        alert_type: detail.alert_type,
        material_id: detail.material_id,
        material_code: detail.material_code,
        material_name: detail.material_name,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        threshold_type: detail.threshold_type,
        threshold_value: detail.threshold_value,
        is_enabled: detail.is_enabled,
        notify_users: detail.notify_users,
        notify_roles: detail.notify_roles,
        remarks: detail.remarks,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取预警规则详情失败');
    }
  };

  /**
   * 处理提交预警规则
   */
  const handleRuleSubmit = async (values: any) => {
    try {
      if (currentRuleId) {
        await inventoryAlertApi.updateRule(currentRuleId.toString(), {
          name: values.name,
          threshold_type: values.threshold_type,
          threshold_value: values.threshold_value,
          is_enabled: values.is_enabled,
          notify_users: values.notify_users,
          notify_roles: values.notify_roles,
          remarks: values.remarks,
        });
        messageApi.success('预警规则更新成功');
      } else {
        await inventoryAlertApi.createRule({
          name: values.name,
          alert_type: values.alert_type,
          material_id: values.material_id,
          material_code: values.material_code,
          material_name: values.material_name,
          warehouse_id: values.warehouse_id,
          warehouse_name: values.warehouse_name,
          threshold_type: values.threshold_type,
          threshold_value: values.threshold_value,
          is_enabled: values.is_enabled,
          notify_users: values.notify_users,
          notify_roles: values.notify_roles,
          remarks: values.remarks,
        });
        messageApi.success('预警规则创建成功');
      }
      setRuleModalVisible(false);
      setCurrentRuleId(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理删除预警规则
   */
  const handleDeleteRule = async (record: InventoryAlertRule) => {
    try {
      await inventoryAlertApi.deleteRule(record.id!.toString());
      messageApi.success('预警规则删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除预警规则失败');
    }
  };

  /**
   * 处理查看预警详情
   */
  const handleDetail = async (record: InventoryAlert) => {
    try {
      const detail = await inventoryAlertApi.get(record.id!.toString());
      setCurrentAlert(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取预警详情失败');
    }
  };

  /**
   * 处理预警
   */
  const handleAlert = async (record: InventoryAlert) => {
    setCurrentAlertId(record.id!);
    setHandleModalVisible(true);
    handleFormRef.current?.resetFields();
    handleFormRef.current?.setFieldsValue({
      status: 'processing',
    });
  };

  /**
   * 处理提交预警处理
   */
  const handleAlertSubmit = async (values: any) => {
    try {
      if (!currentAlertId) {
        messageApi.error('预警记录ID不存在');
        return;
      }

      await inventoryAlertApi.handle(currentAlertId.toString(), {
        status: values.status,
        handling_notes: values.handling_notes,
      });
      messageApi.success('预警处理成功');
      setHandleModalVisible(false);
      setCurrentAlertId(null);
      handleFormRef.current?.resetFields();
      actionRef.current?.reload();
      loadStatistics();
    } catch (error: any) {
      messageApi.error(error.message || '处理预警失败');
      throw error;
    }
  };

  /**
   * 预警记录表格列定义
   */
  const alertColumns: ProColumns<InventoryAlert>[] = [
    {
      title: '预警类型',
      dataIndex: 'alert_type',
      width: 120,
      valueEnum: {
        low_stock: { text: '低库存', status: 'error' },
        high_stock: { text: '高库存', status: 'warning' },
        expired: { text: '过期', status: 'error' },
      },
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '当前数量',
      dataIndex: 'current_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '阈值',
      dataIndex: 'threshold_value',
      width: 100,
      align: 'right',
    },
    {
      title: '预警级别',
      dataIndex: 'alert_level',
      width: 100,
      valueEnum: {
        critical: { text: '严重', status: 'error' },
        warning: { text: '警告', status: 'warning' },
        info: { text: '信息', status: 'default' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'warning' },
        processing: { text: '处理中', status: 'processing' },
        resolved: { text: '已解决', status: 'success' },
        ignored: { text: '已忽略', status: 'default' },
      },
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAlert(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /**
   * 预警规则表格列定义
   */
  const ruleColumns: ProColumns<InventoryAlertRule>[] = [
    {
      title: '规则编码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '预警类型',
      dataIndex: 'alert_type',
      width: 120,
      valueEnum: {
        low_stock: { text: '低库存', status: 'error' },
        high_stock: { text: '高库存', status: 'warning' },
        expired: { text: '过期', status: 'error' },
      },
    },
    {
      title: '物料',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '阈值类型',
      dataIndex: 'threshold_type',
      width: 100,
      valueEnum: {
        quantity: { text: '数量' },
        percentage: { text: '百分比' },
        days: { text: '天数' },
      },
    },
    {
      title: '阈值',
      dataIndex: 'threshold_value',
      width: 100,
      align: 'right',
    },
    {
      title: '启用状态',
      dataIndex: 'is_enabled',
      width: 100,
      valueEnum: {
        true: { text: '启用', status: 'success' },
        false: { text: '禁用', status: 'default' },
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRule(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个预警规则吗？"
            onConfirm={() => handleDeleteRule(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      {/* 统计信息卡片 */}
      {activeTab === 'alerts' && statistics && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="待处理预警"
                value={statistics.pending_count || 0}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="低库存预警"
                value={statistics.by_type?.low_stock || 0}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="高库存预警"
                value={statistics.by_type?.high_stock || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="严重级别"
                value={statistics.by_level?.critical || 0}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <UniTable
        headerTitle={activeTab === 'alerts' ? '库存预警记录' : '库存预警规则'}
        actionRef={actionRef}
        rowKey="id"
        columns={activeTab === 'alerts' ? alertColumns : ruleColumns}
        showAdvancedSearch={true}
        showCreateButton={activeTab === 'rules'}
        onCreate={activeTab === 'rules' ? handleCreateRule : undefined}
        request={async (params) => {
          try {
            const result = activeTab === 'alerts'
              ? await inventoryAlertApi.list({
                  skip: (params.current! - 1) * params.pageSize!,
                  limit: params.pageSize,
                  alert_type: params.alert_type,
                  status: params.status,
                  alert_level: params.alert_level,
                  material_id: params.material_id,
                  warehouse_id: params.warehouse_id,
                })
              : await inventoryAlertApi.listRules({
                  skip: (params.current! - 1) * params.pageSize!,
                  limit: params.pageSize,
                  alert_type: params.alert_type,
                  is_enabled: params.is_enabled,
                });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="alerts"
            type={activeTab === 'alerts' ? 'primary' : 'default'}
            onClick={() => {
              setActiveTab('alerts');
              actionRef.current?.reload();
            }}
          >
            预警记录
          </Button>,
          <Button
            key="rules"
            type={activeTab === 'rules' ? 'primary' : 'default'}
            onClick={() => {
              setActiveTab('rules');
              actionRef.current?.reload();
            }}
          >
            预警规则
          </Button>,
        ]}
      />

      {/* 预警规则Modal */}
      <FormModalTemplate
        title={currentRuleId ? '编辑预警规则' : '新建预警规则'}
        open={ruleModalVisible}
        onCancel={() => {
          setRuleModalVisible(false);
          setCurrentRuleId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleRuleSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormText
          name="name"
          label="规则名称"
          placeholder="请输入规则名称"
          rules={[{ required: true, message: '请输入规则名称' }]}
        />
        <ProFormSelect
          name="alert_type"
          label="预警类型"
          options={[
            { label: '低库存', value: 'low_stock' },
            { label: '高库存', value: 'high_stock' },
            { label: '过期', value: 'expired' },
          ]}
          rules={[{ required: true, message: '请选择预警类型' }]}
          disabled={!!currentRuleId}
        />
        <ProFormText
          name="material_id"
          label="物料ID"
          placeholder="请输入物料ID（可选）"
        />
        <ProFormText
          name="material_code"
          label="物料编码"
          placeholder="请输入物料编码（可选）"
        />
        <ProFormText
          name="material_name"
          label="物料名称"
          placeholder="请输入物料名称（可选）"
        />
        <ProFormText
          name="warehouse_id"
          label="仓库ID"
          placeholder="请输入仓库ID（可选）"
        />
        <ProFormText
          name="warehouse_name"
          label="仓库名称"
          placeholder="请输入仓库名称（可选）"
        />
        <ProFormSelect
          name="threshold_type"
          label="阈值类型"
          options={[
            { label: '数量', value: 'quantity' },
            { label: '百分比', value: 'percentage' },
            { label: '天数', value: 'days' },
          ]}
          rules={[{ required: true, message: '请选择阈值类型' }]}
        />
        <ProFormDigit
          name="threshold_value"
          label="阈值数值"
          placeholder="请输入阈值数值"
          rules={[{ required: true, message: '请输入阈值数值' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label="是否启用"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 处理预警Modal */}
      <FormModalTemplate
        title="处理预警"
        open={handleModalVisible}
        onCancel={() => {
          setHandleModalVisible(false);
          setCurrentAlertId(null);
          handleFormRef.current?.resetFields();
        }}
        onFinish={handleAlertSubmit}
        formRef={handleFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="status"
          label="处理状态"
          options={[
            { label: '处理中', value: 'processing' },
            { label: '已解决', value: 'resolved' },
            { label: '已忽略', value: 'ignored' },
          ]}
          rules={[{ required: true, message: '请选择处理状态' }]}
        />
        <ProFormTextArea
          name="handling_notes"
          label="处理备注"
          placeholder="请输入处理备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="预警详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentAlert(null);
        }}
        dataSource={currentAlert || {}}
        columns={[
          {
            title: '预警类型',
            dataIndex: 'alert_type',
            valueEnum: {
              low_stock: { text: '低库存', status: 'error' },
              high_stock: { text: '高库存', status: 'warning' },
              expired: { text: '过期', status: 'error' },
            },
          },
          {
            title: '物料编码',
            dataIndex: 'material_code',
          },
          {
            title: '物料名称',
            dataIndex: 'material_name',
          },
          {
            title: '仓库',
            dataIndex: 'warehouse_name',
          },
          {
            title: '当前数量',
            dataIndex: 'current_quantity',
          },
          {
            title: '阈值',
            dataIndex: 'threshold_value',
          },
          {
            title: '预警级别',
            dataIndex: 'alert_level',
            valueEnum: {
              critical: { text: '严重', status: 'error' },
              warning: { text: '警告', status: 'warning' },
              info: { text: '信息', status: 'default' },
            },
          },
          {
            title: '预警消息',
            dataIndex: 'alert_message',
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              pending: { text: '待处理', status: 'warning' },
              processing: { text: '处理中', status: 'processing' },
              resolved: { text: '已解决', status: 'success' },
              ignored: { text: '已忽略', status: 'default' },
            },
          },
          {
            title: '触发时间',
            dataIndex: 'triggered_at',
            valueType: 'dateTime',
          },
          {
            title: '处理人',
            dataIndex: 'handled_by_name',
          },
          {
            title: '处理时间',
            dataIndex: 'handled_at',
            valueType: 'dateTime',
          },
          {
            title: '处理备注',
            dataIndex: 'handling_notes',
          },
        ]}
      />
    </ListPageTemplate>
  );
};

export default InventoryAlertPage;
