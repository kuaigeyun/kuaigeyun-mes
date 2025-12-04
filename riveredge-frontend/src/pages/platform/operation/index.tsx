/**
 * 运营中心 - 运营看板页面
 * 
 * 平台级运营看板，用于展示平台整体运营数据。
 * 仅超级管理员可见。
 * 
 * 详细的三层结构设计说明请参考：架构设计文档
 */

import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, Statistic, Typography, Spin, message } from 'antd';
import {
  ApartmentOutlined,
  UserOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { getTenantStatistics } from '../../../services/superadmin';
import type { TenantStatistics } from '../../../services/superadmin';

const { Title } = Typography;

/**
 * 运营看板页面组件
 */
export default function OperationsDashboard() {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<TenantStatistics | null>(null);

  /**
   * 加载运营统计数据
   */
  useEffect(() => {
    const loadStatistics = async () => {
      setLoading(true);
      try {
        const data = await getTenantStatistics();
        setStatistics(data);
      } catch (error: any) {
        message.error(error.message || '加载运营数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, []);

  return (
    <PageContainer
      title="运营看板"
      subTitle="平台级运营数据概览"
      loading={loading}
      breadcrumb={false}
    >
      <Spin spinning={loading}>
        {/* 核心指标卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总组织数"
                value={statistics?.total || 0}
                prefix={<ApartmentOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="激活组织"
                value={statistics?.by_status?.active || 0}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="未激活组织"
                value={statistics?.by_status?.inactive || 0}
                prefix={<FallOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="已暂停组织"
                value={statistics?.by_status?.suspended || 0}
                prefix={<ApartmentOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 组织状态分布 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="组织状态分布" loading={loading}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="激活"
                    value={statistics?.by_status?.active || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="未激活"
                    value={statistics?.by_status?.inactive || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 16 }}>
                  <Statistic
                    title="已过期"
                    value={statistics?.by_status?.expired || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 16 }}>
                  <Statistic
                    title="已暂停"
                    value={statistics?.by_status?.suspended || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#8c8c8c' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="组织套餐分布" loading={loading}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="基础版"
                    value={statistics?.by_plan?.basic || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="专业版"
                    value={statistics?.by_plan?.professional || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 16 }}>
                  <Statistic
                    title="企业版"
                    value={statistics?.by_plan?.enterprise || 0}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 16 }}>
                  <Statistic
                    title="体验套餐"
                    value={(statistics?.total || 0) - (statistics?.by_plan?.basic || 0) - (statistics?.by_plan?.professional || 0) - (statistics?.by_plan?.enterprise || 0)}
                    suffix={`/ ${statistics?.total || 0}`}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* 数据更新时间 */}
        {statistics?.updated_at && (
          <Card style={{ marginTop: 24 }}>
            <Typography.Text type="secondary">
              数据更新时间：{new Date(statistics.updated_at).toLocaleString()}
            </Typography.Text>
          </Card>
        )}
      </Spin>
    </PageContainer>
  );
}

