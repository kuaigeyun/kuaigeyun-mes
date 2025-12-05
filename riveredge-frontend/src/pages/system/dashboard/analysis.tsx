/**
 * RiverEdge SaaS 多组织框架 - 分析页
 *
 * 数据分析仪表盘，提供各种业务指标的可视化展示
 * 参考 Ant Design Pro 分析页最佳实践
 */

import { PageContainer } from '@ant-design/pro-components';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  List,
  Avatar,
  Typography,
  Space,
  Tag,
  Button,
  Empty,
  App
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  BellOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
  ExperimentOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const { Title, Text } = Typography;

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
  const { message } = App.useApp();
  const navigate = useNavigate();

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
    <PageContainer
      title="分析页"
      extra={
        <Space>
          <Button type="primary" icon={<BarChartOutlined />}>
            导出报表
          </Button>
          <Button icon={<SettingOutlined />}>
            配置
          </Button>
        </Space>
      }
    >
      {/* 关键指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总销售额"
              value={1128930}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#3f8600' }}
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
              valueStyle={{ color: '#1890ff' }}
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
              valueStyle={{ color: '#722ed1' }}
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
              valueStyle={{ color: '#faad14' }}
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
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'sales' ? `¥${value}` : value,
                    name === 'sales' ? '销售额' : '订单数'
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stackId="1"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.6}
                  name="销售额"
                />
              </AreaChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {productData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
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
            <List
              dataSource={topProducts}
              renderItem={(item, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                        {index + 1}
                      </Avatar>
                    }
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag color={item.growth > 0 ? 'success' : 'error'}>
                          {item.growth > 0 ? '+' : ''}{item.growth}%
                        </Tag>
                      </Space>
                    }
                    description={`销售额: ¥${item.sales.toLocaleString()}`}
                  />
                </List.Item>
              )}
            />
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
            <Space direction="vertical" style={{ width: '100%' }} size="large">
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
    </PageContainer>
  );
}
