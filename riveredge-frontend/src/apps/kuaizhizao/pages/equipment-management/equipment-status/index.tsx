/**
 * 设备状态监控页面
 *
 * 实时监控设备状态，使用Card和Badge组件展示设备状态信息。
 *
 * Author: Luigi Lu
 * Date: 2026-01-16
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Button, Space, message, Modal, Timeline, Tag, Row, Col, Select, Input, App, Typography, Spin, Empty, theme as AntdTheme } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { ReloadOutlined, HistoryOutlined, EditOutlined, PlayCircleOutlined, PauseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { equipmentStatusApi } from '../../../services/equipment';
import { ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
  DocumentTrackingRelationsTabsBody,
  DocumentTrackingTimelineBody,
  TraceLinkedDocumentBrief,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefFooter } from '../EquipmentTraceBriefFooter';

const { Meta } = Card;
const { Option } = Select;
const { Search } = Input;

/** 详情 Drawer 外左侧全链路浮层（Uni-detail）；此页跟踪主体为设备台账单据 */
const ES_DETAIL_CHAIN_FLOAT_MARGIN = 16;
const ES_DETAIL_LEFT_CHAIN_GAP = 16;
const ES_DETAIL_CHAIN_DRAWER_GAP = 16;
const ES_DETAIL_CHAIN_VERTICAL_TRIM = ES_DETAIL_CHAIN_FLOAT_MARGIN * 2 + ES_DETAIL_LEFT_CHAIN_GAP;
const esDetailChainHalfHeightCss = `calc((100vh - ${ES_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2)`;
const esDetailChainPanelWidthCss = `calc(50vw - ${ES_DETAIL_CHAIN_FLOAT_MARGIN * 2 + ES_DETAIL_CHAIN_DRAWER_GAP}px)`;
const esDetailBriefPanelTopCss = `calc(${ES_DETAIL_CHAIN_FLOAT_MARGIN}px + (100vh - ${ES_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2 + ${ES_DETAIL_LEFT_CHAIN_GAP}px)`;

interface EquipmentStatus {
  equipment: {
    id: number;
    uuid: string;
    code: string;
    name: string;
    type?: string;
    category?: string;
  };
  status: string;
  is_online: boolean;
  monitored_at?: string;
  runtime_hours?: number;
  temperature?: number;
  pressure?: number;
  vibration?: number;
  other_parameters?: any;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
}

interface StatusHistoryItem {
  uuid: string;
  from_status?: string;
  to_status: string;
  status_changed_at: string;
  changed_by_name?: string;
  reason?: string;
  remark?: string;
}

const EquipmentStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const equipmentStatusDrawerZIndex = token.zIndexPopupBase;
  const equipmentStatusChainOverlayZIndex = token.zIndexPopupBase + 1;
  const { message: messageApi } = App.useApp();
  const [statusList, setStatusList] = useState<EquipmentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlineFilter, setOnlineFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 详情和编辑相关状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<EquipmentStatus | null>(null);
  const [historyList, setHistoryList] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [eqStatusTrackingRefreshKey, setEqStatusTrackingRefreshKey] = useState(0);
  const [fullChainRefreshKey, setFullChainRefreshKey] = useState(0);
  const [fullChainTraceLoading, setFullChainTraceLoading] = useState(false);
  const [fullChainBriefDoc, setFullChainBriefDoc] = useState<{ document_type: string; document_id: number } | null>(
    null,
  );

  const onFullChainGraphNodeClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (type === 'equipment' && currentEquipment?.equipment?.id != null && id === currentEquipment.equipment.id) {
        setFullChainBriefDoc(null);
        return;
      }
      setFullChainBriefDoc({ document_type: type, document_id: id });
    },
    [currentEquipment],
  );

  const equipmentDocTracking = useDocumentTracking(
    detailVisible && currentEquipment?.equipment?.id ? 'equipment' : undefined,
    currentEquipment?.equipment?.id,
    eqStatusTrackingRefreshKey,
  );

  // 状态更新Modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const updateFormRef = useRef<any>(null);

  /**
   * 获取设备实时状态列表
   */
  const fetchStatusList = async () => {
    try {
      setLoading(true);
      const data = await equipmentStatusApi.getRealtimeStatus();
      setStatusList(data || []);
    } catch (error: any) {
      messageApi.error(`获取设备状态失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    fetchStatusList();

    // 自动刷新（每30秒）
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchStatusList();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh]);

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      '正常': 'success',
      '运行中': 'processing',
      '待机': 'default',
      '维修中': 'warning',
      '故障': 'error',
      '停用': 'default',
    };
    return statusColors[status] || 'default';
  };

  /**
   * 获取状态标签
   */
  const getStatusTag = (status: string) => {
    return <Badge status={getStatusColor(status) as any} text={status} />;
  };

  /**
   * 处理查看详情
   */
  const handleViewDetail = async (equipment: EquipmentStatus) => {
    try {
      setFullChainBriefDoc(null);
      setCurrentEquipment(equipment);
      setDetailVisible(true);
      setEqStatusTrackingRefreshKey((k) => k + 1);
      setFullChainRefreshKey((k) => k + 1);

      // 加载状态历史
      setHistoryLoading(true);
      const historyData = await equipmentStatusApi.getStatusHistory(equipment.equipment.uuid);
      setHistoryList(historyData.items || []);
    } catch (error: any) {
      messageApi.error(`获取状态历史失败: ${error.message || '未知错误'}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  /**
   * 处理更新状态
   */
  const handleUpdateStatus = (equipment: EquipmentStatus) => {
    setCurrentEquipment(equipment);
    setUpdateModalVisible(true);
    setTimeout(() => {
      updateFormRef.current?.setFieldsValue({
        equipment_uuid: equipment.equipment.uuid,
        status: equipment.status,
        is_online: equipment.is_online,
      });
    }, 100);
  };

  /**
   * 提交状态更新
   */
  const handleUpdateStatusSubmit = async (values: any) => {
    try {
      const targetUuid = values.equipment_uuid as string;
      await equipmentStatusApi.updateStatus(values);
      messageApi.success('设备状态更新成功');
      setUpdateModalVisible(false);
      await fetchStatusList();
      if (detailVisible && currentEquipment?.equipment?.uuid === targetUuid) {
        try {
          const data = await equipmentStatusApi.getRealtimeStatus();
          const found = (data || []).find((s: EquipmentStatus) => s.equipment.uuid === targetUuid);
          if (found) {
            setCurrentEquipment(found);
          }
          setEqStatusTrackingRefreshKey((k) => k + 1);
          setFullChainRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(`更新设备状态失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 筛选设备列表
   */
  const filteredStatusList = statusList.filter((item) => {
    // 状态筛选
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }

    // 在线状态筛选
    if (onlineFilter !== 'all') {
      const isOnline = onlineFilter === 'online';
      if (item.is_online !== isOnline) {
        return false;
      }
    }

    // 关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      return (
        item.equipment.code?.toLowerCase().includes(keyword) ||
        item.equipment.name?.toLowerCase().includes(keyword)
      );
    }

    return true;
  });

  /**
   * 统计信息
   */
  const stats = {
    total: filteredStatusList.length,
    online: filteredStatusList.filter((item) => item.is_online).length,
    offline: filteredStatusList.filter((item) => !item.is_online).length,
    normal: filteredStatusList.filter((item) => item.status === '正常').length,
    running: filteredStatusList.filter((item) => item.status === '运行中').length,
    maintenance: filteredStatusList.filter((item) => item.status === '维修中').length,
    fault: filteredStatusList.filter((item) => item.status === '故障').length,
  };

  return (
    <ListPageTemplate
      title="设备状态监控"
      extra={
        <Space>
          <Button
            icon={autoRefresh ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '暂停自动刷新' : '开启自动刷新'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchStatusList} loading={loading}>
            刷新
          </Button>
        </Space>
      }
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ color: '#999' }}>总设备数</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.online}</div>
              <div style={{ color: '#999' }}>在线设备</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.offline}</div>
              <div style={{ color: '#999' }}>离线设备</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.running}</div>
              <div style={{ color: '#999' }}>运行中</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.maintenance}</div>
              <div style={{ color: '#999' }}>维修中</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.fault}</div>
              <div style={{ color: '#999' }}>故障设备</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Space>
              <span>状态：</span>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
              >
                <Option value="all">全部</Option>
                <Option value="正常">正常</Option>
                <Option value="运行中">运行中</Option>
                <Option value="待机">待机</Option>
                <Option value="维修中">维修中</Option>
                <Option value="故障">故障</Option>
                <Option value="停用">停用</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Space>
              <span>在线状态：</span>
              <Select
                value={onlineFilter}
                onChange={setOnlineFilter}
                style={{ width: 120 }}
              >
                <Option value="all">全部</Option>
                <Option value="online">在线</Option>
                <Option value="offline">离线</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Search
              placeholder="搜索设备编号或名称"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ maxWidth: 300 }}
            />
          </Col>
        </Row>
      </Card>

      {/* 设备状态卡片列表 */}
      <Row gutter={[16, 16]}>
        {filteredStatusList.map((item) => (
          <Col xs={24} sm={12} md={8} lg={6} xl={4} key={item.equipment.uuid}>
            <Card
              hoverable
              actions={[
                <Button
                  type="link"
                  icon={<HistoryOutlined />}
                  onClick={() => handleViewDetail(item)}
                >
                  历史
                </Button>,
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleUpdateStatus(item)}
                >
                  更新
                </Button>,
              ]}
              style={{
                border: item.status === '故障' ? '2px solid #ff4d4f' : undefined,
              }}
            >
              <Meta
                title={
                  <Space>
                    <span>{item.equipment.code}</span>
                    {item.status === '故障' && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>{item.equipment.name}</div>
                    <div style={{ marginBottom: 8 }}>
                      {getStatusTag(item.status)}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Badge
                        status={item.is_online ? 'success' : 'error'}
                        text={item.is_online ? '在线' : '离线'}
                      />
                    </div>
                    {item.runtime_hours !== undefined && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        运行时长: {item.runtime_hours.toFixed(1)} 小时
                      </div>
                    )}
                    {item.temperature !== undefined && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        温度: {item.temperature.toFixed(1)}°C
                      </div>
                    )}
                    {item.monitored_at && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        更新时间: {dayjs(item.monitored_at).format('HH:mm:ss')}
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {filteredStatusList.length === 0 && !loading && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          暂无设备状态数据
        </Card>
      )}

      {detailVisible && currentEquipment?.equipment?.id != null ? (
        <>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.relationsFullChainTitle')}
            style={{
              position: 'fixed',
              left: ES_DETAIL_CHAIN_FLOAT_MARGIN,
              top: ES_DETAIL_CHAIN_FLOAT_MARGIN,
              width: esDetailChainPanelWidthCss,
              height: esDetailChainHalfHeightCss,
              zIndex: equipmentStatusChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    {t('components.documentTrackingPanel.relationsFullChainTitle')}
                  </div>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={fullChainTraceLoading}
                  style={{ flexShrink: 0 }}
                  onClick={() => setFullChainRefreshKey((k) => k + 1)}
                >
                  {t('components.documentRelationGraph.refresh')}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DocumentTrackingRelationsTabsBody
                documentType="equipment"
                documentId={currentEquipment.equipment.id}
                refreshKey={fullChainRefreshKey}
                onDocumentClick={onFullChainGraphNodeClick}
                compact
                hideInlineRefresh
                onTraceLoadingChange={setFullChainTraceLoading}
              />
            </div>
          </div>

          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.traceBriefTitle')}
            style={{
              position: 'fixed',
              left: ES_DETAIL_CHAIN_FLOAT_MARGIN,
              top: esDetailBriefPanelTopCss,
              width: esDetailChainPanelWidthCss,
              height: esDetailChainHalfHeightCss,
              zIndex: equipmentStatusChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 8,
                flexShrink: 0,
                color: 'var(--ant-color-text)',
              }}
            >
              {t('components.documentTrackingPanel.traceBriefTitle')}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <TraceLinkedDocumentBrief
                documentType={fullChainBriefDoc?.document_type}
                documentId={fullChainBriefDoc?.document_id}
                compactChrome
              />
            </div>
            <EquipmentTraceBriefFooter
              brief={fullChainBriefDoc}
              t={t}
              navigate={navigate}
              closeDrawer={() => {
                setDetailVisible(false);
                setCurrentEquipment(null);
                setHistoryList([]);
                setFullChainBriefDoc(null);
              }}
              onDismissBrief={() => setFullChainBriefDoc(null)}
            />
          </div>
        </>
      ) : null}

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title="设备状态详情"
        open={detailVisible}
        zIndex={equipmentStatusDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setCurrentEquipment(null);
          setHistoryList([]);
          setFullChainBriefDoc(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        customContent={
          currentEquipment ? (
            <>
              <DetailDrawerSection title="实时监控">
                <ProDescriptions
                  title={false}
                  bordered
                  column={2}
                  dataSource={{
                    code: currentEquipment.equipment.code,
                    name: currentEquipment.equipment.name,
                    type: currentEquipment.equipment.type || '-',
                    category: currentEquipment.equipment.category || '-',
                    status: getStatusTag(currentEquipment.status),
                    is_online: (
                      <Badge
                        status={currentEquipment.is_online ? 'success' : 'error'}
                        text={currentEquipment.is_online ? '在线' : '离线'}
                      />
                    ),
                    runtime_hours:
                      currentEquipment.runtime_hours !== undefined
                        ? `${currentEquipment.runtime_hours.toFixed(2)} 小时`
                        : undefined,
                    temperature:
                      currentEquipment.temperature !== undefined
                        ? `${currentEquipment.temperature.toFixed(1)}°C`
                        : undefined,
                    pressure: currentEquipment.pressure !== undefined ? currentEquipment.pressure.toFixed(2) : undefined,
                    vibration:
                      currentEquipment.vibration !== undefined ? currentEquipment.vibration.toFixed(2) : undefined,
                    last_maintenance_date: currentEquipment.last_maintenance_date
                      ? dayjs(currentEquipment.last_maintenance_date).format('YYYY-MM-DD')
                      : undefined,
                    next_maintenance_date: currentEquipment.next_maintenance_date
                      ? dayjs(currentEquipment.next_maintenance_date).format('YYYY-MM-DD')
                      : undefined,
                    monitored_at: currentEquipment.monitored_at
                      ? dayjs(currentEquipment.monitored_at).format('YYYY-MM-DD HH:mm:ss')
                      : undefined,
                  }}
                  columns={[
                    { title: '设备编号', dataIndex: 'code' },
                    { title: '设备名称', dataIndex: 'name' },
                    { title: '设备类型', dataIndex: 'type' },
                    { title: '设备分类', dataIndex: 'category' },
                    { title: '当前状态', dataIndex: 'status' },
                    { title: '在线状态', dataIndex: 'is_online' },
                    { title: '运行时长', dataIndex: 'runtime_hours', hide: currentEquipment.runtime_hours === undefined },
                    { title: '温度', dataIndex: 'temperature', hide: currentEquipment.temperature === undefined },
                    { title: '压力', dataIndex: 'pressure', hide: currentEquipment.pressure === undefined },
                    { title: '振动值', dataIndex: 'vibration', hide: currentEquipment.vibration === undefined },
                    {
                      title: '上次维护日期',
                      dataIndex: 'last_maintenance_date',
                      hide: !currentEquipment.last_maintenance_date,
                    },
                    {
                      title: '下次维护日期',
                      dataIndex: 'next_maintenance_date',
                      hide: !currentEquipment.next_maintenance_date,
                    },
                    { title: '最后更新时间', dataIndex: 'monitored_at', hide: !currentEquipment.monitored_at },
                  ]}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="状态变更历史">
                {historyLoading ? (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                ) : (
                  <Timeline
                    items={historyList.map((history) => ({
                      color:
                        history.to_status === '故障' ? 'red' : history.to_status === '维修中' ? 'orange' : 'blue',
                      children: (
                        <div>
                          <div>
                            <Tag color={getStatusColor(history.to_status)}>{history.to_status}</Tag>
                            {history.from_status && (
                              <>
                                <span style={{ margin: '0 8px' }}>←</span>
                                <Tag>{history.from_status}</Tag>
                              </>
                            )}
                          </div>
                          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                            {dayjs(history.status_changed_at).format('YYYY-MM-DD HH:mm:ss')}
                            {history.changed_by_name && ` · ${history.changed_by_name}`}
                          </div>
                          {history.reason && (
                            <div style={{ marginTop: 4, color: '#666' }}>原因: {history.reason}</div>
                          )}
                          {history.remark && (
                            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>备注: {history.remark}</div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {equipmentDocTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {equipmentDocTracking.error && !equipmentDocTracking.loading && (
                  <Typography.Text type="danger">{equipmentDocTracking.error}</Typography.Text>
                )}
                {equipmentDocTracking.data && !equipmentDocTracking.loading && (
                  <DocumentTrackingTimelineBody data={equipmentDocTracking.data} />
                )}
                {!equipmentDocTracking.loading && !equipmentDocTracking.data && !equipmentDocTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 状态更新Modal */}
      <FormModalTemplate
        title="更新设备状态"
        open={updateModalVisible}
        onCancel={() => setUpdateModalVisible(false)}
        setFormRef={(ref: any) => { updateFormRef.current = ref; }}
        onFinish={handleUpdateStatusSubmit}
        formProps={{
          layout: 'vertical',
        }}
      >
        <ProFormSelect
          name="status"
          label="设备状态"
          options={[
            { label: '正常', value: '正常' },
            { label: '运行中', value: '运行中' },
            { label: '待机', value: '待机' },
            { label: '维修中', value: '维修中' },
            { label: '故障', value: '故障' },
            { label: '停用', value: '停用' },
          ]}
          rules={[{ required: true, message: '请选择设备状态' }]}
        />
        <ProFormSelect
          name="is_online"
          label="在线状态"
          options={[
            { label: '在线', value: true },
            { label: '离线', value: false },
          ]}
        />
        <ProFormTextArea
          name="reason"
          label="变更原因"
          placeholder="请输入状态变更原因"
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="请输入备注信息"
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default EquipmentStatusPage;
