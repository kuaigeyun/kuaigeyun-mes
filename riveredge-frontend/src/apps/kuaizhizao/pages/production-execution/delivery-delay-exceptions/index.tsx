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
import { App, Button } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { DeliveryDelayExceptionDetailContent } from '../components/ProductionExceptionDetailContent';
import {
  buildDeliveryDelayExceptionActionButtons,
  hasDeliveryDelayExceptionActions,
  renderDeliveryDelayExceptionActionGroup,
} from '../components/ProductionExceptionDetailActions';
import { apiRequest } from '../../../../../services/api';
import { ExceptionListPage } from '../../../services/production';
import { ACTIVE_MATERIAL_DELIVERY_EXCEPTION_STATUSES } from '../../../constants/exceptionStatuses';
import { formatDateTime } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildProductionExceptionAlertLevelValueEnum,
  buildStandardProductionExceptionStatusValueEnum,
  resolveProductionExceptionListStatusParams,
} from '../../../utils/productionExceptionList';

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
      setDetailDrawerVisible(false);
      setCurrentRecord(null);
      setCurrentAction('');
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t(`${P}.message.handleFailed`));
      throw error;
    }
  };

  const alertLevelValueEnum = useMemo(() => buildProductionExceptionAlertLevelValueEnum(t), [t]);
  const exceptionStatusValueEnum = useMemo(() => buildStandardProductionExceptionStatusValueEnum(t), [t]);

  const columns: ProColumns<DeliveryDelayException>[] = useMemo(() => alignProColumns<DeliveryDelayException>([
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t(`${P}.col.workOrderCode`),
      dataIndex: 'work_order_code',
      width: 140,
      fixed: 'left',
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t(`${P}.col.plannedEndDate`),
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        record.planned_end_date ? formatDateTime(record.planned_end_date, 'YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t(`${P}.col.delayDays`),
      dataIndex: 'delay_days',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
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
      hideInSearch: false,
    },
    {
      title: t(`${P}.col.alertLevel`),
      dataIndex: 'alert_level',
      width: 100,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: alertLevelValueEnum,
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      width: 100,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: exceptionStatusValueEnum,
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
    ...buildDocumentAuditColumns<DeliveryDelayException>(t),
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) =>
        renderRowActionsOverflow(
          [
            <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
              {t('common.detail')}
            </Button>,
            ...buildDeliveryDelayExceptionActionButtons({
              record,
              t,
              onAction: (action) => openHandleModal(record, action),
              keyPrefix: `delivery-delay-actions-${record.id ?? 'row'}`,
            }),
          ],
          { keyPrefix: `delivery-delay-actions-${record.id ?? 'row'}` },
        ),
    },
  ], SALES_DOC_LIST_FIELD_RANK), [alertLevelValueEnum, exceptionStatusValueEnum, t]);

  return (
    <ListPageTemplate>
      <UniTable
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.delivery-delay-exceptions"
        headerTitle={t(`${P}.deliveryDelay.pageTitle`)}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const s = searchFormValues ?? {};
            const statusParams = resolveProductionExceptionListStatusParams(s);
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

            const queryParams: Record<string, unknown> = {
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              order_by: orderBy,
              alert_level: s.alert_level,
              ...statusParams,
            };
            if (!statusParams.status) {
              queryParams.statuses = ACTIVE_MATERIAL_DELIVERY_EXCEPTION_STATUSES;
            }
            if (fuzzyKeyword) {
              queryParams.keyword = fuzzyKeyword;
            } else {
              if (s.work_order_code != null && String(s.work_order_code).trim()) {
                queryParams.work_order_code = String(s.work_order_code).trim();
              }
              if (s.delay_reason != null && String(s.delay_reason).trim()) {
                queryParams.delay_reason = String(s.delay_reason).trim();
              }
            }
            const createdRange = s.created_at_range as [unknown, unknown] | undefined;
            if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
              queryParams.created_start_date = formatDateTime(
                createdRange[0] as string | Date,
                'YYYY-MM-DD',
              );
              queryParams.created_end_date = createdRange[1]
                ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                : queryParams.created_start_date;
            }
            const result = await apiRequest<ExceptionListPage<DeliveryDelayException>>(
              '/apps/kuaizhizao/exceptions/delivery-delay',
              {
                method: 'GET',
                params: queryParams,
              },
            );
            return {
              data: result.items,
              success: true,
              total: result.total,
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
        skipFuzzyPinyinClientFilter
        pinnedTabsField="status"
        pinnedTabsValueEnum={exceptionStatusValueEnum}
      />

      <DetailDrawerTemplate
        title={t(`${P}.deliveryDelay.detailTitle`, { code: currentRecord?.work_order_code || '' })}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          currentRecord ? (
            <DeliveryDelayExceptionDetailContent
              record={currentRecord}
              t={t}
              alertLevelLabel={alertLevelLabel}
              statusLabel={statusLabel}
              suggestedActionLabel={suggestedActionLabel}
            />
          ) : undefined
        }
        collaboration={
          currentRecord && hasDeliveryDelayExceptionActions(currentRecord)
            ? renderDeliveryDelayExceptionActionGroup({
                record: currentRecord,
                t,
                onAction: (action) => openHandleModal(currentRecord, action),
                keyPrefix: `delivery-delay-drawer-${currentRecord.id ?? 'row'}`,
              })
            : undefined
        }
        collaborationTitle={t(`${P}.section.actions`)}
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
