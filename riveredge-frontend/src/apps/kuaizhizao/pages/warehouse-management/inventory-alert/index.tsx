/**
 * 库存预警管理页面
 *
 * 提供库存预警的管理功能，包括预警规则配置、预警记录查看、预警处理等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Popconfirm, Badge, Card, Row, Col, Statistic, Typography } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { inventoryAlertApi } from '../../../services/inventory-alert';
import { getInventoryAlertLifecycle } from '../../../utils/inventoryAlertLifecycle';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

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
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');

  // Modal 相关状态
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [pendingRuleFormValues, setPendingRuleFormValues] = useState<Record<string, any> | null>(null);
  const handleFormRef = useRef<any>(null);
  const [pendingHandleFormValues, setPendingHandleFormValues] = useState<Record<string, any> | null>(null);

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
    setPendingRuleFormValues({
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
      setPendingRuleFormValues({
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
        attachments: mapAttachmentsToUploadList(detail.attachments),
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
          attachments: normalizeDocumentAttachments(values.attachments),
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
          attachments: normalizeDocumentAttachments(values.attachments),
        });
        messageApi.success('预警规则创建成功');
      }
      setRuleModalVisible(false);
      setCurrentRuleId(null);
      setPendingRuleFormValues(null);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

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
      invalidateMenuBadgeCounts();

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
    setPendingHandleFormValues({
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
      setPendingHandleFormValues(null);
      handleFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      loadStatistics();
    } catch (error: any) {
      messageApi.error(error.message || '处理预警失败');
      throw error;
    }
  };

  const handleBatchHandleAlerts = async (status: 'resolved' | 'ignored') => {
    if (!selectedRowKeys.length) {
      messageApi.warning('请先选择预警记录');
      return;
    }
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        await inventoryAlertApi.handle(String(key), { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(`批量处理成功 ${successCount} 条`);
      setSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      loadStatistics();
      return;
    }
    messageApi.error('批量处理失败');
  };

  const handleBatchDeleteRules = async (keys: React.Key[]) => {
    let successCount = 0;
    for (const key of keys) {
      try {
        await inventoryAlertApi.deleteRule(String(key));
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(`批量删除成功 ${successCount} 条规则`);
      setSelectedRowKeys([]);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量删除失败');
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
      title: '物料',
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: '物料编号', dataIndex: 'material_code', hideInTable: true },
    { title: '物料名称', dataIndex: 'material_name', hideInTable: true },
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
      hideInTable: true,
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
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getInventoryAlertLifecycle(record as Record<string, unknown>);
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
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'pending' && (
            <Button {...rowActionKind('execute')} {...rowActionLabelKeep()} onClick={() => handleAlert(record)}>
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
      title: '规则编号',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
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
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('update')} onClick={() => handleEditRule(record)} />
          <Popconfirm
            title="确定要删除这个预警规则吗？"
            onConfirm={() => handleDeleteRule(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button {...rowActionKind('delete')} />
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
                styles={{ content: {color: '#cf1322' } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="低库存预警"
                value={statistics.by_type?.low_stock || 0}
                styles={{ content: {color: '#cf1322' } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="高库存预警"
                value={statistics.by_type?.high_stock || 0}
                styles={{ content: {color: '#faad14' } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="严重级别"
                value={statistics.by_level?.critical || 0}
                styles={{ content: {color: '#cf1322' } }}
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
        columnPersistenceId={
          activeTab === 'alerts'
            ? 'apps.kuaizhizao.pages.warehouse-management.inventory-alert'
            : 'apps.kuaizhizao.pages.warehouse-management.inventory-alert:2'
        }
        showAdvancedSearch={true}
        showCreateButton={activeTab === 'rules'}
        createButtonText="新建库存预警规则"
        onCreate={activeTab === 'rules' ? handleCreateRule : undefined}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={activeTab === 'rules'}
        onDelete={activeTab === 'rules' ? handleBatchDeleteRules : undefined}
        deleteConfirmTitle={(count) =>
          activeTab === 'rules'
            ? `确定要删除选中的 ${count} 条预警规则吗？`
            : `确定要删除选中的 ${count} 条记录吗？`
        }
        toolBarActionsAfterBatch={
          activeTab === 'alerts'
            ? [
                <UniBatchMenuButton
                  key="inventory-alert-batch-actions"
                  selectedRowKeys={selectedRowKeys}
                  label="批量操作"
                  disabled={selectedRowKeys.length === 0}
                  menuItems={[
                    {
                      key: 'batch-resolved',
                      label: '批量标记已解决',
                      onClick: () => {
                        void handleBatchHandleAlerts('resolved');
                      },
                    },
                    {
                      key: 'batch-ignored',
                      label: '批量标记忽略',
                      onClick: () => {
                        void handleBatchHandleAlerts('ignored');
                      },
                    },
                  ]}
                />,
              ]
            : []
        }
        request={async (params) => {
          try {
            const pageSize = params.pageSize || 20;
            const skip = (params.current! - 1) * pageSize;
            const result = activeTab === 'alerts'
              ? await inventoryAlertApi.list({
                  skip,
                  limit: pageSize,
                  alert_type: params.alert_type,
                  status: params.status,
                  alert_level: params.alert_level,
                  material_id: params.material_id,
                  warehouse_id: params.warehouse_id,
                })
              : await inventoryAlertApi.listRules({
                  skip,
                  limit: pageSize,
                  alert_type: params.alert_type,
                  is_enabled: params.is_enabled,
                });
            const rows = Array.isArray(result) ? result : [];
            const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
            return {
              data: rows,
              success: true,
              total,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        toolBarRender={() => [
          <Button
            key="alerts"
            type={activeTab === 'alerts' ? 'primary' : 'default'}
            onClick={() => {
              setActiveTab('alerts');
              setSelectedRowKeys([]);
              invalidateMenuBadgeCounts();

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
              setSelectedRowKeys([]);
              invalidateMenuBadgeCounts();

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
        onClose={() => {
          setRuleModalVisible(false);
          setCurrentRuleId(null);
          setPendingRuleFormValues(null);
          formRef.current?.resetFields();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingRuleFormValues) {
              formRef.current?.setFieldsValue(pendingRuleFormValues);
            }
            return;
          }
          formRef.current?.resetFields?.();
          setPendingRuleFormValues(null);
        }}
        onFinish={handleRuleSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
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
          label="物料编号"
          placeholder="请输入物料编号（可选）"
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
        <DocumentAttachmentsField category="inventory_alert_rule_attachments" />
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
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentAlertId(null);
          setPendingHandleFormValues(null);
          handleFormRef.current?.resetFields();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingHandleFormValues) {
              handleFormRef.current?.setFieldsValue(pendingHandleFormValues);
            }
            return;
          }
          handleFormRef.current?.resetFields?.();
          setPendingHandleFormValues(null);
        }}
        onFinish={handleAlertSubmit}
        formRef={handleFormRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
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
        width={DRAWER_CONFIG.HALF_WIDTH}
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
            title: '物料编号',
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
