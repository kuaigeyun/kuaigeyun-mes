/**
 * 缺料异常处理页面
 *
 * 提供缺料异常处理功能，包括预警列表、替代物料推荐等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { MaterialShortageExceptionDetailContent } from '../components/ProductionExceptionDetailContent';
import {
  buildMaterialShortageExceptionActionButtons,
  hasMaterialShortageExceptionActions,
  renderMaterialShortageExceptionActionGroup,
} from '../components/ProductionExceptionDetailActions';
import {
  ExceptionSuggestedActionBlock,
  ExceptionWorkbenchLifecycleStepper,
  MaterialShortageImpactBanner,
  buildStandardExceptionLifecycle,
  renderExceptionWorkbenchNextStepSuffix,
  resolveExceptionNextStepLabel,
} from '../components/productionExceptionWorkbench';
import { apiRequest } from '../../../../../services/api';
import { ExceptionListPage } from '../../../services/production';
import { ACTIVE_MATERIAL_DELIVERY_EXCEPTION_STATUSES } from '../../../constants/exceptionStatuses';
import { formatDateTime } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { StatusTag } from '../../../../../constants/statusBadges';
import { UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH } from '../../../../../utils/uniTableLayoutColumns';
import {
  buildProductionExceptionAlertLevelValueEnum,
  buildStandardProductionExceptionStatusValueEnum,
  resolveProductionExceptionListStatusParams,
  resolveStandardProductionExceptionStatusTagColor,
} from '../../../utils/productionExceptionList';

const P = 'app.kuaizhizao.productionException';

/**
 * 缺料异常接口定义
 */
interface MaterialShortageException {
  id?: number;
  work_order_id?: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  shortage_quantity?: number;
  available_quantity?: number;
  required_quantity?: number;
  alert_level?: string;
  status?: string;
  alternative_material_id?: number;
  alternative_material_code?: string;
  alternative_material_name?: string;
  suggested_action?: string;
  handled_by_name?: string;
  handled_at?: string;
  created_at?: string;
}

/**
 * 缺料异常处理页面组件
 */
const MaterialShortageExceptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<MaterialShortageException | null>(null);
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
        purchase: t(`${P}.suggestedAction.purchase`),
        substitute: t(`${P}.suggestedAction.substitute`),
        adjust: t(`${P}.suggestedAction.adjust`),
      };
      return action ? (map[action] ?? action) : '-';
    },
    [t],
  );

  const handleModalTitle = useMemo(() => {
    const map: Record<string, string> = {
      purchase: t(`${P}.materialShortage.modal.handlePurchase`),
      substitute: t(`${P}.materialShortage.modal.handleSubstitute`),
      resolve: t(`${P}.materialShortage.modal.handleResolve`),
      cancel: t(`${P}.materialShortage.modal.handleCancel`),
    };
    return map[currentAction] ?? t(`${P}.materialShortage.modal.handleDefault`);
  }, [currentAction, t]);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaterialShortageException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  const openHandleModal = (record: MaterialShortageException, action: string) => {
    setCurrentRecord(record);
    setCurrentAction(action);
    setHandleModalVisible(true);
  };

  const handleException = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.recordNotFound`));
      }

      const params: any = {
        action: currentAction,
      };

      if (currentAction === 'substitute' && values.alternativeMaterialId) {
        params.alternative_material_id = values.alternativeMaterialId;
      }

      if (values.remarks) {
        params.remarks = values.remarks;
      }

      const handled = await apiRequest<{
        scheduling_deep_link?: string;
        scheduling_notice?: string;
      }>(`/apps/kuaizhizao/exceptions/material-shortage/${currentRecord.id}/handle`, {
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

  const columns: ProColumns<MaterialShortageException>[] = useMemo(() => alignProColumns<MaterialShortageException>([
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
      key: 'exception_doc_work_order_code',
      dataIndex: 'work_order_code',
      width: 180,
      uniTableKeepWidth: true,
      fixed: 'left',
      ellipsis: false,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t(`${P}.col.material`),
      key: 'exception_material_stacked',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, record) => (
        <MaterialStackedCell
          material_name={record.material_name}
          material_code={record.material_code}
        />
      ),
    },
    { title: t(`${P}.col.materialCode`), dataIndex: 'material_code', hideInTable: true },
    { title: t(`${P}.col.materialName`), dataIndex: 'material_name', hideInTable: true },
    {
      title: t(`${P}.col.requiredQty`),
      dataIndex: 'required_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.availableQty`),
      dataIndex: 'available_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${P}.col.shortageQty`),
      dataIndex: 'shortage_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {record.shortage_quantity}
        </span>
      ),
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
      title: t(`${P}.col.suggestedAction`),
      dataIndex: 'suggested_action',
      width: 100,
      valueEnum: {
        purchase: { text: t(`${P}.suggestedAction.purchase`), status: 'processing' },
        substitute: { text: t(`${P}.suggestedAction.substitute`), status: 'warning' },
        adjust: { text: t(`${P}.suggestedAction.adjust`), status: 'default' },
      },
    },
    ...buildDocumentAuditColumns<MaterialShortageException>(t),
    {
      title: t('common.status'),
      // 搜索仍绑 status；key 声明列身份，UniTable 右固定于操作列之前
      key: 'lifecycle',
      dataIndex: 'status',
      width: UNI_TABLE_STATUS_BADGE_COLUMN_WIDTH,
      uniTableKeepWidth: true,
      fixed: 'right',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: exceptionStatusValueEnum,
      render: (_, record) => (
        <StatusTag color={resolveStandardProductionExceptionStatusTagColor(record.status)}>
          {statusLabel(record.status)}
        </StatusTag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      render: (_, record) => [
        <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
          {t('common.detail')}
        </Button>,
        ...buildMaterialShortageExceptionActionButtons({
          record,
          t,
          onAction: (action) => openHandleModal(record, action),
          keyPrefix: `material-shortage-actions-${record.id ?? 'row'}`,
        }),
      ],
    },
  ], SALES_DOC_LIST_FIELD_RANK), [alertLevelValueEnum, exceptionStatusValueEnum, statusLabel, t]);

  return (
    <ListPageTemplate>
      <UniTable
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.material-shortage-exceptions.v3"
        headerTitle={t(`${P}.materialShortage.pageTitle`)}
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
              if (s.material_code != null && String(s.material_code).trim()) {
                queryParams.material_code = String(s.material_code).trim();
              }
              if (s.material_name != null && String(s.material_name).trim()) {
                queryParams.material_name = String(s.material_name).trim();
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

            const result = await apiRequest<ExceptionListPage<MaterialShortageException>>(
              '/apps/kuaizhizao/exceptions/material-shortage',
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
        title={t(`${P}.materialShortage.detailTitle`, { code: currentRecord?.work_order_code || '' })}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        banner={
          currentRecord ? (
            <MaterialShortageImpactBanner
              record={currentRecord}
              t={t}
              alertLevelLabel={alertLevelLabel}
            />
          ) : undefined
        }
        basic={
          currentRecord ? (
            <MaterialShortageExceptionDetailContent record={currentRecord} t={t} />
          ) : undefined
        }
        collaboration={
          currentRecord ? (
            <ExceptionWorkbenchLifecycleStepper
              lifecycle={buildStandardExceptionLifecycle(t, currentRecord.status)}
              hideNextStepSuggestions
            />
          ) : undefined
        }
        collaborationTitleSuffix={
          currentRecord
            ? renderExceptionWorkbenchNextStepSuffix(
                t,
                resolveExceptionNextStepLabel(
                  buildStandardExceptionLifecycle(t, currentRecord.status),
                  suggestedActionLabel(currentRecord.suggested_action),
                ),
              )
            : undefined
        }
        supplementary={
          currentRecord && suggestedActionLabel(currentRecord.suggested_action) !== '-' ? (
            <ExceptionSuggestedActionBlock label={suggestedActionLabel(currentRecord.suggested_action)} />
          ) : undefined
        }
        supplementaryTitle={t(`${P}.col.suggestedAction`)}
        supplementaryVisible={Boolean(
          currentRecord && suggestedActionLabel(currentRecord.suggested_action) !== '-',
        )}
        footer={
          currentRecord && hasMaterialShortageExceptionActions(currentRecord)
            ? renderMaterialShortageExceptionActionGroup({
                record: currentRecord,
                t,
                onAction: (action) => openHandleModal(currentRecord, action),
                keyPrefix: `material-shortage-drawer-${currentRecord.id ?? 'row'}`,
              })
            : undefined
        }
      />

      <FormModalTemplate
        title={handleModalTitle}
        open={handleModalVisible}
        onClose={() => {
          setHandleModalVisible(false);
          setCurrentAction('');
          handleFormRef.current?.resetFields();
        }}
        afterOpenChange={(open) => {
          if (open) {
            handleFormRef.current?.resetFields();
          }
        }}
        onFinish={handleException}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={handleFormRef}
      >
        {currentRecord && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code}</p>
              <p><strong>{t(`${P}.col.materialName`)}:</strong> {currentRecord.material_name}</p>
              <p>
                <strong>{t(`${P}.col.shortageQty`)}:</strong>{' '}
                <Typography.Text type="danger" strong>
                  {currentRecord.shortage_quantity}
                </Typography.Text>
              </p>
            </div>
            {currentAction === 'substitute' && (
              <UniMaterialSelect
                name="alternativeMaterialId"
                label={t(`${P}.field.alternativeMaterial`)}
                placeholder={t(`${P}.materialShortage.placeholder.alternativeMaterial`)}
                required
              />
            )}
            <ProFormTextArea
              name="remarks"
              label={t('common.remark')}
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

export default MaterialShortageExceptionsPage;
