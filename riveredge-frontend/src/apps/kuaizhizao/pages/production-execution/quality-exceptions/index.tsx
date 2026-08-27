/**
 * 质量异常处理页面
 *
 * 提供质量异常处理功能，包括问题追溯、纠正预防措施记录等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormTextArea, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Divider, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import { ExceptionListPage } from '../../../services/production';
import { ACTIVE_QUALITY_EXCEPTION_STATUSES } from '../../../constants/exceptionStatuses';
import { qualityImprovementApi } from '../../../services/quality-improvement';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  hasQualityExceptionHandlingInfo,
  QualityExceptionDetailBasicContent,
  QualityExceptionDetailHandlingContent,
} from '../components/ProductionExceptionDetailContent';
import {
  buildQualityExceptionActionButtons,
  hasQualityExceptionHandleActions,
  renderQualityExceptionHandleGroup,
  renderQualityExceptionWorkbenchExtra,
} from '../components/ProductionExceptionDetailActions';
import {
  ExceptionWorkbenchLifecycleStepper,
  QualityExceptionImpactBanner,
  buildQualityExceptionLifecycle,
  renderExceptionWorkbenchNextStepSuffix,
  resolveExceptionNextStepLabel,
} from '../components/productionExceptionWorkbench';
import { formatDateTime } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { StatusTag } from '../../../../../constants/statusBadges';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import {
  buildQualityExceptionStatusValueEnum,
  resolveProductionExceptionListStatusParams,
  resolveQualityExceptionStatusTagColor,
} from '../../../utils/productionExceptionList';

const P = 'app.kuaizhizao.productionException';
const Q = `${P}.quality`;

const EIGHT_D_RESOURCE = 'kuaizhizao:quality-management-eight-d-reports';

interface QualityException {
  id?: number;
  exception_type?: string;
  work_order_id?: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  batch_no?: string;
  inspection_record_id?: number;
  inspection_source_type?: string;
  problem_description?: string;
  severity?: string;
  status?: string;
  root_cause?: string;
  corrective_action?: string;
  preventive_action?: string;
  responsible_person_name?: string;
  planned_completion_date?: string;
  actual_completion_date?: string;
  verification_result?: string;
  handled_by_name?: string;
  handled_at?: string;
  remarks?: string;
  created_at?: string;
}

const QualityExceptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [urlSearchParams] = useSearchParams();
  const initialInspectionRecordId = urlSearchParams.get('inspection_record_id');
  const initialInspectionSourceType = urlSearchParams.get('inspection_source_type');
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<QualityException | null>(null);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const { canCreate: canCreate8D } = useResourcePermissions(EIGHT_D_RESOURCE);
  const handleFormRef = useRef<any>(null);

  const exceptionTypeLabel = useCallback(
    (type?: string) => {
      const map: Record<string, string> = {
        inspection_failure: t(`${Q}.exceptionType.inspectionFailure`),
        process_deviation: t(`${Q}.exceptionType.processDeviation`),
        customer_complaint: t(`${Q}.exceptionType.customerComplaint`),
      };
      return type ? (map[type] ?? type) : '-';
    },
    [t],
  );

  const severityLabel = useCallback(
    (severity?: string) => {
      const map: Record<string, string> = {
        minor: t(`${Q}.severity.minor`),
        major: t(`${Q}.severity.major`),
        critical: t(`${Q}.severity.critical`),
      };
      return severity ? (map[severity] ?? severity) : '-';
    },
    [t],
  );

  const statusLabel = useCallback(
    (status?: string) => {
      const map: Record<string, string> = {
        pending: t(`${P}.status.pending`),
        investigating: t(`${P}.status.investigating`),
        correcting: t(`${P}.status.correcting`),
        closed: t(`${P}.status.closed`),
        cancelled: t(`${P}.status.cancelled`),
      };
      return status ? (map[status] ?? status) : '-';
    },
    [t],
  );

  const handleModalTitle = useMemo(() => {
    const map: Record<string, string> = {
      investigate: t(`${Q}.modal.handleInvestigate`),
      correct: t(`${Q}.modal.handleCorrect`),
      close: t(`${Q}.modal.handleClose`),
      cancel: t(`${Q}.modal.handleCancel`),
    };
    return map[currentAction] ?? t(`${Q}.modal.handleDefault`);
  }, [currentAction, t]);

  const handleDetail = async (record: QualityException) => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
  };

  const openHandleModal = (record: QualityException, action: string) => {
    setCurrentRecord(record);
    setCurrentAction(action);
    setHandleModalVisible(true);
  };

  const handleStart8D = useCallback(async (record: QualityException) => {
    try {
      const report = await qualityImprovementApi.eightD.startFromException(
        Number(record.id),
        `${record.work_order_code || t(`${Q}.defaultReportTitle`)}-${record.problem_description || t(`${Q}.defaultReportSuffix`)}`,
      );
      messageApi.success(t(`${Q}.message.start8DSuccess`));
      setDetailDrawerVisible(false);
      setCurrentRecord(null);
      if (report?.id) {
        navigate(`/apps/kuaizhizao/quality-management/eight-d-reports?report_id=${report.id}`);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t(`${Q}.message.start8DFailed`));
    }
  }, [messageApi, navigate, t]);

  const handleException = async (values: any) => {
    try {
      if (!currentRecord?.id) {
        throw new Error(t(`${P}.message.recordNotFound`));
      }

      const params: any = {
        action: currentAction,
      };

      if (currentAction === 'investigate' && values.rootCause) {
        params.root_cause = values.rootCause;
      } else if (currentAction === 'correct') {
        if (values.correctiveAction) {
          params.corrective_action = values.correctiveAction;
        }
        if (values.preventiveAction) {
          params.preventive_action = values.preventiveAction;
        }
        if (values.responsiblePersonId) {
          params.responsible_person_id = values.responsiblePersonId;
          params.responsible_person_name = values._responsible_person_name || '';
        }
        if (values.plannedCompletionDate) {
          params.planned_completion_date = values.plannedCompletionDate.format('YYYY-MM-DD HH:mm:ss');
        }
      } else if (currentAction === 'close' && values.verificationResult) {
        params.verification_result = values.verificationResult;
      }

      if (values.remarks) {
        params.remarks = values.remarks;
      }

      await apiRequest(`/apps/kuaizhizao/exceptions/quality/${currentRecord.id}/handle`, {
        method: 'POST',
        params,
      });
      messageApi.success(t(`${P}.message.handleSuccess`));
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

  const qualityStatusValueEnum = useMemo(() => buildQualityExceptionStatusValueEnum(t), [t]);

  const columns: ProColumns<QualityException>[] = useMemo(() => alignProColumns<QualityException>([
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
      width: 240,
      minWidth: 240,
      uniTableKeepWidth: true,
      uniTablePrimaryFlex: false,
      resizable: false,
      fixed: 'left',
      ellipsis: false,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t(`${P}.col.material`),
      key: 'exception_material_stacked',
      dataIndex: 'material_name',
      width: 200,
      minWidth: 200,
      uniTableKeepWidth: true,
      uniTablePrimaryFlex: false,
      resizable: false,
      ellipsis: false,
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
      title: t(`${P}.col.exceptionType`),
      dataIndex: 'exception_type',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      valueEnum: {
        inspection_failure: { text: t(`${Q}.exceptionType.inspectionFailure`), status: 'error' },
        process_deviation: { text: t(`${Q}.exceptionType.processDeviation`), status: 'warning' },
        customer_complaint: { text: t(`${Q}.exceptionType.customerComplaint`), status: 'error' },
      },
    },
    {
      title: t(`${Q}.col.severity`),
      dataIndex: 'severity',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      valueEnum: {
        minor: { text: t(`${Q}.severity.minor`), status: 'default' },
        major: { text: t(`${Q}.severity.major`), status: 'warning' },
        critical: { text: t(`${Q}.severity.critical`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.batchNo`),
      dataIndex: 'batch_no',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.batch_no ?? '') }} ellipsis>
          {r.batch_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${Q}.col.problemDescription`),
      dataIndex: 'problem_description',
      // 无行项目明细：问题描述吃掉视口剩余（RemainderFlex）
      minWidth: 200,
      uniTablePrimaryFlex: true,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: true,
    },
    {
      title: t(`${P}.col.responsiblePerson`),
      dataIndex: 'responsible_person_name',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
    },
    ...buildDocumentAuditColumns<QualityException>(t),
    {
      title: t('common.status'),
      // 搜索仍绑 status；key 声明列身份，UniTable 右固定于操作列之前
      key: 'lifecycle',
      dataIndex: 'status',
      fixed: 'right',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: qualityStatusValueEnum,
      render: (_, record) => (
        <StatusTag color={resolveQualityExceptionStatusTagColor(record.status)}>
          {statusLabel(record.status)}
        </StatusTag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
        <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
          {t('common.detail')}
        </Button>,
        ...buildQualityExceptionActionButtons({
          record,
          t,
          onAction: (action) => openHandleModal(record, action),
          onStart8D: () => { void handleStart8D(record); },
          canCreate8D,
          keyPrefix: `quality-exception-actions-${record.id ?? 'row'}`,
        }),
      ],
    },
  ], SALES_DOC_LIST_FIELD_RANK), [qualityStatusValueEnum, statusLabel, t, canCreate8D, handleStart8D]);

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t(`${Q}.pageTitle`)}
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.qualityException)}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.quality-exceptions-width-v3"
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const s = searchFormValues ?? {};
            const statusParams = resolveProductionExceptionListStatusParams(s);
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';
            const pageSize = params.pageSize || 20;
            const skip = (params.current! - 1) * pageSize;
            const queryParams: Record<string, unknown> = {
              skip,
              limit: pageSize,
              order_by: orderBy,
              exception_type: s.exception_type ?? params.exception_type,
              severity: s.severity ?? params.severity,
              inspection_record_id: initialInspectionRecordId || undefined,
              inspection_source_type: initialInspectionSourceType || undefined,
              ...statusParams,
            };
            if (!statusParams.status) {
              queryParams.statuses = ACTIVE_QUALITY_EXCEPTION_STATUSES;
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
              if (s.batch_no != null && String(s.batch_no).trim()) {
                queryParams.batch_no = String(s.batch_no).trim();
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
            const result = await apiRequest<ExceptionListPage<QualityException>>(
              '/apps/kuaizhizao/exceptions/quality',
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
        pinnedTabsValueEnum={qualityStatusValueEnum}
      />

      <DetailDrawerTemplate
        title={t(`${Q}.detailTitle`, { code: currentRecord?.work_order_code || '' })}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRecord(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentRecord
            ? renderQualityExceptionWorkbenchExtra({
                record: currentRecord,
                t,
                navigate,
                onCloseDrawer: () => {
                  setDetailDrawerVisible(false);
                  setCurrentRecord(null);
                },
                onStart8D: () => { void handleStart8D(currentRecord); },
                canCreate8D,
                keyPrefix: `quality-exception-drawer-${currentRecord.id ?? 'row'}`,
              })
            : undefined
        }
        banner={
          currentRecord ? (
            <QualityExceptionImpactBanner
              record={currentRecord}
              t={t}
              exceptionTypeLabel={exceptionTypeLabel}
              severityLabel={severityLabel}
            />
          ) : undefined
        }
        basic={
          currentRecord ? (
            <QualityExceptionDetailBasicContent record={currentRecord} t={t} />
          ) : undefined
        }
        collaboration={
          currentRecord ? (
            <ExceptionWorkbenchLifecycleStepper
              lifecycle={buildQualityExceptionLifecycle(t, currentRecord.status)}
              hideNextStepSuggestions
            />
          ) : undefined
        }
        collaborationTitleSuffix={
          currentRecord
            ? renderExceptionWorkbenchNextStepSuffix(
                t,
                resolveExceptionNextStepLabel(
                  buildQualityExceptionLifecycle(t, currentRecord.status),
                ),
              )
            : undefined
        }
        lines={
          currentRecord && hasQualityExceptionHandlingInfo(currentRecord) ? (
            <QualityExceptionDetailHandlingContent record={currentRecord} t={t} />
          ) : undefined
        }
        linesTitle={t(`${Q}.section.corrective`)}
        footer={
          currentRecord && hasQualityExceptionHandleActions(currentRecord)
            ? renderQualityExceptionHandleGroup({
                record: currentRecord,
                t,
                onAction: (action) => openHandleModal(currentRecord, action),
                keyPrefix: `quality-exception-drawer-${currentRecord.id ?? 'row'}`,
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
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={handleFormRef}
      >
        {currentRecord && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>{t(`${P}.col.exceptionType`)}:</strong> {exceptionTypeLabel(currentRecord.exception_type)}</p>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code || '-'}</p>
              <p><strong>{t(`${P}.col.materialName`)}:</strong> {currentRecord.material_name || '-'}</p>
              <p><strong>{t(`${Q}.col.problemDescription`)}:</strong> {currentRecord.problem_description}</p>
            </div>
            {currentAction === 'investigate' && (
              <>
                <Divider>{t(`${Q}.section.investigation`)}</Divider>
                <ProFormTextArea
                  name="rootCause"
                  label={t(`${Q}.field.rootCause`)}
                  placeholder={t(`${Q}.placeholder.rootCause`)}
                  fieldProps={{
                    rows: 4,
                  }}
                />
              </>
            )}
            {currentAction === 'correct' && (
              <>
                <Divider>{t(`${Q}.section.corrective`)}</Divider>
                <ProFormTextArea
                  name="correctiveAction"
                  label={t(`${Q}.field.correctiveAction`)}
                  placeholder={t(`${Q}.placeholder.correctiveAction`)}
                  fieldProps={{
                    rows: 4,
                  }}
                />
                <ProFormTextArea
                  name="preventiveAction"
                  label={t(`${Q}.field.preventiveAction`)}
                  placeholder={t(`${Q}.placeholder.preventiveAction`)}
                  fieldProps={{
                    rows: 4,
                  }}
                />
                <UniUserSelect
                  name="responsiblePersonId"
                  label={t(`${P}.col.responsiblePerson`)}
                  placeholder={t(`${Q}.placeholder.responsiblePerson`)}
                  onChange={(_, user) => {
                    const u = Array.isArray(user) ? user[0] : user;
                    handleFormRef.current?.setFieldsValue({
                      _responsible_person_name: u?.full_name || u?.username
                    });
                  }}
                />
                <ProFormDatePicker
                  name="plannedCompletionDate"
                  label={t(`${Q}.field.plannedCompletionDate`)}
                  placeholder={t(`${Q}.placeholder.plannedCompletionDate`)}
                  width="md"
                />
              </>
            )}
            {currentAction === 'close' && (
              <>
                <Divider>{t(`${Q}.section.verification`)}</Divider>
                <ProFormTextArea
                  name="verificationResult"
                  label={t(`${Q}.field.verificationResult`)}
                  placeholder={t(`${Q}.placeholder.verificationResult`)}
                  fieldProps={{
                    rows: 4,
                  }}
                />
              </>
            )}
            <Divider>{t('common.remark')}</Divider>
            <ProFormTextArea
              name="remarks"
              label={t('common.remark')}
              placeholder={t(`${P}.placeholder.remarksOptional`)}
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

export default QualityExceptionsPage;
