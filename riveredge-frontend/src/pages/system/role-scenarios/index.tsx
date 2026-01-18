/**
 * 多角色场景推演页面
 * 
 * 展示13个角色的完整使用场景，支持场景推演和查看
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { Card, Tabs, Descriptions, Tag, Space, Button, List, Typography, Empty } from 'antd';
import { EyeOutlined, DashboardOutlined, SafetyOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { getRoleScenarios, getRoleDashboard, getRolePermissions, RoleScenarioResponse, RoleScenarioData } from '../../../services/roleScenario';

const { Title, Paragraph, Text } = Typography;

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
 * 多角色场景推演页面组件
 */
const RoleScenariosPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('sales');
  const [scenarioData, setScenarioData] = useState<RoleScenarioData | null>(null);
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);

  /**
   * 加载角色场景数据
   */
  const loadRoleScenario = async (roleCode: string) => {
    try {
      setLoading(true);
      const response: any = await getRoleScenarios(undefined, roleCode);
      const data = response.data || response;
      
      if (data.scenarios && typeof data.scenarios === 'object' && !Array.isArray(data.scenarios)) {
        // 如果是所有场景的字典，提取当前角色的场景
        const roleScenario = (data.scenarios as Record<string, RoleScenarioData>)[roleCode];
        if (roleScenario) {
          setScenarioData(roleScenario);
        } else {
          setScenarioData(null);
        }
      } else if (data.scenarios && typeof data.scenarios === 'object' && 'name' in data.scenarios) {
        // 如果是单个角色的场景数据（直接是RoleScenarioData对象）
        setScenarioData(data.scenarios as RoleScenarioData);
      } else {
        // 尝试从scenarios字典中获取
        const allScenarios = data.scenarios as Record<string, RoleScenarioData>;
        if (allScenarios && allScenarios[roleCode]) {
          setScenarioData(allScenarios[roleCode]);
        } else {
          setScenarioData(null);
        }
      }
      
      // 加载工作台配置
      try {
        const dashboardResponse: any = await getRoleDashboard(undefined, roleCode);
        const dashboardData = dashboardResponse.data || dashboardResponse;
        setDashboardConfig(dashboardData.dashboard || dashboardData);
      } catch (error) {
        console.warn('加载工作台配置失败:', error);
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载角色场景失败');
      setScenarioData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换角色
   */
  const handleRoleChange = (roleCode: string) => {
    setActiveRole(roleCode);
    loadRoleScenario(roleCode);
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadRoleScenario(activeRole);
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>多角色场景推演</Title>
      <Paragraph>
        展示13个角色的完整使用场景，包括职责说明、使用场景、功能特性、权限配置和工作台定制等。
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
      ) : scenarioData ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 角色基本信息 */}
          <Card title="角色信息">
            <Descriptions column={2}>
              <Descriptions.Item label="角色名称">{scenarioData.name}</Descriptions.Item>
              <Descriptions.Item label="角色代码">{activeRole}</Descriptions.Item>
              <Descriptions.Item label="职责描述" span={2}>
                {scenarioData.description}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 使用场景 */}
          <Card title="使用场景" extra={<EyeOutlined />}>
            <List
              dataSource={scenarioData.scenarios || []}
              renderItem={(scenario) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{scenario.name}</Text>
                        <Tag color="blue">{scenario.id}</Tag>
                      </Space>
                    }
                    description={scenario.description}
                  />
                  <div>
                    <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                      <Text strong>功能特性：</Text>
                    </Paragraph>
                    <Space wrap>
                      {scenario.features.map((feature, index) => (
                        <Tag key={index} color="green">{feature}</Tag>
                      ))}
                    </Space>
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                      <Text strong>所需权限：</Text>
                    </Paragraph>
                    <Space wrap style={{ marginTop: 8 }}>
                      {scenario.permissions.map((permission, index) => (
                        <Tag key={index} color="orange">{permission}</Tag>
                      ))}
                    </Space>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          {/* 工作台配置 */}
          {dashboardConfig && (
            <Card title="工作台配置" extra={<DashboardOutlined />}>
              <List
                dataSource={dashboardConfig.widgets || []}
                renderItem={(widget: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="purple">{widget.type}</Tag>
                          <Text strong>{widget.title}</Text>
                        </Space>
                      }
                      description={<Text code>{widget.api}</Text>}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Space>
      ) : (
        <Card>
          <Empty description="暂无角色场景数据" />
        </Card>
      )}
    </div>
  );
};

export default RoleScenariosPage;
