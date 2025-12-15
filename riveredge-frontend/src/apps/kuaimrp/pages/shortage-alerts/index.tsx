/**
 * 缺料预警管理页面
 * 
 * 提供缺料预警的查看和处理功能，包括列表展示、详情查看、处理等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { shortageAlertApi } from '../../services/process';
import type { ShortageAlert } from '../../types/process';

/**
 * 缺料预警管理列表页面组件
 */
const ShortageAlertsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentAlertUuid, setCurrentAlertUuid] = useState<string | null>(null);
  const [alertDetail, setAlertDetail] = useState<ShortageAlert | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（处理预警）
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [handleResult, setHandleResult] = useState('');

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ShortageAlert) => {
    try {
      setCurrentAlertUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await shortageAlertApi.get(record.uuid);
      setAlertDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取预警详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理缺料预警
   */
  const handleAlert = async (record: ShortageAlert) => {
    setCurrentAlertUuid(record.uuid);
    setHandleModalVisible(true);
    setHandleResult('');
  };

  /**
   * 提交处理结果
   */
  const handleSubmitResult = async () => {
    if (!currentAlertUuid || !handleResult.trim()) {
      messageApi.warning('请输入处理结果');
      return;
    }
    
    try {
      await shortageAlertApi.handle(currentAlertUuid, handleResult);
      messageApi.success('处理成功');
      setHandleModalVisible(false);
      setHandleResult('');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ShortageAlert>[] = [
    {
      title: '预警编号',
      dataIndex: 'alertNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.alertNo}</a>
      ),
    },
    {
      title: '物料ID',
      dataIndex: 'materialId',
      width: 100,
    },
    {
      title: '缺料数量',
      dataIndex: 'shortageQty',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '缺料日期',
      dataIndex: 'shortageDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '预警等级',
      dataIndex: 'alertLevel',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '紧急': { text: <Tag color="red">紧急</Tag> },
        '重要': { text: <Tag color="orange">重要</Tag> },
        '一般': { text: <Tag color="default">一般</Tag> },
      },
    },
    {
      title: '预警状态',
      dataIndex: 'alertStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待处理': { text: <Tag color="orange">待处理</Tag> },
        '处理中': { text: <Tag color="blue">处理中</Tag> },
        '已解决': { text: <Tag color="green">已解决</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.alertStatus === '待处理' && (
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

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<ShortageAlert>
        headerTitle="缺料预警管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await shortageAlertApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="缺料预警详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : alertDetail ? (
          <ProDescriptions<ShortageAlert>
            column={1}
            dataSource={alertDetail}
            columns={[
              { title: '预警编号', dataIndex: 'alertNo' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '缺料数量', dataIndex: 'shortageQty', valueType: 'digit' },
              { title: '缺料日期', dataIndex: 'shortageDate', valueType: 'dateTime' },
              { title: '预警等级', dataIndex: 'alertLevel' },
              { title: '预警状态', dataIndex: 'alertStatus' },
              { title: '缺料原因', dataIndex: 'alertReason' },
              { title: '处理建议', dataIndex: 'suggestedAction' },
              { title: '处理结果', dataIndex: 'handleResult' },
              { title: '处理时间', dataIndex: 'handledAt', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>

      {/* 处理 Modal */}
      <Modal
        title="处理缺料预警"
        open={handleModalVisible}
        onOk={handleSubmitResult}
        onCancel={() => {
          setHandleModalVisible(false);
          setHandleResult('');
        }}
        okText="提交"
        cancelText="取消"
      >
        <ProFormTextArea
          label="处理结果"
          value={handleResult}
          onChange={(e) => setHandleResult(e.target.value)}
          placeholder="请输入处理结果"
          fieldProps={{
            rows: 4,
          }}
        />
      </Modal>
    </div>
  );
};

export default ShortageAlertsPage;
