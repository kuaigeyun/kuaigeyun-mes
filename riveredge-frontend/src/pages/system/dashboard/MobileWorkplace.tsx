import React from 'react';
import { 
  Typography, 
  Avatar, 
  Space, 
  Card, 
  Row, 
  Col, 
  Tag, 
  Button, 
  Badge, 
  Empty, 
  theme 
} from 'antd';
import { 
  RightOutlined, 
  ClockCircleOutlined, 
  AppstoreOutlined,
  CalendarOutlined,
  BellOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
import WeatherWidget from '../../../components/weather/WeatherWidget';
import { getWeatherCardGradient } from '../../../components/weather/weatherBackground';
import { formatDateTime } from '../../../utils/format';

const { Title, Text } = Typography;

interface MobileWorkplaceProps {
  userInfo: any;
  greeting: string;
  currentTime: dayjs.Dayjs;
  lunarDateStr: string;
  statistics: any;
  todos: any[];
  quickEntries: any[];
  isDark: boolean;
  onTodoHandle: (id: string) => void;
  onWeatherChange?: (data: any) => void;
  weatherData?: any;
  avatarUrl?: string;
}

/**
 * 手机端专用工作台
 * 采用原生 App 风格的 Cyber-Minimalist 设计
 */
export const MobileWorkplace: React.FC<MobileWorkplaceProps> = ({
  userInfo,
  greeting,
  currentTime,
  lunarDateStr,
  statistics,
  todos,
  quickEntries,
  isDark,
  onTodoHandle,
  onWeatherChange,
  weatherData,
  avatarUrl
}) => {
  const { token } = theme.useToken();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // 格式化工具
  const formatDashboardMetric = (n: number | undefined | null): string => {
    if (n == null || Number.isNaN(Number(n))) return '0';
    return Number(n).toLocaleString();
  };

  const formatDashboardRate = (n: number | undefined | null): string => {
    if (n == null || Number.isNaN(Number(n))) return '0';
    const v = Number(n);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };

  // 颜色解析工具
  const resolveSemanticColor = (semantic: string, n: number | null | undefined): string => {
    const val = n == null || Number.isNaN(Number(n)) ? 0 : Number(n);
    switch (semantic) {
      case 'work_order_total': return isDark ? '#93c5fd' : token.colorPrimary;
      case 'work_order_wip': return isDark ? '#5eead4' : '#0891b2';
      case 'completion_rate':
        if (val >= 85) return isDark ? '#86efac' : token.colorSuccess;
        if (val >= 50) return isDark ? '#fcd34d' : token.colorWarning;
        return isDark ? '#fca5a5' : token.colorError;
      case 'output_quantity': return isDark ? '#fdba74' : '#ea580c';
      case 'inventory_alert':
        if (val > 0) return isDark ? '#fca5a5' : token.colorError;
        return isDark ? '#86efac' : token.colorSuccess;
      case 'quality_rate':
        if (val >= 95) return isDark ? '#86efac' : '#15803d';
        if (val >= 80) return isDark ? '#bef264' : token.colorSuccess;
        if (val >= 60) return isDark ? '#fcd34d' : token.colorWarning;
        return isDark ? '#fca5a5' : token.colorError;
      default: return isDark ? '#ffffff' : '#18181b';
    }
  };

  // 风格配置
  const cardRadius = 20;
  const pagePadding = 20;

  return (
    <div style={{ 
      padding: `${pagePadding}px`, 
      background: isDark ? '#000' : '#f8fafc', 
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      paddingBottom: 40, // 留出底部空间
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* 1. 头部：个人信息与问候 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={16}>
          <Avatar 
            size={56} 
            src={avatarUrl || userInfo?.avatar} 
            style={{ 
              border: `2px solid ${token.colorPrimary}`,
              boxShadow: `0 4px 12px ${token.colorPrimary}30`
            }}
          >
            {(userInfo?.full_name || userInfo?.username || userInfo?.name || '?').charAt(0)}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Title level={4} style={{ margin: 0, fontSize: 20 }}>
              {greeting}, {userInfo?.full_name || userInfo?.username || userInfo?.name || t('pages.dashboard.userFallback')}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {currentTime.format('YYYY-MM-DD')}
              {i18n.language?.startsWith('zh') ? ` · ${lunarDateStr}` : ''}
            </Text>
          </div>
        </Space>
        <Badge dot color={token.colorError}>
          <Button 
            shape="circle" 
            icon={<BellOutlined style={{ fontSize: 20 }} />} 
            style={{ border: 'none', background: isDark ? '#1e293b' : '#fff' }}
          />
        </Badge>
      </div>

      {/* 2. 时钟与天气卡片 (Bento 风格) */}
      <Row gutter={12}>
        <Col span={14}>
          <Card
            variant="borderless"
            style={{ 
              height: 100, 
              borderRadius: cardRadius, 
              background: isDark ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #fff, #f1f5f9)',
              display: 'flex',
              alignItems: 'center'
            }}
            styles={{ body: { padding: '0 20px', width: '100%' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'tabular-nums', color: token.colorPrimary }}>
                  {currentTime.format('HH:mm')}
                </span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>{t('pages.dashboard.currentTime')}</span>
              </div>
              <CalendarOutlined style={{ fontSize: 32, opacity: 0.1, position: 'absolute', right: 10, top: 10 }} />
            </div>
          </Card>
        </Col>
        <Col span={10}>
          <Card
            variant="borderless"
            style={{ 
              height: 100, 
              borderRadius: cardRadius, 
              background: getWeatherCardGradient(weatherData, isDark),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            styles={{ body: { padding: '0 12px', width: '100%', display: 'flex', justifyContent: 'center' } }}
          >
            <WeatherWidget 
              compact 
              tone={isDark ? 'dark' : 'light'} 
              onWeatherChange={onWeatherChange}
              showRefresh={false}
              style={{ width: '100%', justifyContent: 'center' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 3. KPI 指标 (网格) */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16 }}>{t('pages.dashboard.statistics')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.dashboard.viewDetail')} <RightOutlined style={{ fontSize: 10 }} /></Text>
        </div>
        <Row gutter={[12, 12]}>
          {[
            { label: t('pages.dashboard.statWorkOrderTotal'), value: formatDashboardMetric(statistics?.production?.total), suffix: t('pages.dashboard.unitOrder'), semantic: 'work_order_total', numeric: statistics?.production?.total, icon: <LucideIcons.List size={18} /> },
            { label: t('pages.dashboard.statCompletedQuantity'), value: formatDashboardMetric(statistics?.production?.completed_quantity), suffix: t('pages.dashboard.unitPiece'), semantic: 'output_quantity', numeric: statistics?.production?.completed_quantity, icon: <LucideIcons.BarChart size={18} /> },
            { label: t('pages.dashboard.statWorkOrderInProgress'), value: formatDashboardMetric(statistics?.production?.in_progress), suffix: t('pages.dashboard.unitOrder'), semantic: 'work_order_wip', numeric: statistics?.production?.in_progress, icon: <LucideIcons.PlayCircle size={18} /> },
            { label: t('pages.dashboard.statInventoryAlert'), value: formatDashboardMetric(statistics?.inventory?.alert_count), suffix: t('pages.dashboard.unitAlert'), semantic: 'inventory_alert', numeric: statistics?.inventory?.alert_count, icon: <LucideIcons.AlertTriangle size={18} /> },
            { label: t('pages.dashboard.statWorkOrderCompletion'), value: formatDashboardRate(statistics?.production?.completion_rate), suffix: '%', semantic: 'completion_rate', numeric: statistics?.production?.completion_rate, icon: <LucideIcons.Target size={18} /> },
            { label: t('pages.dashboard.statQualitySummary'), value: formatDashboardRate(statistics?.quality?.quality_rate), suffix: '%', semantic: 'quality_rate', numeric: statistics?.quality?.quality_rate, icon: <LucideIcons.ClipboardCheck size={18} /> },
          ].map((item, idx) => (
            <Col span={12} key={idx}>
              <Card 
                variant="borderless"
                styles={{ body: { padding: '16px 12px' } }}
                style={{ 
                  borderRadius: cardRadius,
                  background: isDark ? '#111' : '#fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  height: '100%',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 10, 
                    background: `${resolveSemanticColor(item.semantic, item.numeric)}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: resolveSemanticColor(item.semantic, item.numeric)
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{ 
                        fontSize: 22, 
                        fontWeight: 700, 
                        color: resolveSemanticColor(item.semantic, item.numeric),
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {item.value}
                      </span>
                      <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 600 }}>{item.suffix}</span>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{item.label}</Text>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 4. 快捷入口 (网格) */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16 }}>{t('pages.dashboard.quickEntry')}</Text>
          <Button type="link" size="small" style={{ padding: 0 }}>{t('common.edit')}</Button>
        </div>
        <Card variant="borderless" style={{ borderRadius: cardRadius, background: isDark ? '#111' : '#fff' }} styles={{ body: { padding: '20px 10px' } }}>
          <Row gutter={[0, 20]}>
            {quickEntries.slice(0, 8).map((item, idx) => (
              <Col span={6} key={idx} onClick={() => navigate(item.menu_path)} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 14, 
                  background: isDark ? '#334155' : '#f1f5f9', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 24,
                  color: token.colorPrimary
                }}>
                  {item.menu_icon || <AppstoreOutlined />}
                </div>
                <Text style={{ fontSize: 11, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.menu_name}</Text>
              </Col>
            ))}
          </Row>
        </Card>
      </div>

      {/* 5. 待办事项 (列表) */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space size={8}>
            <Text strong style={{ fontSize: 16 }}>{t('pages.dashboard.todoList')}</Text>
            {todos.length > 0 && <Badge count={todos.length} />}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.dashboard.viewAll')} <RightOutlined style={{ fontSize: 10 }} /></Text>
        </div>
        
        {todos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todos.slice(0, 5).map((todo) => (
              <Card 
                key={todo.id}
                variant="borderless"
                styles={{ body: { padding: '16px' } }}
                style={{ 
                  borderRadius: cardRadius,
                  background: isDark ? '#111' : '#fff',
                }}
                onClick={() => onTodoHandle(todo.id)}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 12, 
                    background: todo.priority === 'high' ? '#fee2e2' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: todo.priority === 'high' ? '#ef4444' : '#64748b'
                  }}>
                    <LucideIcons.ClipboardList size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text strong style={{ fontSize: 14, display: 'block' }}>{todo.title}</Text>
                      {todo.priority === 'high' && <Tag color="error" style={{ margin: 0, borderRadius: 6, fontSize: 10 }}>{t('pages.dashboard.priorityHigh')}</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{todo.description}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      <ClockCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>{formatDateTime(todo.created_at, 'MM-DD HH:mm')}</Text>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.dashboard.noTodo')} />
        )}
      </div>
    </div>
  );
};
