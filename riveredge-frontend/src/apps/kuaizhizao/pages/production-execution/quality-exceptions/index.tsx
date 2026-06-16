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
import { App, Tag, Button, Space, Divider, Typography } from 'antd';
import { EyeOutlined, CheckCircleOutlined, SearchOutlined, ToolOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getQualityExceptionLifecycle } from '../../../utils/qualityExceptionLifecycle';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import { qualityImprovementApi } from '../../../services/quality-improvement';
import { buildInspectionDetailPath } from '../../quality-management/components/inspectionTemplateUtils';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

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
      setCurrentRecord(null);
      setCurrentAction('');
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t(`${P}.message.handleFailed`));
      throw error;
    }
  };

  const columns: ProColumns<QualityException>[] = useMemo(() => [
    {
      title: t(`${P}.col.exceptionType`),
      dataIndex: 'exception_type',
      width: 120,
      valueEnum: {
        inspection_failure: { text: t(`${Q}.exceptionType.inspectionFailure`), status: 'error' },
        process_deviation: { text: t(`${Q}.exceptionType.processDeviation`), status: 'warning' },
        customer_complaint: { text: t(`${Q}.exceptionType.customerComplaint`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.workOrderCode`),
      dataIndex: 'work_order_code',
      width: 140,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }} ellipsis>
          {r.work_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.materialCode`),
      dataIndex: 'material_code',
      width: 120,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.material_code ?? '') }} ellipsis>
          {r.material_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${P}.col.materialName`),
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t(`${P}.col.batchNo`),
      dataIndex: 'batch_no',
      width: 100,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.batch_no ?? '') }} ellipsis>
          {r.batch_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t(`${Q}.col.problemDescription`),
      dataIndex: 'problem_description',
      width: 200,
      ellipsis: true,
    },
    {
      title: t(`${Q}.col.severity`),
      dataIndex: 'severity',
      width: 100,
      valueEnum: {
        minor: { text: t(`${Q}.severity.minor`), status: 'default' },
        major: { text: t(`${Q}.severity.major`), status: 'warning' },
        critical: { text: t(`${Q}.severity.critical`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.status`),
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: {
        pending: { text: t(`${P}.status.pending`), status: 'default' },
        investigating: { text: t(`${P}.status.investigating`), status: 'processing' },
        correcting: { text: t(`${P}.status.correcting`), status: 'processing' },
        closed: { text: t(`${P}.status.closed`), status: 'success' },
        cancelled: { text: t(`${P}.status.cancelled`), status: 'error' },
      },
    },
    {
      title: t(`${P}.col.lifecycle`),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getQualityExceptionLifecycle(record as Record<string, unknown>, t);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t(`${P}.col.responsiblePerson`),
      dataIndex: 'responsible_person_name',
      width: 100,
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
            <Button
              type="link"
              size="small"
              icon={<SearchOutlined />}
              onClick={() => openHandleModal(record, 'investigate')}
            >
              {t(`${P}.action.investigate`)}
            </Button>
          )}
          {record.status === 'investigating' && (
            <Button
              type="link"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => openHandleModal(record, 'correct')}
            >
              {t(`${P}.action.correct`)}
            </Button>
          )}
          {record.status === 'correcting' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => openHandleModal(record, 'close')}
            >
              {t(`${P}.action.close`)}
            </Button>
          )}
          {(record.status === 'pending' || record.status === 'investigating' || record.status === 'correcting') && (
            <Button
              type="link"
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => openHandleModal(record, 'cancel')}
              danger
            >
              {t(`${P}.action.cancel`)}
            </Button>
          )}
          {canCreate8D && (
            <Button
              type="link"
              size="small"
              onClick={async () => {
                try {
                  const report = await qualityImprovementApi.eightD.startFromException(
                    Number(record.id),
                    `${record.work_order_code || t(`${Q}.defaultReportTitle`)}-${record.problem_description || t(`${Q}.defaultReportSuffix`)}`
                  );
                  messageApi.success(t(`${Q}.message.start8DSuccess`));
                  if (report?.id) {
                    navigate(`/apps/kuaizhizao/quality-management/eight-d-reports?report_id=${report.id}`);
                  }
                } catch (error: any) {
                  messageApi.error(error?.message || t(`${Q}.message.start8DFailed`));
                }
              }}
            >
              {t(`${Q}.action.start8D`)}
            </Button>
          )}
        </Space>
      ),
    },
  ], [t, canCreate8D, navigate, messageApi]);

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t(`${Q}.pageTitle`)}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.quality-exceptions"
        request={async (params) => {
          try {
            const pageSize = params.pageSize || 20;
            const skip = (params.current! - 1) * pageSize;
            const result = await apiRequest('/apps/kuaizhizao/exceptions/quality', {
              method: 'GET',
              params: {
                skip,
                limit: pageSize,
                exception_type: params.exception_type,
                status: params.status,
                severity: params.severity,
                inspection_record_id: initialInspectionRecordId || undefined,
                inspection_source_type: initialInspectionSourceType || undefined,
              },
            });
            const rows = Array.isArray(result) ? result : (result as { items?: QualityException[] })?.items ?? [];
            const total =
              rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
            return {
              data: rows,
              success: true,
              total,
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
        scroll={{ x: 1680 }}
      />

      <DetailDrawerTemplate
        title={t(`${Q}.detailTitle`, { code: currentRecord?.work_order_code || '' })}
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
              <p><strong>{t(`${P}.col.exceptionType`)}:</strong> {exceptionTypeLabel(currentRecord.exception_type)}</p>
              <p><strong>{t(`${P}.col.workOrderCode`)}:</strong> {currentRecord.work_order_code || '-'}</p>
              <p><strong>{t(`${P}.col.materialCode`)}:</strong> {currentRecord.material_code || '-'}</p>
              <p><strong>{t(`${P}.col.materialName`)}:</strong> {currentRecord.material_name || '-'}</p>
              {currentRecord.batch_no && (
                <p><strong>{t(`${P}.col.batchNo`)}:</strong> {currentRecord.batch_no}</p>
              )}
              <p><strong>{t(`${Q}.col.problemDescription`)}:</strong> {currentRecord.problem_description}</p>
              {currentRecord.inspection_record_id ? (
                <Space wrap style={{ marginBottom: 8 }}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const path = buildInspectionDetailPath(
                        currentRecord.inspection_source_type,
                        currentRecord.inspection_record_id,
                      );
                      if (path) {
                        setDetailDrawerVisible(false);
                        navigate(path);
                      }
                    }}
                  >
                    {t(`${Q}.action.viewSourceInspection`)}
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setDetailDrawerVisible(false);
                      const q = new URLSearchParams();
                      if (currentRecord.inspection_source_type === 'incoming_inspection') {
                        q.set('incoming_inspection_id', String(currentRecord.inspection_record_id));
                      } else if (currentRecord.inspection_source_type === 'process_inspection') {
                        q.set('process_inspection_id', String(currentRecord.inspection_record_id));
                      } else if (currentRecord.inspection_source_type === 'finished_goods_inspection') {
                        q.set('finished_goods_inspection_id', String(currentRecord.inspection_record_id));
                      }
                      navigate(`/apps/kuaizhizao/quality-management/nonconforming-ledger?${q.toString()}`);
                    }}
                  >
                    {t(`${Q}.action.viewNonconformingLedger`)}
                  </Button>
                </Space>
              ) : null}
              <p><strong>{t(`${Q}.col.severity`)}:</strong>
                <Tag color={
                  currentRecord.severity === 'critical' ? 'red' :
                    currentRecord.severity === 'major' ? 'orange' : 'default'
                }>
                  {severityLabel(currentRecord.severity)}
                </Tag>
              </p>
              <p><strong>{t(`${P}.col.status`)}:</strong>
                <Tag color={
                  currentRecord.status === 'closed' ? 'success' :
                    currentRecord.status === 'correcting' || currentRecord.status === 'investigating' ? 'processing' :
                      currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {statusLabel(currentRecord.status)}
                </Tag>
              </p>
              {currentRecord.root_cause && (
                <p><strong>{t(`${Q}.field.rootCause`)}:</strong> {currentRecord.root_cause}</p>
              )}
              {currentRecord.corrective_action && (
                <p><strong>{t(`${Q}.field.correctiveAction`)}:</strong> {currentRecord.corrective_action}</p>
              )}
              {currentRecord.preventive_action && (
                <p><strong>{t(`${Q}.field.preventiveAction`)}:</strong> {currentRecord.preventive_action}</p>
              )}
              {currentRecord.responsible_person_name && (
                <p><strong>{t(`${P}.col.responsiblePerson`)}:</strong> {currentRecord.responsible_person_name}</p>
              )}
              {currentRecord.planned_completion_date && (
                <p><strong>{t(`${Q}.field.plannedCompletionDate`)}:</strong> {currentRecord.planned_completion_date}</p>
              )}
              {currentRecord.actual_completion_date && (
                <p><strong>{t(`${Q}.field.actualCompletionDate`)}:</strong> {currentRecord.actual_completion_date}</p>
              )}
              {currentRecord.verification_result && (
                <p><strong>{t(`${Q}.field.verificationResult`)}:</strong> {currentRecord.verification_result}</p>
              )}
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
            <Divider>{t(`${P}.field.remarks`)}</Divider>
            <ProFormTextArea
              name="remarks"
              label={t(`${P}.field.remarks`)}
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
