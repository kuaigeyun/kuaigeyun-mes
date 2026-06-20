/**
 * 登录日志页面
 * 
 * 用于查看和管理系统登录日志。
 * 支持多维度查询、统计等功能。
 *
 * @author Luigi Lu
 * @date 2025-01-11
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, Space, Drawer, Typography, Descriptions, App, Button } from 'antd';
import { EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { StatCardTrendArea } from '../../../components/common/StatCardTrendArea';
import { ListPageTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import { useListPageStatCardsVisible } from '../../../components/layout-templates/listPageStatCardsContext';
import { UniDetail, detailDrawerDescriptionItems } from '../../../components/uni-detail';
import {
  getLoginLogs,
  getLoginLogStats,
  LoginLog,
  LoginLogListResponse,
  LoginLogStats,
} from '../../../services/loginLog';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';
import { formatDateTimeBySiteSetting } from '../../../utils/format';

/**
 * 登录日志页面组件
 */
const LoginLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const statCardsVisible = useListPageStatCardsVisible();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<LoginLogStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState<LoginLog | null>(null);

  /**
   * 加载统计信息
   */
  const loadStats = React.useCallback(async () => {
    // 检查 currentUser，确保在调用 API 前用户已登录
    if (!currentUser || !statCardsVisible) {
      return;
    }
    
    try {
      const data = await getLoginLogStats();
      setStats(data);
    } catch (error: any) {
      // 如果是 401 错误，不显示错误消息（可能是用户未登录）
      if (error?.response?.status !== 401) {
        messageApi.error(error.message || t('pages.system.loginLogs.loadStatsFailed'));
      }
    }
  }, [currentUser, messageApi, statCardsVisible]);

  useEffect(() => {
    // 只有在用户已登录（currentUser 存在）时才加载统计数据
    if (currentUser && statCardsVisible) {
      loadStats();
    }
  }, [currentUser, loadStats, statCardsVisible]);

  /**
   * 查看日志详情
   */
  const handleViewDetail = (record: LoginLog) => {
    setCurrentLog(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 登录状态标签
   */
  const getLoginStatusTag = (status: string) => {
    if (status === 'success') {
      return <Tag color="success">{t('pages.system.loginLogs.statusSuccess')}</Tag>;
    } else if (status === 'failed') {
      return <Tag color="error">{t('pages.system.loginLogs.statusFailed')}</Tag>;
    } else {
      return <Tag>{status}</Tag>;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns = [
    {
      title: 'UUID',
      dataIndex: 'uuid',
      render: (_: unknown, record: LoginLog) => record.uuid,
    },
    {
      title: t('pages.system.loginLogs.username'),
      dataIndex: 'username',
      render: (_: unknown, record: LoginLog) => record.username || '-',
    },
    {
      title: t('pages.system.loginLogs.userId'),
      dataIndex: 'user_id',
      render: (_: unknown, record: LoginLog) => record.user_id || '-',
    },
    {
      title: t('pages.system.loginLogs.tenantId'),
      dataIndex: 'tenant_id',
      render: (_: unknown, record: LoginLog) => record.tenant_id || '-',
    },
    {
      title: t('pages.system.loginLogs.loginIp'),
      dataIndex: 'login_ip',
      render: (_: unknown, record: LoginLog) => record.login_ip || '-',
    },
    {
      title: t('pages.system.loginLogs.loginLocation'),
      dataIndex: 'login_location',
      render: (_: unknown, record: LoginLog) => record.login_location || '-',
    },
    {
      title: t('pages.system.loginLogs.loginDevice'),
      dataIndex: 'login_device',
      render: (_: unknown, record: LoginLog) => record.login_device || '-',
    },
    {
      title: t('pages.system.loginLogs.loginBrowser'),
      dataIndex: 'login_browser',
      render: (_: unknown, record: LoginLog) => record.login_browser || '-',
    },
    {
      title: t('pages.system.loginLogs.loginStatus'),
      dataIndex: 'login_status',
      render: (_: unknown, record: LoginLog) => getLoginStatusTag(record.login_status),
    },
    {
      title: t('pages.system.loginLogs.failureReason'),
      dataIndex: 'failure_reason',
      render: (_: unknown, record: LoginLog) => record.failure_reason || '-',
    },
    {
      title: t('pages.system.loginLogs.loginTime'),
      dataIndex: 'created_at',
      render: (_: unknown, record: LoginLog) => formatDateTimeBySiteSetting(record.created_at),
    },
  ];

  const renderDOD = (today?: number, yesterday?: number) => {
    if (today === undefined || yesterday === undefined) return null;
    const diff = today - yesterday;
    const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
    const icon = diff > 0 ? '↑' : diff < 0 ? '↓' : '';
    return (
      <span style={{ marginLeft: 8, fontSize: 13, color }}>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>较昨日</span> {icon} {Math.abs(diff)}
      </span>
    );
  };

  // 构建统计卡片数据，始终返回卡片结构，避免数据加载前后产生的布局抖动
  const statCards = [
    {
      title: t('pages.system.loginLogs.statTotal'),
      value: stats?.total || 0,
      description: stats?.today_total !== undefined ? (
        <div>
          今日: {stats.today_total} {renderDOD(stats.today_total, stats.yesterday_total)}
        </div>
      ) : undefined,
      valueStyle: { color: '#1890ff' },
      backgroundChart:
        stats?.trend_data?.length ? (
          <StatCardTrendArea data={stats.trend_data} color="#1890ff" />
        ) : undefined,
    },
    {
      title: t('pages.system.loginLogs.statSuccess'),
      value: stats?.success_count || 0,
      valueStyle: { color: '#52c41a' },
    },
    {
      title: t('pages.system.loginLogs.statFailed'),
      value: stats?.failed_count || 0,
      valueStyle: { color: '#ff4d4f' },
    },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<LoginLog>[] = [
    {
      title: t('pages.system.loginLogs.username'),
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      width: 150,
    },
    {
      title: t('pages.system.loginLogs.loginIp'),
      dataIndex: 'login_ip',
      key: 'login_ip',
      ellipsis: true,
      width: 120,
    },
    {
      title: t('pages.system.loginLogs.loginLocation'),
      dataIndex: 'login_location',
      key: 'login_location',
      ellipsis: true,
      search: false,
      width: 150,
    },
    {
      title: t('pages.system.loginLogs.loginDevice'),
      dataIndex: 'login_device',
      key: 'login_device',
      ellipsis: true,
      search: false,
      width: 120,
    },
    {
      title: t('pages.system.loginLogs.loginBrowser'),
      dataIndex: 'login_browser',
      key: 'login_browser',
      ellipsis: true,
      search: false,
      width: 150,
    },
    {
      title: t('pages.system.loginLogs.loginStatus'),
      dataIndex: 'login_status',
      key: 'login_status',
      valueType: 'select',
      valueEnum: {
        success: { text: t('pages.system.loginLogs.statusSuccess') },
        failed: { text: t('pages.system.loginLogs.statusFailed') },
      },
      width: 100,
      render: (_: any, record: LoginLog) => getLoginStatusTag(record.login_status),
    },
    {
      title: t('pages.system.loginLogs.failureReason'),
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      ellipsis: true,
      search: false,
      width: 200,
      render: (_: unknown, record: LoginLog) => record.failure_reason || '-',
    },
    {
      title: t('pages.system.loginLogs.loginTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTimeRange',
      sorter: true,
      render: (_: any, record: LoginLog) => formatDateTimeBySiteSetting(record.created_at),
      width: 180,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<LoginLog>
          columnPersistenceId="pages.system.login-logs"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 检查 currentUser，如果用户未登录则直接返回空数据
            if (!currentUser) {
              return {
                data: [],
                success: true,
                total: 0,
              };
            }
            
            // 从 params 和 searchFormValues 中获取搜索参数
            const { current, pageSize } = params;
            const searchParams = searchFormValues || {};
            
            // 处理时间范围（从 searchParams 中获取）
            let start_time: string | undefined;
            let end_time: string | undefined;
            if (searchParams.created_at && Array.isArray(searchParams.created_at) && searchParams.created_at.length === 2) {
              start_time = dayjs(searchParams.created_at[0]).toISOString();
              end_time = dayjs(searchParams.created_at[1]).toISOString();
            }
            
            try {
              const response = await getLoginLogs({
                page: current || 1,
                page_size: pageSize || 20,
                login_status: searchParams.login_status as string | undefined,
                username: searchParams.username as string | undefined,
                user_id: searchParams.user_id ? Number(searchParams.user_id) : undefined,
                login_ip: searchParams.login_ip as string | undefined,
                start_time,
                end_time,
              });
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              // 如果是 401 错误，返回空数据而不是抛出错误
              if (error?.response?.status === 401) {
                return {
                  data: [],
                  success: true,
                  total: 0,
                };
              }
              messageApi.error(error.message || t('pages.system.loginLogs.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getLoginLogs({ page: 1, page_size: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('pages.system.loginLogs.noDataExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `login-logs-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.loginLogs.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.loginLogs.exportFailed'));
            }
          }}
          toolBarRender={() => [
            <Button key="refresh" onClick={() => {
              loadStats();
              actionRef.current?.reload();
            }}>
              <BarChartOutlined /> {t('pages.system.loginLogs.refreshStats')}
            </Button>,
          ]}
          headerTitle={t('pages.system.loginLogs.headerTitle')}
        />
      </ListPageTemplate>

      {/* 日志详情 Drawer */}
      <UniDetail
        title={t('pages.system.loginLogs.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentLog(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        basic={currentLog ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, currentLog)} />
          ) : null}
      />
    </>
  );
};

export default LoginLogsPage;
