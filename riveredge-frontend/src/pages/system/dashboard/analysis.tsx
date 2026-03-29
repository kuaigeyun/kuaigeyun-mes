import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Typography, Progress, Button, Badge } from 'antd';
import { 
  FullscreenOutlined, 
  FullscreenExitOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RiseOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { Area, Pie, Column } from '@ant-design/charts';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

// 模拟制造数据
const yieldTrendData = [
  { time: '08:00', yield: 97.2 },
  { time: '10:00', yield: 98.1 },
  { time: '12:00', yield: 96.8 },
  { time: '14:00', yield: 98.4 },
  { time: '16:00', yield: 99.1 },
  { time: '18:00', yield: 98.5 },
  { time: '20:00', yield: 98.9 },
];

const equipmentStatusData = [
  { type: '生产中', value: 45, color: '#34d399' },
  { type: '待机中', value: 8, color: '#fbbf24' },
  { type: '故障修', value: 3, color: '#f87171' },
  { type: '已离线', value: 4, color: '#94a3b8' },
];

const productionProgressData = [
  { name: '精密减速机加工', target: 5000, actual: 4850, rate: 97 },
  { name: 'AGV底盘组件组装', target: 2000, actual: 1600, rate: 80 },
  { name: '重载驱动轮装配', target: 3000, actual: 2100, rate: 70 },
  { name: '高通量表面喷涂', target: 10000, actual: 10500, rate: 105 },
];

const liveAlerts = [
  { id: 1, time: '10:15:32', type: 'warning', msg: '预警：伺服电机低于安全库存', area: '立库C区' },
  { id: 2, time: '10:12:10', type: 'error', msg: '报警：CNC-04号机床主轴温度过高', area: '金工二区' },
  { id: 3, time: '10:08:45', type: 'success', msg: '广播：工单GD-2026 已提前包装完毕', area: '总装线A' },
  { id: 4, time: '10:05:22', type: 'warning', msg: '风险：客户Z试制订单可能存在交期风险', area: '生管中心' },
  { id: 5, time: '09:58:10', type: 'error', msg: '质检：首检异常检测孔径超差 0.02mm', area: '品管部' },
  { id: 6, time: '09:50:00', type: 'success', msg: '通知：1班次交接完成，设备综合开动率92%', area: '车间全局' },
];

const ModernFactoryDashboard: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const containerRef = useRef<HTMLDivElement>(null);

  // 定时器
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss')), 1000);
    return () => clearInterval(timer);
  }, []);

  // 全屏监听
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // 极具质感的暗黑毛玻璃样式
  const glassCardStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderTop: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
    padding: '24px',
    color: '#f8fafc',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden'
  };

  // 标题样式
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: '#38bdf8', // 霓虹蓝
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    textTransform: 'uppercase'
  };

  const heroMeticStyle: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 800,
    fontFamily: '"Inter", "DIN Alternate", sans-serif',
    lineHeight: 1,
    backgroundImage: 'linear-gradient(to right, #ffffff, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 0 30px rgba(255,255,255,0.1)'
  };

  // 深色系 Chart 主题
  const chartTheme = {
    styleSheet: {
      backgroundColor: 'transparent',
    },
    axis: {
      x: { label: { fill: '#94a3b8' }, grid: { stroke: 'rgba(255,255,255,0.03)' }, line: { stroke: 'rgba(255,255,255,0.1)' } },
      y: { label: { fill: '#94a3b8' }, grid: { stroke: 'rgba(255,255,255,0.03)' }, line: { stroke: 'rgba(255,255,255,0.1)' } },
    },
    legend: { text: { fill: '#94a3b8' } },
  };

  return (
    <div 
      ref={containerRef}
      style={{
        backgroundColor: '#020617', // slate-950
        backgroundImage: 'radial-gradient(circle at 50% 0%, #0f172a 0%, #020617 70%)',
        minHeight: isFullscreen ? '100vh' : 'calc(100vh - 120px)',
        margin: isFullscreen ? 0 : -24,
        padding: '24px 32px',
        overflowY: 'auto',
        overflowX: 'hidden',
        color: '#f8fafc',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* 顶部通栏栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ flex: 1 }}>
          <Text style={{ color: '#38bdf8', fontSize: 16, fontWeight: 500, letterSpacing: 1 }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            制造中心实时战报
          </Text>
        </div>
        <div style={{ flex: 2, textAlign: 'center' }}>
          <Title level={2} style={{ color: '#f8fafc', margin: 0, fontWeight: 700, letterSpacing: '4px', textShadow: '0 4px 12px rgba(56, 189, 248, 0.4)' }}>
            FACTORY OPERATIONS CENTER
          </Title>
        </div>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20 }}>
          <Text style={{ color: '#94a3b8', fontSize: 16, fontFamily: 'monospace' }}>{currentTime}</Text>
          <Button 
            type="text" 
            onClick={toggleFullscreen} 
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            style={{ color: '#38bdf8', fontSize: 18 }}
          />
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：全局 OEE 与 质量走势 */}
        <Col span={6} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* OEE 卡片 */}
          <div style={glassCardStyle}>
            <div style={sectionTitleStyle}><DashboardOutlined /> 综合设备效率 (OEE)</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginTop: 10, marginBottom: 30 }}>
              <span style={{ ...heroMeticStyle, WebkitTextFillColor: '#34d399', fontSize: 64, textShadow: '0 0 30px rgba(52, 211, 153, 0.4)' }}>
                87.5
              </span>
              <span style={{ fontSize: 24, color: '#34d399', marginLeft: 4, marginTop: 8 }}>%</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', padding: '16px 0 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>时间开动</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#38bdf8' }}>92.1%</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>性能开动</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#fbbf24' }}>96.5%</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>合格良品</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#34d399' }}>98.5%</div>
              </div>
            </div>
          </div>

          {/* 全局良率趋势 */}
          <div style={{ ...glassCardStyle, flex: 1 }}>
            <div style={sectionTitleStyle}><RiseOutlined /> 全局生产良率走势</div>
            <div style={{ flex: 1, minHeight: 200, width: '100%', marginTop: 10 }}>
              <Area
                data={yieldTrendData}
                xField="time"
                yField="yield"
                smooth
                theme={chartTheme}
                areaStyle={{ fill: 'l(90) 0:#38bdf8 1:rgba(56, 189, 248, 0.05)' }}
                line={{ color: '#38bdf8', size: 3 }}
                yAxis={{ min: 95, max: 100, label: { formatter: (v) => `${v}%` } }}
                tooltip={{ formatter: (datum) => ({ name: '实时良率', value: `${datum.yield}%` }) }}
              />
            </div>
          </div>
        </Col>

        {/* 中间：产量核心 & 各线产能 */}
        <Col span={12} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 三个核心宏观指标 */}
          <Row gutter={24}>
            <Col span={8}>
              <div style={{ ...glassCardStyle, padding: '20px' }}>
                <div style={{ color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>今日计划产量</div>
                <div style={{ ...heroMeticStyle, fontSize: 36, color: '#f8fafc', WebkitTextFillColor: '#f8fafc' }}>12,850</div>
                <div style={{ color: '#34d399', fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RiseOutlined /> 产能利用率极佳
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ ...glassCardStyle, padding: '20px' }}>
                <div style={{ color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>实际入库数</div>
                <div style={{ ...heroMeticStyle, fontSize: 36, WebkitTextFillColor: '#fbbf24', textShadow: '0 0 20px rgba(251, 191, 36, 0.3)' }}>9,420</div>
                <Progress percent={73.3} showInfo={false} strokeColor="#fbbf24" trailColor="rgba(255,255,255,0.05)" style={{ marginTop: 10 }} size="small" />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ ...glassCardStyle, padding: '20px' }}>
                <div style={{ color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>车间在制品 (WIP)</div>
                <div style={{ ...heroMeticStyle, fontSize: 36, WebkitTextFillColor: '#a78bfa', textShadow: '0 0 20px rgba(167, 139, 250, 0.3)' }}>314</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>分布于 16 条产线</div>
              </div>
            </Col>
          </Row>

          {/* 各产线达成率柱状图 */}
          <div style={{ ...glassCardStyle, flex: 1 }}>
            <div style={sectionTitleStyle}><ThunderboltOutlined /> 各核心加工中心产出达成率</div>
            <div style={{ flex: 1, minHeight: 280, width: '100%', marginTop: 20 }}>
              <Column
                data={productionProgressData}
                xField="name"
                yField="actual"
                theme={chartTheme}
                color="#38bdf8"
                barStyle={{ radius: [4, 4, 0, 0], fill: 'l(270) 0:#0284c7 1:#38bdf8' }}
                label={{
                  position: 'top',
                  style: { fill: '#f8fafc', fontWeight: 600 },
                  formatter: (datum) => `${datum.rate}%`
                }}
                tooltip={{ formatter: (datum) => ({ name: '产出量', value: `${datum.actual} / 目标 ${datum.target}` }) }}
              />
            </div>
          </div>
        </Col>

        {/* 右侧：设备分布图 & 异常事件流 */}
        <Col span={6} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 设备饼图 */}
          <div style={{ ...glassCardStyle, minHeight: 300 }}>
            <div style={sectionTitleStyle}><CheckCircleOutlined /> 核心设备状态网络 (60台)</div>
            <div style={{ flex: 1, marginTop: 10, position: 'relative' }}>
              <Pie
                data={equipmentStatusData}
                angleField="value"
                colorField="type"
                radius={0.8}
                innerRadius={0.65}
                color={equipmentStatusData.map(d => d.color)}
                theme={chartTheme}
                legend={{ position: 'bottom', text: { style: { fill: '#94a3b8' } } } as any}
                label={false}
                statistic={{
                  title: false,
                  content: {
                    content: '稼动率\n75%',
                    style: { color: '#f8fafc', fontSize: '24px', fontWeight: 600, lineHeight: '30px', whiteSpace: 'pre-wrap' },
                  },
                }}
                pieStyle={{
                  stroke: '#0f172a', /* 背景同色缝隙 */
                  lineWidth: 3,
                }}
              />
            </div>
          </div>

          {/* 实时滚动警报流 */}
          <div style={{ ...glassCardStyle, flex: 1, paddingRight: 12 }}>
            <div style={sectionTitleStyle}><WarningOutlined /> 全域事件与安全警报网</div>
            <div style={{ overflowY: 'hidden', flex: 1, position: 'relative', marginTop: 10 }}>
              <style>
                {`
                  @keyframes seamlessScroll {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                  }
                  .custom-alert-scroll {
                    animation: seamlessScroll 25s linear infinite;
                  }
                  .custom-alert-scroll:hover {
                    animation-play-state: paused;
                  }
                  .alert-box {
                    padding: 14px 16px;
                    border-radius: 8px;
                    margin-bottom: 12px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-left: 3px solid transparent;
                    transition: all 0.3s ease;
                  }
                  .alert-box:hover {
                    background: rgba(255,255,255,0.05);
                    transform: translateX(4px);
                  }
                  .alert-box.error { border-left-color: #f87171; background: linear-gradient(90deg, rgba(248, 113, 113, 0.05), transparent); }
                  .alert-box.warning { border-left-color: #fbbf24; background: linear-gradient(90deg, rgba(251, 191, 36, 0.05), transparent); }
                  .alert-box.success { border-left-color: #34d399; background: linear-gradient(90deg, rgba(52, 211, 153, 0.05), transparent); }
                `}
              </style>
              <div className="custom-alert-scroll" style={{ paddingRight: 12 }}>
                {[...liveAlerts, ...liveAlerts].map((alert, index) => (
                  <div key={`${alert.id}-${index}`} className={`alert-box ${alert.type}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ 
                        color: alert.type === 'error' ? '#f87171' : alert.type === 'warning' ? '#fbbf24' : '#34d399', 
                        fontSize: 12, 
                        fontWeight: 600, 
                        textTransform: 'uppercase',
                        letterSpacing: 1
                      }}>
                        {alert.area}
                      </span>
                      <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>
                        {alert.time}
                      </span>
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>
                      {alert.msg}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ModernFactoryDashboard;
