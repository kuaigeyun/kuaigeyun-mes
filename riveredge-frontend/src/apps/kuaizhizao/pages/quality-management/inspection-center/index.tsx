import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Space, Typography, Tag, Tooltip, Empty } from 'antd';
import { 
  ArrowRightOutlined, 
  SafetyCertificateOutlined, 
  ThunderboltOutlined, 
  CheckCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  RightOutlined
} from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMenuBadgeCounts } from '../../../../../services/dashboard';
import { SimpleSparkline } from '../../../../../components/common/SimpleSparkline';

const { Title, Text } = Typography;

const InspectionCenter: React.FC = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await getMenuBadgeCounts();
        setCounts(res);
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, []);

  // 模拟质量合格率数据
  const qualityTrendData = [
    { date: '2024-03-20', rate: 98.2 },
    { date: '2024-03-21', rate: 97.5 },
    { date: '2024-03-22', rate: 99.1 },
    { date: '2024-03-23', rate: 98.8 },
    { date: '2024-03-24', rate: 96.5 },
    { date: '2024-03-25', rate: 98.2 },
    { date: '2024-03-26', rate: 99.5 },
  ];

  const trendConfig = {
    data: qualityTrendData,
    xField: 'date',
    yField: 'rate',
    smooth: true,
    padding: 'auto',
    color: '#1890ff',
    point: {
      size: 4,
      shape: 'diamond',
    },
    label: {
      style: {
        fill: '#aaa',
      },
    },
    yAxis: {
      min: 90,
      max: 100,
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100%' }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <SafetyCertificateOutlined style={{ color: '#1890ff', marginRight: 12 }} />
              质检中心
            </Title>
            <Text type="secondary">实时监控质量动态，协同仓库与生产流程</Text>
          </div>
          <Space>
            <Button icon={<BarChartOutlined />}>质量报表</Button>
            <Button type="primary" icon={<ThunderboltOutlined />}>发起质检</Button>
          </Space>
        </div>

        {/* 核心指标统计 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <motion.div variants={itemVariants}>
              <Card 
                hoverable 
                onClick={() => navigate('/apps/kuaizhizao/quality-management/incoming-inspection')}
                style={{ borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)' }}
                bodyStyle={{ padding: '20px', color: '#fff' }}
              >
                <Statistic 
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>来料待检</span>}
                  value={counts.incoming_inspection || 0}
                  valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}
                  prefix={<ClockCircleOutlined />}
                  suffix={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>张单据</span>}
                />
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)' }}>关联仓库收货通知</Text>
                  <ArrowRightOutlined />
                </div>
              </Card>
            </motion.div>
          </Col>
          <Col span={6}>
            <motion.div variants={itemVariants}>
              <Card 
                hoverable 
                onClick={() => navigate('/apps/kuaizhizao/quality-management/process-inspection')}
                style={{ borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)' }}
                bodyStyle={{ padding: '20px', color: '#fff' }}
              >
                <Statistic 
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>过程待检</span>}
                  value={counts.process_inspection || 0}
                  valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}
                  prefix={<ThunderboltOutlined />}
                  suffix={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>道工序</span>}
                />
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)' }}>现场首检/巡检</Text>
                  <ArrowRightOutlined />
                </div>
              </Card>
            </motion.div>
          </Col>
          <Col span={6}>
            <motion.div variants={itemVariants}>
              <Card 
                hoverable 
                onClick={() => navigate('/apps/kuaizhizao/quality-management/finished-goods-inspection')}
                style={{ borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' }}
                bodyStyle={{ padding: '20px', color: '#fff' }}
              >
                <Statistic 
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>成品待检</span>}
                  value={counts.finished_goods_inspection || 0}
                  valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}
                  prefix={<CheckCircleOutlined />}
                  suffix={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>批次</span>}
                />
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)' }}>入库前终检</Text>
                  <ArrowRightOutlined />
                </div>
              </Card>
            </motion.div>
          </Col>
          <Col span={6}>
            <motion.div variants={itemVariants}>
              <Card 
                style={{ borderRadius: 12, border: 'none', background: '#fff' }}
                bodyStyle={{ padding: '20px' }}
              >
                <Statistic 
                  title="今日综合合格率"
                  value={99.5}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                />
                <div style={{ height: 40, marginTop: 12 }}>
                  <SimpleSparkline
                    height={40}
                    type="line"
                    data={[98, 97, 99, 98, 96, 98, 100]}
                    color="#52c41a"
                  />
                </div>
              </Card>
            </motion.div>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={16}>
            <motion.div variants={itemVariants}>
              <Card 
                title={<span><BarChartOutlined style={{ marginRight: 8 }} />质量合格率趋势</span>}
                extra={<Button type="link">详细分析</Button>}
                style={{ borderRadius: 12 }}
              >
                <div style={{ height: 350 }}>
                   <Line {...trendConfig} height={350} />
                </div>
              </Card>
            </motion.div>
          </Col>
          <Col span={8}>
            <motion.div variants={itemVariants}>
              <Card 
                title={<span><AlertOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />最近质量异常</span>}
                bodyStyle={{ padding: 0 }}
                style={{ borderRadius: 12, height: '100%' }}
              >
                <div style={{ maxHeight: 400, overflow: 'auto', padding: '12px' }}>
                  {[
                    { id: 1, type: '来料', msg: '铝合金外壳表面划痕', time: '10分钟前', level: 'high' },
                    { id: 2, type: '过程', msg: '电机组装扭力超上限', time: '1小时前', level: 'medium' },
                    { id: 3, type: '成品', msg: '包装盒标识错误', time: '3小时前', level: 'low' },
                  ].map(item => (
                    <div 
                      key={item.id} 
                      style={{ 
                        padding: '12px', 
                        borderBottom: '1px solid #f0f0f0', 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <Space>
                          <Tag color={item.level === 'high' ? 'red' : item.level === 'medium' ? 'orange' : 'blue'}>
                            {item.type}
                          </Tag>
                          <Text strong>{item.msg}</Text>
                        </Space>
                        <br />
                        <Text type="secondary" size="small">{item.time}</Text>
                      </div>
                      <Button type="text" icon={<RightOutlined />} />
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Button type="link">查看所有异常</Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </Col>
        </Row>

        {/* 快捷入口 - 制造业最佳实践 */}
        <div style={{ marginTop: 24 }}>
          <Title level={4}>质量协同工具</Title>
          <Row gutter={[16, 16]}>
            {[
              { title: '追溯查询', desc: '全生命周期追溯', icon: <ArrowRightOutlined />, color: '#1890ff' },
              { title: '质检方案', desc: '标准与方法定义', icon: <ArrowRightOutlined />, color: '#722ed1' },
              { title: '不合格品处理', desc: 'MRB评审流程', icon: <ArrowRightOutlined />, color: '#faad14' },
              { title: '异常跟踪', desc: '8D改进闭环', icon: <ArrowRightOutlined />, color: '#ff4d4f' },
            ].map((tool, idx) => (
              <Col span={6} key={idx}>
                <motion.div variants={itemVariants}>
                  <Card hoverable style={{ borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: 8, 
                        background: `${tool.color}15`, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginRight: 16
                      }}>
                        <div style={{ color: tool.color, fontSize: 24 }}>{tool.icon}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{tool.title}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{tool.desc}</Text>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </div>
      </motion.div>
    </div>
  );
};

export default InspectionCenter;
