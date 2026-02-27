/**
 * 自助式上线向导页面
 *
 * 系统上线：从0到可开单的步骤式引导（数据校验）
 * 按角色：为每个角色提供上线准备向导，包括数据准备、权限配置、操作培训等
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tabs, Steps, Checkbox, Space, Typography, Tag, Button, List, Empty, Alert } from 'antd';
import { getTenantId } from '../../../utils/auth';
import { CheckCircleOutlined, ExclamationCircleOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { getRoleOnboardingGuide, getSystemGoLiveGuide } from '../../../services/onboarding';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

/**
 * Tab 列表：系统上线（第一个）
 */
const SYSTEM_TAB = { code: 'system', name: '系统上线', icon: '🚀' };

/**
 * 角色列表
 */
const ROLE_LIST = [
  { code: 'sales', name: '销售', icon: '💼' },
  { code: 'purchase', name: '采购', icon: '🛒' },
  { code: 'warehouse', name: '仓库', icon: '📦' },
  { code: 'technician', name: '技术研发人员', icon: '🔧' },
  { code: 'planner', name: '生产计划人员', icon: '📋' },
  { code: 'supervisor', name: '班组长', icon: '👔' },
  { code: 'operator', name: '生产人员', icon: '👷' },
  { code: 'quality', name: '质量组', icon: '✅' },
  { code: 'equipment', name: '设备组', icon: '⚙️' },
  { code: 'finance', name: '财务', icon: '💰' },
  { code: 'manager', name: '管理者', icon: '👤' },
  { code: 'implementer', name: '系统实施人员', icon: '🚀' },
];

/**
 * 自助式上线向导页面组件
 */
const OnboardingWizardPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('system');
  const [guideData, setGuideData] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [systemGuideData, setSystemGuideData] = useState<any>(null);

  /**
   * 加载系统上线向导
   */
  const loadSystemGuide = async () => {
    try {
      setLoading(true);
      const data = await getSystemGoLiveGuide();
      setSystemGuideData(data);
    } catch (error: any) {
      messageApi.error(error?.message || '加载系统上线向导失败');
      setSystemGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载角色上线向导数据
   */
  const loadRoleGuide = async (roleCode: string) => {
    try {
      setLoading(true);
      const response: any = await getRoleOnboardingGuide(undefined, roleCode);
      const data = response.guide || response;
      setGuideData(data);

      const tenantId = getTenantId();
      const storageKey = tenantId != null ? `onboarding_completed_t${tenantId}_${roleCode}` : `onboarding_completed_${roleCode}`;
      const savedCompleted = localStorage.getItem(storageKey);
      if (savedCompleted) {
        setCompletedItems(new Set(JSON.parse(savedCompleted)));
      } else {
        setCompletedItems(new Set());
      }
    } catch (error: any) {
      messageApi.error(error?.message || '加载上线向导失败');
      setGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换 Tab
   */
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'system') {
      loadSystemGuide();
    } else {
      loadRoleGuide(key);
    }
  };

  /**
   * 切换完成状态
   */
  const handleItemToggle = (itemId: string) => {
    const newCompleted = new Set(completedItems);
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    setCompletedItems(newCompleted);
    const tenantId = getTenantId();
    const storageKey = tenantId != null ? `onboarding_completed_t${tenantId}_${activeTab}` : `onboarding_completed_${activeTab}`;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newCompleted)));
  };

  /**
   * 计算完成进度
   */
  const calculateProgress = () => {
    if (!guideData || !guideData.checklist) return 0;
    let total = 0;
    let completed = 0;
    guideData.checklist.forEach((category: any) => {
      category.items.forEach((item: any) => {
        total++;
        if (completedItems.has(item.id)) {
          completed++;
        }
      });
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  useEffect(() => {
    if (activeTab === 'system') {
      loadSystemGuide();
    } else {
      loadRoleGuide(activeTab);
    }
  }, [activeTab]);

  const progress = calculateProgress();

  /** 系统上线 Tab 内容 */
  const renderSystemTab = () => {
    if (loading && !systemGuideData) {
      return <Card loading={loading} />;
    }
    if (!systemGuideData) {
      return <Card><Empty description="暂无系统上线向导数据" /></Card>;
    }
    const { init_completed, message, guide } = systemGuideData;
    if (!init_completed) {
      return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="请先完成组织初始化"
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  组织初始化用于加载系统必须的初始化字段（组织信息、默认设置、编码规则、管理员信息、行业模板等）。
                </Paragraph>
                <Button type="primary" onClick={() => navigate('/init/wizard')}>
                  前往组织初始化
                </Button>
              </div>
            }
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
          />
        </Space>
      );
    }
    const checklist = guide?.checklist || [];
    let sysCompleted = 0;
    let sysTotal = 0;
    checklist.forEach((cat: any) => {
      cat.items?.forEach((item: any) => {
        sysTotal++;
        if (item.completed) sysCompleted++;
      });
    });
    const sysProgress = sysTotal > 0 ? Math.round((sysCompleted / sysTotal) * 100) : 0;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>系统上线进度</Text>
              <Space>
                <Button size="small" icon={<ReloadOutlined />} onClick={loadSystemGuide}>
                  刷新状态
                </Button>
                <Tag color={sysProgress === 100 ? 'success' : 'processing'}>{sysProgress}%</Tag>
              </Space>
            </div>
            <div style={{ width: '100%', height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${sysProgress}%`,
                  height: '100%',
                  backgroundColor: sysProgress === 100 ? '#52c41a' : '#1890ff',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </Space>
        </Card>

        <Card title={`${guide?.name || '系统上线'} - 从0到可开单`}>
          <Steps
            direction="vertical"
            current={checklist.length}
            items={checklist.map((category: any) => ({
              title: category.name,
              status: 'finish',
              description: (
                <List
                  dataSource={category.items || []}
                  renderItem={(item: any) => {
                    const isCompleted = item.completed === true;
                    return (
                      <List.Item
                        style={{
                          padding: '8px 0',
                          backgroundColor: isCompleted ? '#f6ffed' : 'transparent',
                          borderLeft: isCompleted ? '3px solid #52c41a' : '3px solid transparent',
                          paddingLeft: isCompleted ? '12px' : '15px',
                        }}
                      >
                        <Space style={{ width: '100%' }} wrap>
                          <div style={{ flex: 1 }}>
                            <Space>
                              <Text strong={item.required}>{item.name}</Text>
                              {item.required && <Tag color="red" size="small">必填</Tag>}
                              {isCompleted && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            </Space>
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.description}
                              </Text>
                            </div>
                          </div>
                          {item.jump_path && (
                            <Button
                              type="link"
                              size="small"
                              icon={<LinkOutlined />}
                              onClick={() => navigate(item.jump_path)}
                            >
                              前往配置
                            </Button>
                          )}
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              ),
            }))}
          />
        </Card>

        {sysProgress === 100 && (
          <Alert
            message="系统上线完成"
            description="恭喜！您已完成基础数据配置，可以开出业务单据了。建议创建一张销售订单或采购订单进行验证。"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}
      </Space>
    );
  };

  /** 角色 Tab 内容 */
  const renderRoleTab = () => {
    if (loading && !guideData) return <Card loading={loading} />;
    if (!guideData) return <Card><Empty description="暂无上线向导数据" /></Card>;
    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>上线准备进度</Text>
                <Tag color={progress === 100 ? 'success' : 'processing'}>{progress}%</Tag>
              </div>
              <div style={{ width: '100%', height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: progress === 100 ? '#52c41a' : '#1890ff',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </Space>
          </Card>

          {/* 上线准备清单 */}
          <Card title={guideData.name + ' - 上线准备清单'}>
            <Steps
              direction="vertical"
              current={guideData.checklist.length}
              items={guideData.checklist.map((category: any, index: number) => ({
                title: category.name,
                status: 'finish',
                description: (
                  <List
                    dataSource={category.items}
                    renderItem={(item: any) => {
                      const isCompleted = completedItems.has(item.id);
                      return (
                        <List.Item
                          style={{
                            padding: '8px 0',
                            backgroundColor: isCompleted ? '#f6ffed' : 'transparent',
                            borderLeft: isCompleted ? '3px solid #52c41a' : '3px solid transparent',
                            paddingLeft: isCompleted ? '12px' : '15px',
                          }}
                        >
                          <Space style={{ width: '100%' }}>
                            <Checkbox
                              checked={isCompleted}
                              onChange={() => handleItemToggle(item.id)}
                            />
                            <div style={{ flex: 1 }}>
                              <Space>
                                <Text strong={item.required}>{item.name}</Text>
                                {item.required && <Tag color="red" size="small">必填</Tag>}
                                {isCompleted && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                              </Space>
                              <div style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {item.description}
                                </Text>
                              </div>
                            </div>
                          </Space>
                        </List.Item>
                      );
                    }}
                  />
                ),
              }))}
            />
          </Card>

          {/* 提示信息 */}
          {progress < 100 && (
            <Alert
              message="上线准备提示"
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    请按照清单逐步完成上线准备工作。必填项（红色标签）必须完成，可选项可根据实际情况选择完成。
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    完成所有必填项后，即可开始使用系统。建议完成所有项以获得最佳使用体验。
                  </Paragraph>
                </div>
              }
              type="info"
              showIcon
              icon={<ExclamationCircleOutlined />}
            />
          )}

          {progress === 100 && (
            <Alert
              message="上线准备完成"
              description="恭喜！您已完成所有上线准备工作，可以开始使用系统了。如有疑问，请查看帮助文档或联系系统管理员。"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
            />
          )}
        </Space>
      );
  };

  const allTabs = [SYSTEM_TAB, ...ROLE_LIST];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>自助式上线向导</Title>
      <Paragraph>
        系统上线：从0开始完成基础数据配置直至可开出业务单据。按角色：为各角色提供数据准备、权限配置、操作培训等清单。
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
        items={allTabs.map(tab => ({
          key: tab.code,
          label: (
            <Space>
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </Space>
          ),
          children: tab.code === 'system' ? renderSystemTab() : renderRoleTab(),
        }))}
      />
    </div>
  );
};

export default OnboardingWizardPage;
