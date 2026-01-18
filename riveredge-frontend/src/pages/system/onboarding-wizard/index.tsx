/**
 * 自助式上线向导页面
 * 
 * 为每个角色提供上线准备向导，包括数据准备、权限配置、操作培训等
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { Card, Tabs, Steps, Checkbox, Space, Typography, Tag, Button, List, Empty, Alert } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { getRoleOnboardingGuide, getAllOnboardingGuides } from '../../../services/onboarding';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

/**
 * 角色列表（13个角色）
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
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('sales');
  const [guideData, setGuideData] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  /**
   * 加载角色上线向导数据
   */
  const loadRoleGuide = async (roleCode: string) => {
    try {
      setLoading(true);
      const response: any = await getRoleOnboardingGuide(undefined, roleCode);
      const data = response.guide || response;
      setGuideData(data);
      
      // 从localStorage加载已完成项
      const savedCompleted = localStorage.getItem(`onboarding_completed_${roleCode}`);
      if (savedCompleted) {
        setCompletedItems(new Set(JSON.parse(savedCompleted)));
      } else {
        setCompletedItems(new Set());
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载上线向导失败');
      setGuideData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换角色
   */
  const handleRoleChange = (roleCode: string) => {
    setActiveRole(roleCode);
    loadRoleGuide(roleCode);
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
    // 保存到localStorage
    localStorage.setItem(`onboarding_completed_${activeRole}`, JSON.stringify(Array.from(newCompleted)));
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

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadRoleGuide(activeRole);
  }, []);

  const progress = calculateProgress();

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>自助式上线向导</Title>
      <Paragraph>
        为每个角色提供上线准备向导，包括数据准备、权限配置、操作培训等。按照清单逐步完成上线准备工作。
      </Paragraph>

      <Tabs
        activeKey={activeRole}
        onChange={handleRoleChange}
        type="card"
        items={ROLE_LIST.map(role => ({
          key: role.code,
          label: (
            <Space>
              <span>{role.icon}</span>
              <span>{role.name}</span>
            </Space>
          ),
        }))}
      />

      {loading ? (
        <Card loading={loading} />
      ) : guideData ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 进度概览 */}
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
      ) : (
        <Card>
          <Empty description="暂无上线向导数据" />
        </Card>
      )}
    </div>
  );
};

export default OnboardingWizardPage;
