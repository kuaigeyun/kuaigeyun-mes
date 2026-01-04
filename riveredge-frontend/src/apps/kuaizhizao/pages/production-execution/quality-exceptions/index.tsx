/**
 * 质量异常处理页面
 *
 * 提供质量异常处理功能，包括问题追溯、纠正预防措施记录等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Button, Space, message } from 'antd';
import { EyeOutlined, CheckCircleOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';

/**
 * 质量异常接口定义
 */
interface QualityException {
  id?: number;
  exception_type?: string;
  work_order_id?: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  batch_no?: string;
  problem_description?: string;
  severity?: string;
  status?: string;
  root_cause?: string;
  corrective_action?: string;
  preventive_action?: string;
  responsible_person_name?: string;
  planned_completion_date?: string;
  actual_completion_date?: string;
  verification_result?: string;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
  created_at?: string;
}

/**
 * 质量异常处理页面组件
 */
const QualityExceptionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<QualityException | null>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: QualityException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 处理质量异常
   */
  const handleException = async (record: QualityException, action: string) => {
    try {
      await apiRequest(`/apps/kuaizhizao/exceptions/quality/${record.id}/handle`, {
        method: 'POST',
        params: { action },
      });
      messageApi.success('处理成功');
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error('处理失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<QualityException>[] = [
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      width: 120,
      valueEnum: {
        inspection_failure: { text: '检验不合格', status: 'error' },
        process_deviation: { text: '工艺偏差', status: 'warning' },
        customer_complaint: { text: '客户投诉', status: 'error' },
      },
    },
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 140,
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batch_no',
      width: 100,
    },
    {
      title: '问题描述',
      dataIndex: 'problem_description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      valueEnum: {
        minor: { text: '轻微', status: 'default' },
        major: { text: '严重', status: 'warning' },
        critical: { text: '紧急', status: 'error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'default' },
        investigating: { text: '调查中', status: 'processing' },
        correcting: { text: '纠正中', status: 'processing' },
        closed: { text: '已关闭', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person_name',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 250,
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
              icon={<SearchOutlined />}
              onClick={() => handleException(record, 'investigate')}
            >
              调查
            </Button>
          )}
          {record.status === 'investigating' && (
            <Button
              type="link"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => handleException(record, 'correct')}
            >
              纠正
            </Button>
          )}
          {record.status === 'correcting' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleException(record, 'close')}
            >
              关闭
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="质量异常处理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/apps/kuaizhizao/exceptions/quality', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                exception_type: params.exception_type,
                status: params.status,
                severity: params.severity,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取异常列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showAdvancedSearch={true}
      />

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`质量异常详情 - ${currentRecord?.work_order_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>异常类型：</strong>
                {currentRecord.exception_type === 'inspection_failure' ? '检验不合格' :
                 currentRecord.exception_type === 'process_deviation' ? '工艺偏差' :
                 currentRecord.exception_type === 'customer_complaint' ? '客户投诉' : currentRecord.exception_type}
              </p>
              <p><strong>工单编码：</strong>{currentRecord.work_order_code || '-'}</p>
              <p><strong>物料编码：</strong>{currentRecord.material_code || '-'}</p>
              <p><strong>物料名称：</strong>{currentRecord.material_name || '-'}</p>
              {currentRecord.batch_no && (
                <p><strong>批次号：</strong>{currentRecord.batch_no}</p>
              )}
              <p><strong>问题描述：</strong>{currentRecord.problem_description}</p>
              <p><strong>严重程度：</strong>
                <Tag color={
                  currentRecord.severity === 'critical' ? 'red' :
                  currentRecord.severity === 'major' ? 'orange' : 'default'
                }>
                  {currentRecord.severity === 'critical' ? '紧急' :
                   currentRecord.severity === 'major' ? '严重' : '轻微'}
                </Tag>
              </p>
              <p><strong>状态：</strong>
                <Tag color={
                  currentRecord.status === 'closed' ? 'success' :
                  currentRecord.status === 'correcting' || currentRecord.status === 'investigating' ? 'processing' :
                  currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {currentRecord.status === 'closed' ? '已关闭' :
                   currentRecord.status === 'correcting' ? '纠正中' :
                   currentRecord.status === 'investigating' ? '调查中' :
                   currentRecord.status === 'cancelled' ? '已取消' : '待处理'}
                </Tag>
              </p>
              {currentRecord.root_cause && (
                <p><strong>根本原因：</strong>{currentRecord.root_cause}</p>
              )}
              {currentRecord.corrective_action && (
                <p><strong>纠正措施：</strong>{currentRecord.corrective_action}</p>
              )}
              {currentRecord.preventive_action && (
                <p><strong>预防措施：</strong>{currentRecord.preventive_action}</p>
              )}
              {currentRecord.responsible_person_name && (
                <p><strong>责任人：</strong>{currentRecord.responsible_person_name}</p>
              )}
              {currentRecord.planned_completion_date && (
                <p><strong>计划完成日期：</strong>{currentRecord.planned_completion_date}</p>
              )}
              {currentRecord.actual_completion_date && (
                <p><strong>实际完成日期：</strong>{currentRecord.actual_completion_date}</p>
              )}
              {currentRecord.verification_result && (
                <p><strong>验证结果：</strong>{currentRecord.verification_result}</p>
              )}
              {currentRecord.handled_by_name && (
                <>
                  <p><strong>处理人：</strong>{currentRecord.handled_by_name}</p>
                  <p><strong>处理时间：</strong>{currentRecord.handled_at}</p>
                </>
              )}
              {currentRecord.remarks && (
                <p><strong>备注：</strong>{currentRecord.remarks}</p>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default QualityExceptionsPage;

