/**
 * MES 仪表板页面
 *
 * 显示MES系统的整体状态和关键指标
 */

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Row, Col, Card, Statistic, Progress, List, Avatar } from 'antd';
import { App, Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
  FileTextOutlined,
  BarChartOutlined
} from '@ant-design/icons';

const { Title, Text } = require('antd').Typography;

interface SystemStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalWorkOrders: number;
  activeWorkOrders: number;
  completedWorkOrders: number;
  todayReports: number;
  qualityRate: number;
}

const DashboardPage: React.FC = () => {
  const { message } = App.useApp();
  const [stats, setStats] = useState<SystemStats>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalWorkOrders: 0,
    activeWorkOrders: 0,
    completedWorkOrders: 0,
    todayReports: 0,
    qualityRate: 95.5
  });

  const [recentActivities, setRecentActivities] = useState<any[]>([
    {
      id: 1,
      type: 'order',
      title: '生产订单 ORD001 已确认',
      time: '10分钟前',
      status: 'success'
    },
    {
      id: 2,
      type: 'workorder',
      title: '工单 WO001 已下发到车间',
      time: '15分钟前',
      status: 'info'
    },
    {
      id: 3,
      type: 'report',
      title: '完成报工录入，合格率98%',
      time: '20分钟前',
      status: 'success'
    }
  ]);

  // 模拟加载统计数据
  useEffect(() => {
    // 这里应该调用真实的API获取数据
    const mockStats: SystemStats = {
      totalOrders: 156,
      activeOrders: 23,
      completedOrders: 133,
      totalWorkOrders: 245,
      activeWorkOrders: 45,
      completedWorkOrders: 200,
      todayReports: 12,
      qualityRate: 96.8
    };
    setStats(mockStats);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return <FileTextOutlined />;
      case 'workorder': return <ToolOutlined />;
      case 'report': return <BarChartOutlined />;
      default: return <FileTextOutlined />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'green';
      case 'warning': return 'orange';
      case 'error': return 'red';
      default: return 'blue';
    }
  };

  return (
    <PageContainer
      title="MES 仪表板"
      subTitle="生产执行系统状态监控"
    >
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={stats.totalOrders}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃订单"
              value={stats.activeOrders}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="完成订单"
              value={stats.completedOrders}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日报工"
              value={stats.todayReports}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 工单统计和质量指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="工单执行情况" bordered={false}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="总工单数"
                  value={stats.totalWorkOrders}
                  suffix="个"
                />
                <Progress
                  percent={Math.round((stats.activeWorkOrders / stats.totalWorkOrders) * 100)}
                  status="active"
                  strokeColor="#1890ff"
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="执行中工单"
                  value={stats.activeWorkOrders}
                  suffix="个"
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  占总数 {Math.round((stats.activeWorkOrders / stats.totalWorkOrders) * 100)}%
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="质量指标" bordered={false}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="合格率"
                  value={stats.qualityRate}
                  suffix="%"
                  valueStyle={{ color: stats.qualityRate >= 95 ? '#52c41a' : '#faad14' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="完成工单"
                  value={stats.completedWorkOrders}
                  suffix="个"
                />
                <Progress
                  percent={Math.round((stats.completedWorkOrders / stats.totalWorkOrders) * 100)}
                  status="success"
                  strokeColor="#52c41a"
                  style={{ marginTop: 8 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 近期活动 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="近期活动" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={recentActivities}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={getActivityIcon(item.type)}
                        style={{ backgroundColor: getStatusColor(item.status) }}
                      />
                    }
                    title={item.title}
                    description={
                      <div>
                        <Text type="secondary">{item.time}</Text>
                        <Tag
                          color={getStatusColor(item.status)}
                          size="small"
                          style={{ marginLeft: 8 }}
                        >
                          {item.status === 'success' ? '完成' :
                           item.status === 'warning' ? '进行中' :
                           item.status === 'error' ? '异常' : '正常'}
                        </Tag>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="快速操作" bordered={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="/apps/kuaimes/orders/create" style={{ color: '#1890ff' }}>
                📝 创建生产订单
              </a>
              <a href="/apps/kuaimes/work-orders/create" style={{ color: '#1890ff' }}>
                🔧 创建工单
              </a>
              <a href="/apps/kuaimes/production-reports/report" style={{ color: '#1890ff' }}>
                📊 录入报工
              </a>
              <a href="/apps/kuaimes/traceability/query" style={{ color: '#1890ff' }}>
                🔍 追溯查询
              </a>
              <a href="/apps/kuaimes/rework-orders/create" style={{ color: '#1890ff' }}>
                🔄 创建返工
              </a>
            </div>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default DashboardPage;
