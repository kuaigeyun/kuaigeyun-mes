/**
 * 应用中心列表页面
 * 
 * 用于系统管理员查看和管理组织内的应用。
 * 支持应用的 CRUD 操作、安装/卸载、启用/禁用功能。
 */

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Drawer, Modal, message, Switch, Card, Dropdown, Popconfirm, Row, Col, Input, Select, Pagination, Form, Spin } from 'antd';
import { useForm } from 'antd/es/form/Form';
import {
  EyeOutlined,
  DownloadOutlined,
  StopOutlined,
  MoreOutlined,
  AppstoreOutlined,
  UserOutlined,
  ShopOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  ApiOutlined,
  CloudOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  getApplicationList,
  getApplicationByUuid,
  installApplication,
  uninstallApplication,
  enableApplication,
  disableApplication,
  Application,
} from '../../../../services/application';

/**
 * 根据应用代码获取图标组件
 */
const getApplicationIcon = (code: string, icon?: string | null) => {
  // 如果有自定义图标 URL，使用图片
  if (icon) {
    return <img src={icon} alt={code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  
  // 根据应用代码返回默认图标
  const iconMap: Record<string, React.ReactNode> = {
    kuaimes: <DatabaseOutlined />, // 快格轻MES
    crm: <UserOutlined />,
    erp: <ShopOutlined />,
    mes: <DatabaseOutlined />,
    wms: <DatabaseOutlined />,
    oa: <FileTextOutlined />,
    scm: <ApiOutlined />,
    bi: <BarChartOutlined />,
    hr: <TeamOutlined />,
  };
  return iconMap[code] || <AppstoreOutlined />;
};

/**
 * 应用中心列表页面组件
 */
const ApplicationListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [form] = useForm();
  const queryClient = useQueryClient();

  // 数据状态
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // 分页状态
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // 筛选状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSystemFilter, setIsSystemFilter] = useState<string>('');
  const [isInstalledFilter, setIsInstalledFilter] = useState<string>('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 加载应用列表数据
   */
  const loadApplications = async (page = current, size = pageSize) => {
    try {
      setLoading(true);

      // 构建查询参数
      const params: any = {
        skip: (page - 1) * size,
        limit: size,
      };

      // 添加筛选条件
      if (isActiveFilter !== '') {
        params.is_active = isActiveFilter === 'true';
      }
      if (isInstalledFilter !== '') {
        params.is_installed = isInstalledFilter === 'true';
      }

      const allData = await getApplicationList(params);
      let filteredData = allData || [];

      // 前端筛选（因为后端可能不支持某些筛选）
      if (isSystemFilter !== '') {
        filteredData = filteredData.filter(item => item.is_system === (isSystemFilter === 'true'));
      }

      // 搜索关键词筛选
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.toLowerCase();
        filteredData = filteredData.filter(item =>
          item.name.toLowerCase().includes(keyword) ||
          item.code.toLowerCase().includes(keyword) ||
          (item.description && item.description.toLowerCase().includes(keyword))
        );
      }

      setApplications(filteredData);
      setTotal(filteredData.length);
    } catch (error: any) {
      console.error('获取应用列表失败:', error);
      messageApi.error(error?.message || '获取应用列表失败');
      setApplications([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Application) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getApplicationByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取应用详情失败');
    } finally {
      setDetailLoading(false);
    }
  };


  /**
   * 处理安装应用
   */
  const handleInstall = async (record: Application) => {
    try {
      await installApplication(record.uuid);
      messageApi.success('安装成功');
      loadApplications();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    } catch (error: any) {
      messageApi.error(error.message || '安装失败');
    }
  };

  /**
   * 处理卸载应用
   */
  const handleUninstall = async (record: Application) => {
    try {
      await uninstallApplication(record.uuid);
      messageApi.success('卸载成功');
      loadApplications();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    } catch (error: any) {
      messageApi.error(error.message || '卸载失败');
    }
  };

  /**
   * 处理启用/禁用应用
   */
  const handleToggleActive = async (record: Application, checked: boolean) => {
    try {
      if (checked) {
        await enableApplication(record.uuid);
        messageApi.success('启用成功');
      } else {
        await disableApplication(record.uuid);
        messageApi.success('禁用成功');
      }
      loadApplications();
      // 使应用菜单缓存失效，自动更新菜单
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    }
  };


  /**
   * 处理搜索
   */
  const handleSearch = () => {
    setCurrent(1); // 重置到第一页
    loadApplications(1, pageSize);
  };

  /**
   * 处理筛选条件变化
   */
  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === 'isSystem') setIsSystemFilter(value);
    if (filterType === 'isInstalled') setIsInstalledFilter(value);
    if (filterType === 'isActive') setIsActiveFilter(value);

    setCurrent(1); // 重置到第一页
    loadApplications(1, pageSize);
  };

  /**
   * 处理分页变化
   */
  const handlePaginationChange = (page: number, size: number) => {
    setCurrent(page);
    setPageSize(size);
    loadApplications(page, size);
  };

  /**
   * 渲染应用卡片
   */
  const renderApplicationCard = (application: Application, index: number) => {
    const menuItems = [
      {
        key: 'view',
        label: '查看详情',
        icon: <EyeOutlined />,
        onClick: () => handleView(application),
      },
      {
        type: 'divider' as const,
      },
      !application.is_installed
        ? {
            key: 'install',
            label: '安装',
            icon: <DownloadOutlined />,
            onClick: () => {
              Modal.confirm({
                title: '确定要安装这个应用吗？',
                onOk: () => handleInstall(application),
              });
            },
          }
        : {
            key: 'uninstall',
            label: '卸载',
            icon: <StopOutlined />,
            disabled: application.is_system,
            onClick: () => {
              if (application.is_system) return;
              Modal.confirm({
                title: '确定要卸载这个应用吗？',
                onOk: () => handleUninstall(application),
              });
            },
          },
    ];

    return (
      <Card
        key={application.uuid}
        hoverable
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        cover={
          <div
            style={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: application.is_active && application.is_installed ? '#f0f9ff' : '#fafafa',
              padding: '16px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {application.icon ? (
              <img 
                src={application.icon} 
                alt={application.name} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  opacity: application.is_active && application.is_installed ? 1 : 0.5,
                }} 
              />
            ) : (
              React.cloneElement(getApplicationIcon(application.code, application.icon) as React.ReactElement, {
                style: {
                  fontSize: 72,
                  color: application.is_active && application.is_installed ? '#1890ff' : '#d9d9d9',
                },
              })
            )}
          </div>
        }
        actions={[
          <div key="active" style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>启用状态</span>
            <Switch
              checked={application.is_active}
              onChange={(checked) => handleToggleActive(application, checked)}
              disabled={!application.is_installed}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </div>,
          <Dropdown
            key="more"
            menu={{ items: menuItems }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} style={{ width: '100%' }}>
              更多操作
            </Button>
          </Dropdown>,
        ]}
      >
        <Card.Meta
          title={
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#262626' }}>
                  {application.name}
                </span>
                <Space size={4}>
                  {application.is_system && (
                    <Tag color="default" style={{ margin: 0 }}>系统</Tag>
                  )}
                  {application.is_installed ? (
                    <Tag color="success" style={{ margin: 0 }}>已安装</Tag>
                  ) : (
                    <Tag style={{ margin: 0 }}>未安装</Tag>
                  )}
                </Space>
              </div>
            </div>
          }
          description={
            <div>
              <div
                style={{
                  marginBottom: 12,
                  color: '#595959',
                  fontSize: 13,
                  lineHeight: '20px',
                  minHeight: 40,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {application.description || '暂无描述'}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#8c8c8c',
                  paddingTop: 8,
                  borderTop: '1px solid #f0f0f0',
                }}
              >
                <span>代码: {application.code}</span>
                {application.version && (
                  <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                    v{application.version}
                  </Tag>
                )}
              </div>
            </div>
          }
        />
      </Card>
    );
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadApplications();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      {/* 头部工具栏 */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '8px' }}>应用中心</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>管理系统中的应用，支持安装、启用、禁用等操作。插件应用会在系统启动时自动扫描并注册。</p>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: '24px' }}>
        <Form layout="inline" form={form}>
          <Form.Item label="搜索应用">
            <Input
              placeholder="输入应用名称、代码或描述"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: '300px' }}
              allowClear
            />
          </Form.Item>
          <Form.Item label="系统应用">
            <Select
              placeholder="全部"
              value={isSystemFilter}
              onChange={(value) => handleFilterChange('isSystem', value)}
              style={{ width: '120px' }}
              allowClear
            >
              <Select.Option value="true">是</Select.Option>
              <Select.Option value="false">否</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="安装状态">
            <Select
              placeholder="全部"
              value={isInstalledFilter}
              onChange={(value) => handleFilterChange('isInstalled', value)}
              style={{ width: '120px' }}
              allowClear
            >
              <Select.Option value="true">已安装</Select.Option>
              <Select.Option value="false">未安装</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="启用状态">
            <Select
              placeholder="全部"
              value={isActiveFilter}
              onChange={(value) => handleFilterChange('isActive', value)}
              style={{ width: '120px' }}
              allowClear
            >
              <Select.Option value="true">启用</Select.Option>
              <Select.Option value="false">禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 应用卡片列表 */}
      <Spin spinning={loading}>
        <Row gutter={[24, 24]}>
          {applications.map((application, index) => (
            <Col key={application.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
              {renderApplicationCard(application, index)}
            </Col>
          ))}
        </Row>
      </Spin>

      {/* 分页 */}
      {total > 0 && (
        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <Pagination
            current={current}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => `共 ${total} 个应用，显示 ${range[0]}-${range[1]} 个`}
            pageSizeOptions={['12', '24', '48', '96']}
            onChange={handlePaginationChange}
          />
        </div>
      )}

      {/* 空状态 */}
      {!loading && applications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <AppstoreOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <div style={{ color: '#666', marginBottom: '16px' }}>
            {searchKeyword || isSystemFilter || isInstalledFilter || isActiveFilter ? '没有找到符合条件的应用' : '暂无应用'}
          </div>
          {(searchKeyword || isSystemFilter || isInstalledFilter || isActiveFilter) && (
            <Button onClick={() => {
              setSearchKeyword('');
              setIsSystemFilter('');
              setIsInstalledFilter('');
              setIsActiveFilter('');
              setCurrent(1);
              loadApplications(1, pageSize);
            }}>
              清除筛选条件
            </Button>
          )}
        </div>
      )}

      {/* 查看详情 Drawer */}
      <Drawer
        title="应用详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<Application>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '应用名称',
                dataIndex: 'name',
              },
              {
                title: '应用代码',
                dataIndex: 'code',
              },
              {
                title: '应用描述',
                dataIndex: 'description',
              },
              {
                title: '应用图标',
                dataIndex: 'icon',
                render: (value) => value ? <img src={value} alt="图标" style={{ maxWidth: 100, maxHeight: 100 }} /> : '-',
              },
              {
                title: '应用版本',
                dataIndex: 'version',
              },
              {
                title: '路由路径',
                dataIndex: 'route_path',
              },
              {
                title: '入口点',
                dataIndex: 'entry_point',
              },
              {
                title: '权限代码',
                dataIndex: 'permission_code',
              },
              {
                title: '菜单配置',
                dataIndex: 'menu_config',
                render: (value) => value ? (
                  <pre style={{ 
                    margin: 0, 
                    fontSize: 12, 
                    maxWidth: 600, 
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '4px'
                  }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : '-',
              },
              {
                title: '系统应用',
                dataIndex: 'is_system',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '安装状态',
                dataIndex: 'is_installed',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '已安装' : '未安装'}
                  </Tag>
                ),
              },
              {
                title: '启用状态',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '排序顺序',
                dataIndex: 'sort_order',
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};

export default ApplicationListPage;

