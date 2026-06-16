/**
 * 交期延期异常处理页面
 *
 * 提供交期延期异常处理功能，包括延期预警、原因分析、处理建议等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space } from 'antd';
import { EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, ToolOutlined, CloseCircleOutlined, UserAddOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';

const P = 'app.kuaizhizao.productionException';

/**
 * 延期异常接口定义
 */
interface DeliveryDelayException {
  id?: number;
  work_order_id?: number;
  work_order_code?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  delay_days?: number;
  delay_reason?: string;
  alert_level?: string;
  status?: string;
  suggested_action?: string;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
  created_at?: string;
}

/**
 * 延期异常处理页面组件
 */
const DeliveryDelayExceptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<DeliveryDelayException | null>(null);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const handleFormRef = useRef<any>(null);

  const alertLevelLabel = useCallback(
    (level?: string) => {
      const map: Record<string, string> = {
        critical: t(`${P}.alertLevel.critical`),
        high: t(`${P}.alertLevel.high`),
        medium: t(`${P}.alertLevel.medium`),
        low: t(`${P}.alertLevel.low`),
      };
      return level ? (map[level] ?? level) : '-';
    },
    [t],
  );

  const statusLabel = useCallback(
    (status?: string) => {
      const map: Record<string, string> = {
        pending: t(`${P}.status.pending`),
        processing: t(`${P}.status.processing`),
        resolved: t(`${P}.status.resolved`),
        cancelled: t(`${P}.status.cancelled`),
      };
      return status ? (map[status] ?? status) : '-';
    },
    [t],
  );

  const suggestedActionLabel = useCallback(
    (action?: string) => {
      const map: Record<string, string> = {
        adjust_plan: t(`${P}.suggestedAction.adjustPlan`),
        increase_resources: t(`${P}.suggestedAction.increaseResources`),
        expedite: t(`${P}.suggestedAction.expedite`),
      };
      return action ? (map[action] ?? '-') : '-';
    },
    [t],
  );

  const handleModalTitle = useMemo(() => {
    const map: Record<string, string> = {
      adjust_plan: t(`${P}.deliveryDelay.modal.handleAdjustPlan`),
      increase_resources: t(`${P}.deliveryDelay.modal.handleIncreaseResources`),
      expedite: t(`${P}.deliveryDelay.modal.handleExpedite`),
      resolve: t(`${P}.deliveryDelay.modal.handleResolve`),
      cancel: t(`${P}.deliveryDelay.modal.handleCancel`),
    };
    return map[currentAction] ?? t(`${P}.deliveryDelay.modal.handleDefault`);
  }, [currentAction, t]);

  const handleDetail = async (record: DeliveryDelayException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  const openHandleModal = (record: DeliveryDelayException, action: string) => {
    setCurrentRecord(record);
    setCurrentAction(action);
    setHandleModalVisible(true);
    setTimeout(() => {
      handleFormRef.current?.resetFields();
    }, 100);
  };

  const handleException = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.recordNotFound`));
      }

      const params: any = {
        action: currentAction,
      };

      if (values.remarks) {
        params.remarks = values.remarks;
      }

      const handled = await apiRequest<{
        scheduling_deep_link?: string;
        scheduling_notice?: string;
      }>(`/apps/kuaizhizao/exceptions/delivery-delay/${currentRecord.id}/handle`, {
        method: 'POST',
        params,
      });
      if (handled?.scheduling_deep_link) {
        messageApi.success(
          <span>
            {handled.scheduling_notice || t(`${P}.message.handleSuccess`)}，
            <a href={handled.scheduling_deep_link}>{t(`${P}.message.goToVisualScheduling`)}</a>
          </span>
        );
      } else {
        messageApi.success(t(`${P}.message.handleSuccess`));
      }
      setHandleModalVisible(false);
      setCurrentRecord(null);
      setCurrentAction('');
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t(`${P}.message.handleFailed`));
      throw error;
    }
  };

  const columns: ProColumns<DeliveryDelayException>[] = useMemo(() => [
    {
      title: t(`${P}.col.workOrderCode`),
      dataIndex: 'work_order_code',
      width: 140,
      fixed: 'left',
    },
    {
      title: t(`${P}.col.plannedEndDate`),
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t(`${P}.col.delayDays`),
      dataIndex: 'delay_days',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {t(`${P}.label.daysUnit`, { count: record.delay_days ?? 0 })}
        </span>
      ),
    },
    {
      title: t(`${P}.col.delayReason`),
      dataIndex: 'delay_reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: t(`${P}.col.alertLevel`),
      dataIndex: 'alert_level',
      width: 100,
      valueEnum: {
        low: { text: t(`${P}.alertLevel.low`), status: 'default' },
        medium: { text: t(`${P}.alertLevel.medium`), status: 'warning' },
        high: { text: t(`${P}.alertLevel.high`), status: 'error' },
        critical: { text: t(`${P}.alertLevel.critical`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: t(`${P}.status.pending`), status: 'default' },
        processing: { text: t(`${P}.status.processing`), status: 'processing' },
        resolved: { text: t(`${P}.status.resolved`), status: 'success' },
        cancelled: { text: t(`${P}.status.cancelled`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.suggestedAction`),
      dataIndex: 'suggested_action',
      width: 120,
      valueEnum: {
        adjust_plan: { text: t(`${P}.suggestedAction.adjustPlan`), status: 'default' },
        increase_resources: { text: t(`${P}.suggestedAction.increaseResources`), status: 'processing' },
        expedite: { text: t(`${P}.suggestedAction.expedite`), status: 'error' },
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.actions'),
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            {t('common.detail')}
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<ToolOutlined />}
                onClick={() => openHandleModal(record, 'adjust_plan')}
              >
                {t(`${P}.action.adjustPlan`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => openHandleModal(record, 'increase_resources')}
              >
                {t(`${P}.action.increaseResources`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<ClockCircleOutlined />}
                onClick={() => openHandleModal(record, 'expedite')}
              >
                {t(`${P}.action.expedite`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openHandleModal(record, 'resolve')}
              >
                {t(`${P}.action.resolve`)}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => openHandleModal(record, 'cancel')}
                danger
              >
                {t(`${P}.action.cancel`)}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ], [t]);

  return (
    <ListPageTemplate>
      <UniTable
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.delivery-delay-exceptions"
        headerTitle={t(`${P}.deliveryDelay.pageTitle`)}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/apps/kuaizhizao/exceptions/delivery-delay', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                alert_level: params.alert_level,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch {
            messageApi.error(t(`${P}.message.fetchListFailed`));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showAdvancedSearch={true}
      />

      <DetailDrawerTemplate
        title={t(`${P}.deliveryDelay.detailTitle`, { code: currentRecord?.work_order_code || '' })}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code}</p>
              <p><strong>{t(`${P}.col.plannedEndDate`)}:</strong> {currentRecord.planned_end_date}</p>
              {currentRecord.actual_end_date && (
                <p><strong>{t(`${P}.field.actualEndDate`)}:</strong> {currentRecord.actual_end_date}</p>
              )}
              <p><strong>{t(`${P}.col.delayDays`)}:</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {t(`${P}.label.daysUnit`, { count: currentRecord.delay_days ?? 0 })}
                </span>
              </p>
              <p><strong>{t(`${P}.col.delayReason`)}:</strong> {currentRecord.delay_reason || '-'}</p>
              <p><strong>{t(`${P}.col.alertLevel`)}:</strong>
                <Tag color={
                  currentRecord.alert_level === 'critical' ? 'red' :
                    currentRecord.alert_level === 'high' ? 'orange' :
                      currentRecord.alert_level === 'medium' ? 'gold' : 'default'
                }>
                  {alertLevelLabel(currentRecord.alert_level)}
                </Tag>
              </p>
              <p><strong>{t(`${P}.col.status`)}:</strong>
                <Tag color={
                  currentRecord.status === 'resolved' ? 'success' :
                    currentRecord.status === 'processing' ? 'processing' :
                      currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {statusLabel(currentRecord.status)}
                </Tag>
              </p>
              <p><strong>{t(`${P}.col.suggestedAction`)}:</strong> {suggestedActionLabel(currentRecord.suggested_action)}</p>
              {currentRecord.handled_by_name && (
                <>
                  <p><strong>{t(`${P}.field.handler`)}:</strong> {currentRecord.handled_by_name}</p>
                  <p><strong>{t(`${P}.field.handledAt`)}:</strong> {currentRecord.handled_at}</p>
                </>
              )}
              {currentRecord.remarks && (
                <p><strong>{t(`${P}.field.remarks`)}:</strong> {currentRecord.remarks}</p>
              )}
            </div>
          ) : null
        }
      />

      <FormModalTemplate
        title={handleModalTitle}
        open={handleModalVisible}
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentRecord(null);
          setCurrentAction('');
          handleFormRef.current?.resetFields();
        }}
        onFinish={handleException}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={handleFormRef}
      >
        {currentRecord && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code}</p>
              <p><strong>{t(`${P}.col.plannedEndDate`)}:</strong> {currentRecord.planned_end_date}</p>
              <p><strong>{t(`${P}.col.delayDays`)}:</strong>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {t(`${P}.label.daysUnit`, { count: currentRecord.delay_days ?? 0 })}
                </span>
              </p>
              <p><strong>{t(`${P}.col.delayReason`)}:</strong> {currentRecord.delay_reason || '-'}</p>
            </div>
            <ProFormTextArea
              name="remarks"
              label={t(`${P}.field.remarks`)}
              placeholder={t(`${P}.placeholder.handleRemarksOptional`)}
              fieldProps={{
                rows: 4,
              }}
            />
          </>
        )}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default DeliveryDelayExceptionsPage;
