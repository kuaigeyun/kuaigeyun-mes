/**
 * 工单管理 - 工位机触屏模式页面
 *
 * 专门为工控机设计的全屏触屏界面，适合车间固定工位使用。
 * 特点：大按钮、大字体、全屏模式、触屏优化布局。
 *
 * Author: Luigi Lu
 * Date: 2026-01-08
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Tag, Space, message, Input, Empty, Spin } from 'antd';
import { EyeOutlined, EditOutlined, PlayCircleOutlined, QrcodeOutlined, SearchOutlined } from '@ant-design/icons';
import { TouchScreenTemplate, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { workOrderApi } from '../../../services/production';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Search } = Input;

interface WorkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  production_mode?: 'MTS' | 'MTO';
  sales_order_id?: number;
  sales_order_code?: string;
  sales_order_name?: string;
  workshop_id?: number;
  workshop_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  status?: string;
  priority?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  remarks?: string;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  allow_operation_jump?: boolean;
}

/**
 * 工单管理 - 工位机触屏模式页面
 */
const WorkOrdersKioskPage: React.FC = () => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>([]);

  /**
   * 加载工单列表
   */
  const loadWorkOrders = async () => {
    setLoading(true);
    try {
      const response = await workOrderApi.list({
        skip: 0,
        limit: 100,
      });

      let data: WorkOrder[] = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response && typeof response === 'object') {
        data = response.data || response.items || [];
      }

      setWorkOrders(data);
      setFilteredWorkOrders(data);
    } catch (error) {
      console.error('获取工单列表失败:', error);
      message.error('获取工单列表失败');
      setWorkOrders([]);
      setFilteredWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 搜索工单
   */
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    if (!value.trim()) {
      setFilteredWorkOrders(workOrders);
      return;
    }

    const keyword = value.toLowerCase();
    const filtered = workOrders.filter((wo) => {
      return (
        wo.code?.toLowerCase().includes(keyword) ||
        wo.name?.toLowerCase().includes(keyword) ||
        wo.product_name?.toLowerCase().includes(keyword) ||
        wo.product_code?.toLowerCase().includes(keyword)
      );
    });
    setFilteredWorkOrders(filtered);
  };

  /**
   * 查看工单详情
   */
  const handleViewDetail = (workOrder: WorkOrder) => {
    if (workOrder.id) {
      // 跳转到工单详情页面（触屏模式）
      navigate(`/apps/kuaizhizao/production-execution/work-orders/${workOrder.id}/kiosk`);
    }
  };

  /**
   * 编辑工单
   */
  const handleEdit = (workOrder: WorkOrder) => {
    if (workOrder.id) {
      // 跳转到工单编辑页面（触屏模式）
      navigate(`/apps/kuaizhizao/production-execution/work-orders/${workOrder.id}/edit/kiosk`);
    }
  };

  /**
   * 开始工序
   */
  const handleStartOperation = async (workOrder: WorkOrder) => {
    if (!workOrder.id) return;

    try {
      // 获取工单工序
      const operations = await workOrderApi.getOperations(workOrder.id.toString());
      if (!operations || operations.length === 0) {
        message.warning('该工单没有工序');
        return;
      }

      // 查找第一个待开始的工序
      const pendingOperation = operations.find((op: any) => op.status === 'pending');
      if (!pendingOperation) {
        message.warning('没有待开始的工序');
        return;
      }

      // 开始工序
      await workOrderApi.startOperation(workOrder.id.toString(), pendingOperation.id);
      message.success('工序已开始');
      loadWorkOrders();
    } catch (error: any) {
      message.error(error.message || '开始工序失败');
    }
  };

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status?: string) => {
    switch (status) {
      case '草稿':
        return 'default';
      case '已下达':
        return 'processing';
      case '生产中':
        return 'processing';
      case '已完成':
        return 'success';
      case '已取消':
        return 'error';
      default:
        return 'default';
    }
  };

  /**
   * 渲染工单卡片
   */
  const renderWorkOrderCard = (workOrder: WorkOrder) => {
    const statusColor = getStatusColor(workOrder.status);

    return (
      <Card
        key={workOrder.id}
        style={{
          marginBottom: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP,
          fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
        }}
        bodyStyle={{
          padding: `${TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP}px`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP }}>
          {/* 工单编号和状态 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: TOUCH_SCREEN_CONFIG.TITLE_FONT_SIZE, fontWeight: 600 }}>
              {workOrder.code}
            </div>
            <Tag color={statusColor} style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE, padding: '8px 16px' }}>
              {workOrder.status || '未知'}
            </Tag>
          </div>

          {/* 工单名称 */}
          {workOrder.name && (
            <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE, color: '#666' }}>
              {workOrder.name}
            </div>
          )}

          {/* 产品信息 */}
          <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE }}>
            <strong>产品：</strong>{workOrder.product_name || workOrder.product_code}
          </div>

          {/* 数量信息 */}
          <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE }}>
            <strong>数量：</strong>{workOrder.quantity}
            {workOrder.completed_quantity !== undefined && workOrder.completed_quantity > 0 && (
              <span style={{ marginLeft: 16, color: '#52c41a' }}>
                已完成：{workOrder.completed_quantity}
              </span>
            )}
          </div>

          {/* 生产模式 */}
          <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE }}>
            <strong>生产模式：</strong>
            <Tag color={workOrder.production_mode === 'MTO' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
              {workOrder.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
            </Tag>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP, marginTop: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP }}>
            <Button
              type="primary"
              size="large"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(workOrder)}
              style={{
                height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
              }}
              block
            >
              查看详情
            </Button>
            {workOrder.status === '草稿' && (
              <Button
                type="default"
                size="large"
                icon={<EditOutlined />}
                onClick={() => handleEdit(workOrder)}
                style={{
                  height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                  fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
                }}
                block
              >
                编辑
              </Button>
            )}
            {workOrder.status === '已下达' && (
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartOperation(workOrder)}
                style={{
                  height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                  fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
                }}
                block
              >
                开始工序
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 初始化加载
  useEffect(() => {
    loadWorkOrders();
  }, []);

  // 搜索过滤
  useEffect(() => {
    handleSearch(searchKeyword);
  }, [workOrders, searchKeyword]);

  return (
    <TouchScreenTemplate
      title="工单管理"
      fullscreen={true}
      footerButtons={[
        {
          title: '刷新',
          onClick: loadWorkOrders,
          type: 'default',
        },
        {
          title: '返回',
          onClick: () => navigate(-1),
          type: 'default',
        },
      ]}
    >
      {/* 搜索框 */}
      <div style={{ marginBottom: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP }}>
        <Search
          placeholder="搜索工单编号、名称或产品"
          allowClear
          size="large"
          value={searchKeyword}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={handleSearch}
          style={{
            fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
            height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
          }}
        />
      </div>

      {/* 工单列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Spin size="large" />
        </div>
      ) : filteredWorkOrders.length === 0 ? (
        <Empty
          description="暂无工单"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: '60px' }}
        />
      ) : (
        <div>
          {filteredWorkOrders.map((workOrder) => renderWorkOrderCard(workOrder))}
        </div>
      )}
    </TouchScreenTemplate>
  );
};

export default WorkOrdersKioskPage;
