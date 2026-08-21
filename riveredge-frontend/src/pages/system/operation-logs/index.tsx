/**
 * 操作日志页面
 * 
 * 用于查看和管理系统操作日志。
 * 支持多维度查询、统计等功能。
 *
 * @author Luigi Lu
 * @date 2025-01-11
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, type ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag, Typography } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemTypeMarker } from '../utils/systemListPresentation';
import { EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { StatCardTrendArea } from '../../../components/common/StatCardTrendArea';
import { ListPageTemplate } from '../../../components/layout-templates';
import { SystemMasterDetailDrawer } from '../shared/systemMasterDetailDrawer';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import { useListPageStatCardsVisible } from '../../../components/layout-templates/listPageStatCardsContext';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import {
  getOperationLogs,
  getOperationLogStats,
  getOperationLogByUuid,
  OperationLog,
  OperationLogListResponse,
  OperationLogStats,
} from '../../../services/operationLog';
import { useGlobalStore } from '../../../stores';
import { CODE_FONT_FAMILY } from '../../../constants/fonts';
import dayjs from 'dayjs';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../utils/format';
import { downloadRecordsAsXlsx } from '../../../utils/exportRecordsXlsx';

/**
 * 操作日志页面组件
 */
const OperationLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const statCardsVisible = useListPageStatCardsVisible();
  const actionRef = useRef<ActionType>(null);
  const [stats, setStats] = useState<OperationLogStats | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState<OperationLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  /**
   * 加载统计信息
   */
  const loadStats = React.useCallback(async () => {
    // 检查 currentUser，确保在调用 API 前用户已登录
    if (!currentUser || !statCardsVisible) {
      return;
    }
    
    try {
      const data = await getOperationLogStats();
      setStats(data);
    } catch (error: any) {
      // 如果是 401 错误，不显示错误消息（可能是用户未登录）
      if (error?.response?.status !== 401) {
        messageApi.error(error.message || t('pages.system.operationLogs.loadStatsFailed'));
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
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const logDetail = await getOperationLogByUuid(uuid);
      setCurrentLog(logDetail);
    } catch (error) {
      setCurrentLog(null);
      setDetailError(getApiErrorMessage(error, t('pages.system.operationLogs.loadDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetail = async (record: OperationLog) => {
    detailRetryUuidRef.current = record.uuid;
    setDetailDrawerVisible(true);
    setCurrentLog(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 操作类型标签
   */
  const getOperationTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      create: { color: 'success', text: t('pages.system.operationLogs.typeCreate') },
      update: { color: 'processing', text: t('pages.system.operationLogs.typeUpdate') },
      delete: { color: 'error', text: t('common.delete') },
      view: { color: 'default', text: t('common.view') },
      error: { color: 'error', text: t('pages.system.operationLogs.typeError') },
      unknown: { color: 'default', text: t('pages.system.operationLogs.typeUnknown') },
    };
    const typeInfo = typeMap[type] || { color: 'default', text: type };
    return renderSystemTypeMarker(typeInfo.text, typeInfo.color);
  };

  /**
   * 格式化操作模块名称（与侧栏应用名唯一来源一致：应用根使用 locale app.${code}.name）
   */
  const formatModuleName = (module: string | undefined): string => {
    if (!module) return '-';
    if (module === 'apps/master-data') return t('app.master-data.name');
    const moduleMap: Record<string, string> = {
      'apps/master-data/factory': t('pages.system.operationLogs.moduleFactory'),
      'apps/master-data/warehouse': t('pages.system.operationLogs.moduleWarehouse'),
      'apps/master-data/material': t('pages.system.operationLogs.moduleMaterial'),
      'apps/master-data/product': t('pages.system.operationLogs.moduleProduct'),
      'apps/master-data/customer': t('pages.system.operationLogs.moduleCustomer'),
      'apps/master-data/supplier': t('pages.system.operationLogs.moduleSupplier'),
      'apps/master-data/process': t('pages.system.operationLogs.moduleProcess'),
      'apps/master-data/performance': t('pages.system.operationLogs.modulePerformance'),
      'core': t('pages.system.operationLogs.moduleCore'),
      'infra': t('pages.system.operationLogs.moduleInfra'),
    };
    return moduleMap[module] || module;
  };

  /**
   * 格式化操作内容（使其更友好）
   */
  const formatOperationContent = (content: string | undefined, objectType: string | undefined): string => {
    if (content) return content;
    if (!objectType) return '-';
    return t('pages.system.operationLogs.operationContentDefault', { objectType });
  };

  /**
   * 获取用户显示名称
   */
  const getUserDisplayName = (record: OperationLog): string => {
    if (record.user_full_name) return record.user_full_name;
    if (record.username) return record.username;
    return t('pages.system.operationLogs.userDisplay', { id: record.user_id });
  };

  /**
   * 详情列定义（优化：突出有用信息，技术性字段放在后面）
   */
  const detailColumns: ProDescriptionsItemProps<OperationLog>[] = [
    { title: t('pages.system.operationLogs.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.operationLogs.operationType'), dataIndex: 'operation_type', render: (_: React.ReactNode, record: OperationLog) => getOperationTypeTag(record.operation_type) },
    { title: t('pages.system.operationLogs.operationModule'), dataIndex: 'operation_module', render: (_: React.ReactNode, record: OperationLog) => formatModuleName(record.operation_module) },
    { title: t('pages.system.operationLogs.operationObjectType'), dataIndex: 'operation_object_type', render: (_: React.ReactNode, record: OperationLog) => record.operation_object_type || '-' },
    { title: t('pages.system.operationLogs.operationContent'), dataIndex: 'operation_content', span: 2, render: (_: React.ReactNode, record: OperationLog) => (<div style={{ wordBreak: 'break-word' }}>{formatOperationContent(record.operation_content, record.operation_object_type)}</div>) },
    { title: t('pages.system.operationLogs.operator'), dataIndex: 'user_id', render: (_: React.ReactNode, record: OperationLog) => getUserDisplayName(record) },
    { title: t('pages.system.operationLogs.ipAddress'), dataIndex: 'ip_address', render: (_: React.ReactNode, record: OperationLog) => record.ip_address || '-' },
    { title: t('pages.system.operationLogs.requestMethod'), dataIndex: 'request_method', render: (_: React.ReactNode, record: OperationLog) => record.request_method || '-' },
    { title: t('pages.system.operationLogs.requestPath'), dataIndex: 'request_path', span: 2, render: (_: React.ReactNode, record: OperationLog) => (<div style={{ wordBreak: 'break-word', fontFamily: CODE_FONT_FAMILY, fontSize: '12px' }}>{record.request_path || '-'}</div>) },
    { title: t('pages.system.operationLogs.userAgent'), dataIndex: 'user_agent', span: 2, render: (_: React.ReactNode, record: OperationLog) => (<div style={{ wordBreak: 'break-word', maxHeight: '100px', overflow: 'auto', fontSize: '12px', color: '#666' }}>{record.user_agent || '-'}</div>) },
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

  const statCards = [
    { 
      title: t('pages.system.operationLogs.statTotal'), 
      value: (
        <span>
          {stats?.total || 0}
        </span>
      ),
      valueStyle: { color: '#1890ff' },
      backgroundChart:
        stats?.trend_data?.length ? (
          <StatCardTrendArea data={stats.trend_data} color="#1890ff" />
        ) : undefined,
    },
    {
      title: t('pages.system.operationLogs.statToday', '今日新增'),
      value: (
        <span>
          {stats?.today_total || 0}
        </span>
      ),
      description: stats?.today_total !== undefined && stats?.yesterday_total !== undefined ? (
        <div>
          {renderDOD(stats.today_total, stats.yesterday_total)}
        </div>
      ) : undefined,
      valueStyle: { color: '#cf1322' },
    },
    {
      title: t('pages.system.operationLogs.statByType'),
      value: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {Object.entries(stats?.by_type || {}).map(([type, count]) => {
            const typeMap: Record<string, { color: string; text: string }> = {
              create: { color: 'success', text: t('pages.system.operationLogs.typeCreate') },
              update: { color: 'processing', text: t('pages.system.operationLogs.typeUpdate') },
              delete: { color: 'error', text: t('common.delete') },
              view: { color: 'default', text: t('common.view') },
              error: { color: 'error', text: t('pages.system.operationLogs.typeError') },
              unknown: { color: 'default', text: t('pages.system.operationLogs.typeUnknown') },
            };
            const typeInfo = typeMap[type] || { color: 'default', text: type };
            return <Tag key={type} color={typeInfo.color}>{typeInfo.text}: {count as React.ReactNode}</Tag>;
          })}
          {Object.keys(stats?.by_type || {}).length === 0 && <span style={{ color: '#999' }}>-</span>}
        </div>
      ),
    },
  ];

  /**
   * 表格列定义（优化：突出对用户有用的信息）
   */
  const columns = useMemo<ProColumns<OperationLog>[]>(() => alignProColumns([
    {
      title: t('pages.system.operationLogs.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTimeRange',
      sorter: true,
      render: (_: any, record: OperationLog) => formatDateTimeBySiteSetting(record.created_at),
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'left',
    },
    {
      title: t('pages.system.operationLogs.operationType'),
      dataIndex: 'operation_type',
      key: 'operation_type',
      valueType: 'select',
      valueEnum: {
        create: { text: t('pages.system.operationLogs.typeCreate') },
        update: { text: t('pages.system.operationLogs.typeUpdate') },
        delete: { text: t('common.delete') },
        view: { text: t('common.view') },
        error: { text: t('pages.system.operationLogs.typeError') },
        unknown: { text: t('pages.system.operationLogs.typeUnknown') },
      },
      render: (_: any, record: OperationLog) => getOperationTypeTag(record.operation_type),
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('pages.system.operationLogs.operationModule'),
      dataIndex: 'operation_module',
      key: 'operation_module',
      ellipsis: true,
      width: 120,
      render: (_: React.ReactNode, record: OperationLog) => formatModuleName(record.operation_module),
    },
    {
      title: t('pages.system.operationLogs.operationObject'),
      dataIndex: 'operation_object_type',
      key: 'operation_object_type',
      ellipsis: true,
      width: 120,
      render: (_: React.ReactNode, record: OperationLog) => record.operation_object_type || '-',
    },
    {
      title: t('pages.system.operationLogs.operationContent'),
      dataIndex: 'operation_content',
      key: 'operation_content',
      ellipsis: true,
      search: false,
      width: 250,
      render: (_: React.ReactNode, record: OperationLog) => formatOperationContent(record.operation_content, record.operation_object_type),
    },
    {
      title: t('pages.system.operationLogs.operator'),
      dataIndex: 'user_id',
      key: 'user_id',
      valueType: 'digit',
      width: 120,
      render: (_: any, record: OperationLog) => getUserDisplayName(record),
    },
    {
      title: t('pages.system.operationLogs.ipAddress'),
      dataIndex: 'ip_address',
      key: 'ip_address',
      ellipsis: true,
      search: false,
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInTable: true,
    },
    {
      title: t('pages.system.operationLogs.requestMethod'),
      dataIndex: 'request_method',
      key: 'request_method',
      valueType: 'select',
      valueEnum: { GET: { text: 'GET' }, POST: { text: 'POST' }, PUT: { text: 'PUT' }, PATCH: { text: 'PATCH' }, DELETE: { text: 'DELETE' } },
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInTable: true,
    },
    {
      title: t('pages.system.operationLogs.requestPath'),
      dataIndex: 'request_path',
      key: 'request_path',
      ellipsis: true,
      search: false,
      width: 200,
      hideInTable: true,
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t]);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<OperationLog>
          columnPersistenceId="pages.system.operation-logs.list-v1"
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
              const response = await getOperationLogs({
                page: current || 1,
                page_size: pageSize || 20,
                operation_type: searchParams.operation_type as string | undefined,
                operation_module: searchParams.operation_module as string | undefined,
                operation_object_type: searchParams.operation_object_type as string | undefined,
                user_id: searchParams.user_id ? Number(searchParams.user_id) : undefined,
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
              messageApi.error(error.message || t('pages.system.operationLogs.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          enableRowSelection
          showAdvancedSearch={true}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getOperationLogs({ page: 1, page_size: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `operation-logs-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('pages.system.operationLogs.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          toolBarRender={() => [
            <Button key="refresh" onClick={() => { loadStats(); actionRef.current?.reload(); }}>
              <BarChartOutlined /> {t('pages.system.operationLogs.refreshStats')}
            </Button>,
          ]}
          headerTitle={t('pages.system.operationLogs.headerTitle')}
          onDetail={async (keys: React.Key[]) => {
            if (keys.length === 1) {
              const uuid = String(keys[0]);
              detailRetryUuidRef.current = uuid;
              setDetailDrawerVisible(true);
              setCurrentLog(null);
              setDetailError(null);
              void loadDetail(uuid);
            }
          }}
        />
      </ListPageTemplate>

      <SystemMasterDetailDrawer
        title={t('pages.system.operationLogs.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentLog(null);
          setDetailError(null);
        }}
        detail={currentLog}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
      />
    </>
  );
};

export default OperationLogsPage;
