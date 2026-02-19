/**
 * RiverEdge SaaS 多组织框架 - 分析页
 *
 * 数据分析仪表盘，提供各种业务指标的可视化展示
 * 参考 Ant Design Pro 分析页最佳实践
 */

import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Avatar,
  Typography,
  Space,
  Tag,
  Button,
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { DashboardTemplate } from '../../../components/layout-templates';
import { Area, Pie } from '@ant-design/charts';

const { Text } = Typography;

// 模拟数据API
const fetchSalesData = async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { month: '1月', sales: 4000, orders: 240 },
    { month: '2月', sales: 3000, orders: 139 },
    { month: '3月', sales: 2000, orders: 980 },
    { month: '4月', sales: 2780, orders: 390 },
    { month: '5月', sales: 1890, orders: 480 },
    { month: '6月', sales: 2390, orders: 380 },
    { month: '7月', sales: 3490, orders: 430 },
    { month: '8月', sales: 4000, orders: 240 },
    { month: '9月', sales: 3000, orders: 139 },
    { month: '10月', sales: 2000, orders: 980 },
    { month: '11月', sales: 2780, orders: 390 },
    { month: '12月', sales: 1890, orders: 480 },
  ];
};

const fetchProductData = async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { name: '产品A', value: 400, color: '#1890ff' },
    { name: '产品B', value: 300, color: '#52c41a' },
    { name: '产品C', value: 200, color: '#faad14' },
    { name: '产品D', value: 100, color: '#f5222d' },
  ];
};

const fetchTopProducts = async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: 1, name: '高端定制产品', sales: 125430, growth: 12.5 },
    { id: 2, name: '标准系列产品', sales: 98450, growth: -3.2 },
    { id: 3, name: '基础型号产品', sales: 76320, growth: 8.7 },
    { id: 4, name: '新品发布产品', sales: 45210, growth: 45.3 },
  ];
};

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

/**
 * 分析页页面组件
 */
export default function AnalysisPage() {

  // 获取销售数据
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['salesData'],
    queryFn: fetchSalesData,
  });

  // 获取产品数据
  const { data: productData, isLoading: productLoading } = useQuery({
    queryKey: ['productData'],
    queryFn: fetchProductData,
  });

  // 获取热销产品
  const { data: topProducts, isLoading: topProductsLoading } = useQuery({
    queryKey: ['topProducts'],
    queryFn: fetchTopProducts,
  });

  return (
    <DashboardTemplate>
      {/* 页面标题与操作区 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0 }}>
            分析页
          </Typography.Title>
        </Col>
        <Col>
          <Space>
            <Button type="primary" icon={<BarChartOutlined />}>
              导出报表
            </Button>
            <Button icon={<SettingOutlined />}>
              配置
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 关键指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总销售额"
              value={1128930}
              prefix={<DollarOutlined />}
              suffix="元"
              styles={{ content: { color: '#3f8600' } }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <RiseOutlined style={{ color: '#3f8600', marginRight: 4 }} />
                相比上月 +12.5%
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="订单数量"
              value={2847}
              prefix={<ShoppingCartOutlined />}
              styles={{ content: { color: '#1890ff' } }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <RiseOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                相比上月 +8.2%
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="访客数量"
              value={12345}
              prefix={<UserOutlined />}
              styles={{ content: { color: '#722ed1' } }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <FallOutlined style={{ color: '#f5222d', marginRight: 4 }} />
                相比上月 -2.1%
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="转化率"
              value={32.5}
              suffix="%"
              styles={{ content: { color: '#faad14' } }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <RiseOutlined style={{ color: '#3f8600', marginRight: 4 }} />
                相比上月 +5.3%
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]}>
        {/* 销售额趋势图 */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <BarChartOutlined />
                <span>销售额趋势</span>
              </Space>
            }
            loading={salesLoading}
          >
            <div style={{ height: 300 }}>
              <Area
                {...({
                  data: salesData || [],
                  xField: 'month',
                  yField: 'sales',
                  smooth: true,
                  areaStyle: { fill: '#1890ff', fillOpacity: 0.6 },
                  color: '#1890ff',
                  xAxis: { title: { text: '月份' } },
                  yAxis: { title: { text: '销售额' }, label: { formatter: (v: string) => `¥${v}` } },
                  tooltip: { formatter: (datum: any) => ({ name: '销售额', value: `¥${datum.sales}` }) },
                } as any)}
              />
            </div>
          </Card>
        </Col>

        {/* 产品分布饼图 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <PieChartOutlined />
                <span>产品销售分布</span>
              </Space>
            }
            loading={productLoading}
          >
            <div style={{ height: 300 }}>
              <Pie
                data={productData || []}
                angleField="value"
                colorField="name"
                color={(datum: { color?: string }) => datum.color ?? COLORS[0]}
                radius={0.8}
                label={{ type: 'inner', formatter: (_: any, item: any) => `${item.name} ${((item.value / (productData?.reduce((s, d) => s + d.value, 0) || 1)) * 100).toFixed(0)}%` }}
                tooltip={{ fields: ['name', 'value'], formatter: (datum: any) => ({ name: datum.name, value: datum.value }) }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 热销产品和进度条 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* 热销产品列表 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ShoppingCartOutlined />
                <span>热销产品排行</span>
              </Space>
            }
            loading={topProductsLoading}
          >
            <div>
              {topProducts?.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 0',
                    borderBottom: index < (topProducts?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                  }}
                >
                  <Avatar style={{ backgroundColor: COLORS[index % COLORS.length], marginRight: 12, flexShrink: 0 }}>
                    {index + 1}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 4 }}>
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag color={item.growth > 0 ? 'success' : 'error'}>
                          {item.growth > 0 ? '+' : ''}{item.growth}%
                        </Tag>
                      </Space>
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      销售额: ¥{item.sales.toLocaleString()}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* 目标完成进度 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined />
                <span>目标完成进度</span>
              </Space>
            }
          >
            <Space orientation="vertical" style={{ width: '100%' }} size="large">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>月度销售额目标</Text>
                  <Text strong>¥1,200,000 / ¥1,500,000</Text>
                </div>
                <Progress percent={80} strokeColor="#1890ff" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>季度订单目标</Text>
                  <Text strong>2,847 / 3,500</Text>
                </div>
                <Progress percent={81} strokeColor="#52c41a" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>年度增长目标</Text>
                  <Text strong>15.3% / 20%</Text>
                </div>
                <Progress percent={77} strokeColor="#faad14" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>客户满意度目标</Text>
                  <Text strong>4.6 / 5.0</Text>
                </div>
                <Progress percent={92} strokeColor="#f5222d" />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </DashboardTemplate>
  );
}
