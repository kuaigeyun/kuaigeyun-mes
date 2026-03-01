/**
 * 自助式上线向导页面
 *
 * 系统上线：从0到可开单的步骤式引导（数据校验）
 * 按角色：为每个角色提供上线准备向导，包括数据准备、权限配置、操作培训等
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Tabs, Steps, Checkbox, Space, Typography, Tag, Button, List, Empty, Alert } from 'antd';
import { getTenantId } from '../../../utils/auth';
import { CheckCircleOutlined, ExclamationCircleOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { getRoleOnboardingGuide, getSystemGoLiveGuide } from '../../../services/onboarding';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

const ROLE_KEYS: Array<{ code: string; nameKey: string; icon: string }> = [
  { code: 'sales', nameKey: 'roleSales', icon: '💼' },
  { code: 'purchase', nameKey: 'rolePurchase', icon: '🛒' },
  { code: 'warehouse', nameKey: 'roleWarehouse', icon: '📦' },
  { code: 'technician', nameKey: 'roleTechnician', icon: '🔧' },
  { code: 'planner', nameKey: 'rolePlanner', icon: '📋' },
  { code: 'supervisor', nameKey: 'roleSupervisor', icon: '👔' },
  { code: 'operator', nameKey: 'roleOperator', icon: '👷' },
  { code: 'quality', nameKey: 'roleQuality', icon: '✅' },
  { code: 'equipment', nameKey: 'roleEquipment', icon: '⚙️' },
  { code: 'finance', nameKey: 'roleFinance', icon: '💰' },
  { code: 'manager', nameKey: 'roleManager', icon: '👤' },
  { code: 'implementer', nameKey: 'roleImplementer', icon: '🚀' },
];

/**
 * 自助式上线向导页面组件
 */
const OnboardingWizardPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();

  const allTabs = useMemo(() => [
    { code: 'system', name: t('pages.system.onboardingWizard.tabSystem'), icon: '🚀' },
    ...ROLE_KEYS.map((r) => ({ code: r.code, name: t(`pages.system.onboardingWizard.${r.nameKey}`), icon: r.icon })),
  ], [t]);
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
      messageApi.error(error?.message || t('pages.system.onboardingWizard.loadSystemFailed'));
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
      messageApi.error(error?.message || t('pages.system.onboardingWizard.loadRoleFailed'));
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
      return <Card><Empty description={t('pages.system.onboardingWizard.emptySystem')} /></Card>;
    }
    const { init_completed, message, guide } = systemGuideData;
    if (!init_completed) {
      return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message={t('pages.system.onboardingWizard.alertInitTitle')}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  {t('pages.system.onboardingWizard.alertInitDesc')}
                </Paragraph>
                <Button type="primary" onClick={() => navigate('/init/wizard')}>
                  {t('pages.system.onboardingWizard.goToInit')}
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
              <Text strong>{t('pages.system.onboardingWizard.systemProgress')}</Text>
              <Space>
                <Button size="small" icon={<ReloadOutlined />} onClick={loadSystemGuide}>
                  {t('pages.system.onboardingWizard.refresh')}
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

        <Card title={`${guide?.name || t('pages.system.onboardingWizard.tabSystem')} - ${t('pages.system.onboardingWizard.fromZeroToOrder')}`}>
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
                              {item.required && <Tag color="red" size="small">{t('pages.system.onboardingWizard.required')}</Tag>}
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
                              {t('pages.system.onboardingWizard.goToConfig')}
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
            message={t('pages.system.onboardingWizard.systemComplete')}
            description={t('pages.system.onboardingWizard.systemCompleteDesc')}
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
    if (!guideData) return <Card><Empty description={t('pages.system.onboardingWizard.emptyRole')} /></Card>;
    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>{t('pages.system.onboardingWizard.roleProgress')}</Text>
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
          <Card title={`${guideData.name} - ${t('pages.system.onboardingWizard.roleChecklist')}`}>
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
                                {item.required && <Tag color="red" size="small">{t('pages.system.onboardingWizard.required')}</Tag>}
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
              message={t('pages.system.onboardingWizard.roleTip')}
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    {t('pages.system.onboardingWizard.roleTipDesc1')}
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    {t('pages.system.onboardingWizard.roleTipDesc2')}
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
              message={t('pages.system.onboardingWizard.roleComplete')}
              description={t('pages.system.onboardingWizard.roleCompleteDesc')}
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
            />
          )}
        </Space>
      );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('pages.system.onboardingWizard.title')}</Title>
      <Paragraph>
        {t('pages.system.onboardingWizard.subtitle')}
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
        items={allTabs.map((tab) => ({
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
