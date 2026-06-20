/**
 * 设备状态监控页面
 *
 * 实时监控设备状态，使用Card和Badge组件展示设备状态信息。
 *
 * Author: Luigi Lu
 * Date: 2026-01-16
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Button, Space, Timeline, Tag, Row, Col, Select, Input, App, Typography, Spin, Empty, theme as AntdTheme } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { ReloadOutlined, HistoryOutlined, EditOutlined, PlayCircleOutlined, PauseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { equipmentStatusApi } from '../../../services/equipment';
import { ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import dayjs from 'dayjs';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';
import { formatDateTime } from '../../../../../utils/format';

const { Meta } = Card;
const { Option } = Select;
const { Search } = Input;

const P = 'app.kuaizhizao.equipmentStatus';

const STATUS_I18N: Record<string, string> = {
  '正常': `${P}.status.normal`,
  '运行中': `${P}.status.running`,
  '待机': `${P}.status.standby`,
  '维修中': `${P}.status.maintenance`,
  '故障': `${P}.status.fault`,
  '停用': `${P}.status.disabled`,
};

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

function hasMetric(value: number | null | undefined): boolean {
  return value != null && !Number.isNaN(Number(value));
}

function formatMetric(value: number | null | undefined, decimals: number, suffix = ''): string | undefined {
  if (!hasMetric(value)) return undefined;
  return `${Number(value).toFixed(decimals)}${suffix}`;
}

const EquipmentStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const equipmentStatusDrawerZIndex = token.zIndexPopupBase;
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

  const equipmentDocTracking = useDocumentTracking(
    detailVisible && currentEquipment?.equipment?.id ? 'equipment' : undefined,
    currentEquipment?.equipment?.id,
    eqStatusTrackingRefreshKey,
  );

  // 状态更新Modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const updateFormRef = useRef<any>(null);

  const translateStatus = (status: string) => {
    const key = STATUS_I18N[status];
    return key ? t(key) : status;
  };

  const statusFormOptions = useMemo(
    () => [
      { label: t(`${P}.status.normal`), value: '正常' },
      { label: t(`${P}.status.running`), value: '运行中' },
      { label: t(`${P}.status.standby`), value: '待机' },
      { label: t(`${P}.status.maintenance`), value: '维修中' },
      { label: t(`${P}.status.fault`), value: '故障' },
      { label: t(`${P}.status.disabled`), value: '停用' },
    ],
    [t],
  );

  const descriptionColumns: ProDescriptionsItemProps<Record<string, unknown>>[] = useMemo(
    () => [
      { title: t(`${P}.col.code`), dataIndex: 'code' },
      { title: t(`${P}.col.name`), dataIndex: 'name' },
      { title: t(`${P}.col.type`), dataIndex: 'type' },
      { title: t(`${P}.col.category`), dataIndex: 'category' },
      { title: t(`${P}.col.status`), dataIndex: 'status' },
      { title: t(`${P}.col.onlineStatus`), dataIndex: 'is_online' },
      { title: t(`${P}.col.runtimeHours`), dataIndex: 'runtime_hours' },
      { title: t(`${P}.col.temperature`), dataIndex: 'temperature' },
      { title: t(`${P}.col.pressure`), dataIndex: 'pressure' },
      { title: t(`${P}.col.vibration`), dataIndex: 'vibration' },
      { title: t(`${P}.col.lastMaintenanceDate`), dataIndex: 'last_maintenance_date' },
      { title: t(`${P}.col.nextMaintenanceDate`), dataIndex: 'next_maintenance_date' },
      { title: t(`${P}.col.monitoredAt`), dataIndex: 'monitored_at' },
    ],
    [t],
  );

  /**
   * 获取设备实时状态列表
   */
  const fetchStatusList = async () => {
    try {
      setLoading(true);
      const data = await equipmentStatusApi.getRealtimeStatus();
      setStatusList(data || []);
    } catch (error: any) {
      messageApi.error(t(`${P}.listFailed`, { message: error.message || t('common.unknownError') }));
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
    return <Badge status={getStatusColor(status) as any} text={translateStatus(status)} />;
  };

  /**
   * 处理查看详情
   */
  const handleViewDetail = async (equipment: EquipmentStatus) => {
    try {
      setCurrentEquipment(equipment);
      setDetailVisible(true);
      setEqStatusTrackingRefreshKey((k) => k + 1);

      // 加载状态历史
      setHistoryLoading(true);
      const historyData = await equipmentStatusApi.getStatusHistory(equipment.equipment.uuid);
      setHistoryList(historyData.items || []);
    } catch (error: any) {
      messageApi.error(t(`${P}.historyFailed`, { message: error.message || t('common.unknownError') }));
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
      await equipmentStatusApi.updateStatus({
        ...values,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${P}.updateSuccess`));
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
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(t(`${P}.updateFailed`, { message: error.message || t('common.unknownError') }));
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

  const hoursSuffix = t(`${P}.unit.hours`);

  const drawerDescriptionColumns = useMemo(() => {
    if (!currentEquipment) return descriptionColumns;

    return descriptionColumns.map((col) => {
      const dataIndex = col.dataIndex as string | undefined;
      if (dataIndex === 'runtime_hours') {
        return { ...col, hide: !hasMetric(currentEquipment.runtime_hours) };
      }
      if (dataIndex === 'temperature') {
        return { ...col, hide: !hasMetric(currentEquipment.temperature) };
      }
      if (dataIndex === 'pressure') {
        return { ...col, hide: !hasMetric(currentEquipment.pressure) };
      }
      if (dataIndex === 'vibration') {
        return { ...col, hide: !hasMetric(currentEquipment.vibration) };
      }
      if (dataIndex === 'last_maintenance_date') {
        return { ...col, hide: !currentEquipment.last_maintenance_date };
      }
      if (dataIndex === 'next_maintenance_date') {
        return { ...col, hide: !currentEquipment.next_maintenance_date };
      }
      if (dataIndex === 'monitored_at') {
        return { ...col, hide: !currentEquipment.monitored_at };
      }
      return col;
    });
  }, [descriptionColumns, currentEquipment]);

  return (
    <ListPageTemplate>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t(`${P}.title`)}
        </Typography.Title>
        <Space>
          <Button
            icon={autoRefresh ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? t(`${P}.pauseAutoRefresh`) : t(`${P}.startAutoRefresh`)}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchStatusList} loading={loading}>
            {t(`${P}.refresh`)}
          </Button>
        </Space>
      </div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ color: '#999' }}>{t(`${P}.stat.total`)}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.online}</div>
              <div style={{ color: '#999' }}>{t(`${P}.stat.online`)}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.offline}</div>
              <div style={{ color: '#999' }}>{t(`${P}.stat.offline`)}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.running}</div>
              <div style={{ color: '#999' }}>{t(`${P}.stat.running`)}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.maintenance}</div>
              <div style={{ color: '#999' }}>{t(`${P}.stat.maintenance`)}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.fault}</div>
              <div style={{ color: '#999' }}>{t(`${P}.stat.fault`)}</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Space>
              <span>{t(`${P}.filter.status`)}</span>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
              >
                <Option value="all">{t(`${P}.filter.all`)}</Option>
                <Option value="正常">{t(`${P}.status.normal`)}</Option>
                <Option value="运行中">{t(`${P}.status.running`)}</Option>
                <Option value="待机">{t(`${P}.status.standby`)}</Option>
                <Option value="维修中">{t(`${P}.status.maintenance`)}</Option>
                <Option value="故障">{t(`${P}.status.fault`)}</Option>
                <Option value="停用">{t(`${P}.status.disabled`)}</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Space>
              <span>{t(`${P}.filter.onlineStatus`)}</span>
              <Select
                value={onlineFilter}
                onChange={setOnlineFilter}
                style={{ width: 120 }}
              >
                <Option value="all">{t(`${P}.filter.all`)}</Option>
                <Option value="online">{t(`${P}.filter.online`)}</Option>
                <Option value="offline">{t(`${P}.filter.offline`)}</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Search
              placeholder={t(`${P}.searchPlaceholder`)}
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
                  {t(`${P}.action.history`)}
                </Button>,
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleUpdateStatus(item)}
                >
                  {t(`${P}.action.update`)}
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
                        text={item.is_online ? t(`${P}.online`) : t(`${P}.offline`)}
                      />
                    </div>
                    {hasMetric(item.runtime_hours) && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {t(`${P}.runtimeHours`, { value: formatMetric(item.runtime_hours, 1, hoursSuffix) })}
                      </div>
                    )}
                    {hasMetric(item.temperature) && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {t(`${P}.temperature`, { value: formatMetric(item.temperature, 1, '°C') })}
                      </div>
                    )}
                    {item.monitored_at && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {t(`${P}.updatedAt`, { time: formatDateTime(item.monitored_at, 'HH:mm:ss') })}
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
          {t(`${P}.empty`)}
        </Card>
      )}

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={detailVisible}
        zIndex={equipmentStatusDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setCurrentEquipment(null);
          setHistoryList([]);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        customContent={
          currentEquipment ? (
            <>
              <DetailDrawerSection title={t(`${P}.section.lifecycle`)}>
                {currentEquipment.equipment?.id != null ? (
                  <DetailDrawerInlineFullChain
                    documentType="equipment"
                    documentId={currentEquipment.equipment.id}
                    active={detailVisible}
                    selfDocumentId={currentEquipment.equipment.id}
                    renderBriefActions={(doc) => (
                      <EquipmentTraceBriefPrimaryActions
                        doc={doc}
                        t={t}
                        navigate={navigate}
                        closeDrawer={() => {
                          setDetailVisible(false);
                          setCurrentEquipment(null);
                          setHistoryList([]);
                        }}
                      />
                    )}
                  />
                ) : null}
              </DetailDrawerSection>
              <DetailDrawerSection title={t(`${P}.section.realtimeMonitor`)}>
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
                        text={currentEquipment.is_online ? t(`${P}.online`) : t(`${P}.offline`)}
                      />
                    ),
                    runtime_hours: formatMetric(currentEquipment.runtime_hours, 2, hoursSuffix),
                    temperature: formatMetric(currentEquipment.temperature, 1, '°C'),
                    pressure: formatMetric(currentEquipment.pressure, 2),
                    vibration: formatMetric(currentEquipment.vibration, 2),
                    last_maintenance_date: currentEquipment.last_maintenance_date
                      ? formatDateTime(currentEquipment.last_maintenance_date, 'YYYY-MM-DD')
                      : undefined,
                    next_maintenance_date: currentEquipment.next_maintenance_date
                      ? formatDateTime(currentEquipment.next_maintenance_date, 'YYYY-MM-DD')
                      : undefined,
                    monitored_at: currentEquipment.monitored_at
                      ? formatDateTime(currentEquipment.monitored_at, 'YYYY-MM-DD HH:mm:ss')
                      : undefined,
                  }}
                  columns={drawerDescriptionColumns}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t(`${P}.section.statusHistory`)}>
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
                            <Tag color={getStatusColor(history.to_status)}>{translateStatus(history.to_status)}</Tag>
                            {history.from_status && (
                              <>
                                <span style={{ margin: '0 8px' }}>←</span>
                                <Tag>{translateStatus(history.from_status)}</Tag>
                              </>
                            )}
                          </div>
                          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                            {formatDateTime(history.status_changed_at, 'YYYY-MM-DD HH:mm:ss')}
                            {history.changed_by_name && ` · ${history.changed_by_name}`}
                          </div>
                          {history.reason && (
                            <div style={{ marginTop: 4, color: '#666' }}>
                              {t(`${P}.history.reason`, { reason: history.reason })}
                            </div>
                          )}
                          {history.remark && (
                            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                              {t(`${P}.history.remark`, { remark: history.remark })}
                            </div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t(`${P}.section.operationHistory`)}>
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.empty.noOperationRecords`)} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 状态更新Modal */}
      <FormModalTemplate
        title={t(`${P}.updateModal`)}
        open={updateModalVisible}
        onClose={() => setUpdateModalVisible(false)}
        formRef={updateFormRef}
        onFinish={handleUpdateStatusSubmit}
        layout="vertical"
      >
        <ProFormSelect
          name="status"
          label={t(`${P}.form.status`)}
          options={statusFormOptions}
          rules={[{ required: true, message: t(`${P}.form.selectStatus`) }]}
        />
        <ProFormSelect
          name="is_online"
          label={t(`${P}.form.onlineStatus`)}
          options={[
            { label: t(`${P}.online`), value: true },
            { label: t(`${P}.offline`), value: false },
          ]}
        />
        <ProFormTextArea
          name="reason"
          label={t(`${P}.form.changeReason`)}
          placeholder={t(`${P}.form.changeReasonPlaceholder`)}
        />
        <DocumentAttachmentsField category="equipment_status_attachments" />
        <ProFormTextArea
          name="remark"
          label={t(`${P}.form.remark`)}
          placeholder={t(`${P}.form.remarkPlaceholder`)}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default EquipmentStatusPage;
