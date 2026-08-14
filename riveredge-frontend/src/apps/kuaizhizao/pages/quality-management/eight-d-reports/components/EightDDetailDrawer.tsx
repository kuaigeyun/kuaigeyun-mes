import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Form, Result, Space, Typography } from 'antd';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { DetailDrawerTemplate, DRAWER_CONFIG, detailDrawerDescriptionItems } from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { qualityImprovementApi, type Quality8DHistoryEntry, type Quality8DReport } from '../../../../services/quality-improvement';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../../utils/documentAttachments';
import { EightDHistoryTimeline } from './EightDHistoryTimeline';
import { EightDStageEditor } from './EightDStageEditor';
import { buildEightDStepperSteps, getEightDNextStatus, getEightDStatusText, resolveEightDSeverityDisplay } from './eightDMeta';
import { eightDReportRowGates } from '../../../../../../hooks/useDocumentCapabilities';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { toApiDateTimeString } from '../../../../../../utils/formDate';

interface EightDDetailDrawerProps {
  open: boolean;
  reportId?: number;
  canUpdate: boolean;
  canClose: boolean;
  onClose: () => void;
  onReloadList: () => void;
}

export const EightDDetailDrawer: React.FC<EightDDetailDrawerProps> = ({
  open,
  reportId,
  canUpdate,
  canClose,
  onClose,
  onReloadList,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [report, setReport] = useState<Quality8DReport | null>(null);
  const [history, setHistory] = useState<Quality8DHistoryEntry[]>([]);
  const [form] = Form.useForm();

  const loadDetail = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [detail, detailHistory] = await Promise.all([
        qualityImprovementApi.eightD.getById(id),
        qualityImprovementApi.eightD.getHistory(id),
      ]);
      setReport(detail);
      setHistory(detailHistory || []);
    } catch (err: any) {
      setError(err?.message || t('app.kuaizhizao.eightD.loadDetailFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !reportId) return;
    setReport((prev) => (prev?.id === reportId ? prev : null));
    setHistory([]);
    void loadDetail(reportId);
  }, [open, reportId]);

  useEffect(() => {
    if (!report) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      ...report,
      due_date: report.due_date ? dayjs(report.due_date) : null,
      attachments: mapAttachmentsToUploadList(report.attachments),
    });
  }, [report, form]);

  const nextStatus = useMemo(() => getEightDNextStatus(report?.status), [report?.status]);
  const reportGates = eightDReportRowGates(report, canUpdate, false, canClose, t);
  const canTransitionToNext = useMemo(() => {
    if (!report || !nextStatus) return false;
    if (nextStatus === 'closed') {
      return reportGates.close.allowed && !reportGates.close.disabled;
    }
    return reportGates.transition.allowed && !reportGates.transition.disabled;
  }, [report, nextStatus, reportGates]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<Quality8DReport>[]>(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.eightD.columns.reportCode'), dataIndex: 'report_code' },
        { title: t('app.kuaizhizao.eightD.columns.title'), dataIndex: 'title' },
        {
          title: t('app.kuaizhizao.eightD.columns.severity'),
          dataIndex: 'severity',
          render: (_, record) => {
            const { label, color } = resolveEightDSeverityDisplay(t, record.severity);
            if (label === '-') return '-';
            return <MarkerTag color={color}>{label}</MarkerTag>;
          },
        },
        { title: t('app.kuaizhizao.eightD.columns.owner'), dataIndex: 'owner_name' },
        {
          title: t('app.kuaizhizao.eightD.columns.dueDate'),
          dataIndex: 'due_date',
          valueType: 'dateTime',
        },
      ]),
    [t],
  );

  const detailCollaboration = useMemo(() => {
    if (!report) return undefined;
    return (
      <UniLifecycleStepper
        steps={buildEightDStepperSteps(t, report.status)}
        status={report.status === 'closed' ? 'success' : 'active'}
        showLabels
        nextStepSuggestions={report.next_step_suggestions || []}
        hideNextStepSuggestions
      />
    );
  }, [report, t]);

  const collaborationTitleExtra = useMemo(() => {
    if (!report?.status) return undefined;
    return (
      <MarkerTag color={report.status === 'closed' ? 'default' : 'processing'}>
        {getEightDStatusText(t, report.status)}
      </MarkerTag>
    );
  }, [report?.status, t]);

  const handleSave = async (values: Record<string, unknown>) => {
    if (!report?.id || !reportGates.update.allowed || reportGates.update.disabled) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        due_date: values.due_date ? toApiDateTimeString(values.due_date as any) : null,
        attachments: normalizeDocumentAttachments(values.attachments as any),
      };
      await qualityImprovementApi.eightD.update(report.id, payload);
      messageApi.success(t('app.kuaizhizao.eightD.saveSuccess'));
      await loadDetail(report.id);
      onReloadList();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async () => {
    if (!report?.id || !nextStatus) return;
    if (nextStatus === 'closed' && !canClose) {
      messageApi.error(t('app.kuaizhizao.eightD.noClosePermission'));
      return;
    }
    if (nextStatus !== 'closed' && !canUpdate) {
      messageApi.error(t('app.kuaizhizao.eightD.noUpdatePermission'));
      return;
    }
    const formValues = form.getFieldsValue();
    setTransitioning(true);
    try {
      await qualityImprovementApi.eightD.update(report.id, {
        ...formValues,
        due_date: formValues.due_date ? toApiDateTimeString(formValues.due_date as any) : null,
        attachments: normalizeDocumentAttachments(formValues.attachments as any),
      });
      await qualityImprovementApi.eightD.transition(report.id, {
        to_status: nextStatus,
        remarks: formValues.remarks,
        verification_result: formValues.verification_result,
      });
      messageApi.success(
        t('app.kuaizhizao.eightD.transitionSuccessTo', {
          status: getEightDStatusText(t, nextStatus),
        }),
      );
      await loadDetail(report.id);
      onReloadList();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.eightD.transitionFailed'));
    } finally {
      setTransitioning(false);
    }
  };

  const contentReady = Boolean(report);
  const showError = Boolean(error && !contentReady && !loading);
  const nextLabel =
    report?.next_step_suggestions?.[0] ||
    (nextStatus ? getEightDStatusText(t, nextStatus) : undefined);

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={`${t('app.kuaizhizao.eightD.workbenchTitle')} ${report?.report_code || ''}`}
      width={DRAWER_CONFIG.HALF_WIDTH}
      open={open}
      onClose={onClose}
      loading={loading && !contentReady}
      extra={
        contentReady && (report?.quality_exception_id || report?.defect_record_id) ? (
          <Space wrap size="small">
            {report?.quality_exception_id ? (
              <Button
                onClick={() => {
                  onClose();
                  navigate('/apps/kuaizhizao/production-execution/quality-exceptions');
                }}
              >
                {t('app.kuaizhizao.eightD.source.qualityException', { id: report.quality_exception_id })}
              </Button>
            ) : null}
            {report?.defect_record_id ? (
              <Button
                onClick={() => {
                  onClose();
                  navigate(
                    `/apps/kuaizhizao/quality-management/nonconforming-ledger?defect_id=${report.defect_record_id}`,
                  );
                }}
              >
                {t('app.kuaizhizao.eightD.source.nonconformingLedger', { id: report.defect_record_id })}
              </Button>
            ) : null}
          </Space>
        ) : null
      }
      footer={
        contentReady ? (
          <Button
            type="primary"
            disabled={!nextStatus || !canTransitionToNext}
            loading={transitioning}
            onClick={() => void handleTransition()}
          >
            {nextStatus
              ? t('app.kuaizhizao.eightD.transitionTo', { status: getEightDStatusText(t, nextStatus) })
              : t('app.kuaizhizao.eightD.reachedFinalStage')}
          </Button>
        ) : undefined
      }
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              reportId ? (
                <Button type="primary" onClick={() => void loadDetail(reportId)}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      collaborationTitleSuffix={
        contentReady && nextLabel ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：{nextLabel}
          </Typography.Text>
        ) : undefined
      }
      basic={
        contentReady && report ? (
          <Descriptions
            column={3}
            size="small"
            items={detailDrawerDescriptionItems(detailBasicColumns, report)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaboration={contentReady ? detailCollaboration : undefined}
      collaborationTitleExtra={contentReady ? collaborationTitleExtra : undefined}
      supplementary={
        contentReady && report ? (
          <EightDStageEditor
            form={form}
            report={report}
            saving={saving}
            onSave={handleSave}
          />
        ) : undefined
      }
      supplementaryTitle={t('app.kuaizhizao.eightD.sectionStageContent')}
      timeline={contentReady && report ? <EightDHistoryTimeline history={history} /> : undefined}
    />
  );
};
