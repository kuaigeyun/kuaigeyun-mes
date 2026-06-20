import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Form, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { qualityImprovementApi, type Quality8DHistoryEntry, type Quality8DReport } from '../../../../services/quality-improvement';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../../utils/documentAttachments';
import { EightDHistoryTimeline } from './EightDHistoryTimeline';
import { EightDStageEditor } from './EightDStageEditor';
import { buildEightDStepperSteps, getEightDNextStatus, getEightDSeverityText, getEightDStatusText } from './eightDMeta';
import { eightDReportRowGates } from '../../../../../../hooks/useDocumentCapabilities';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../../../../utils/format';

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
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [report, setReport] = useState<Quality8DReport | null>(null);
  const [history, setHistory] = useState<Quality8DHistoryEntry[]>([]);
  const [form] = Form.useForm();

  const loadDetail = async (id: number) => {
    setLoading(true);
    try {
      const [detail, detailHistory] = await Promise.all([
        qualityImprovementApi.eightD.getById(id),
        qualityImprovementApi.eightD.getHistory(id),
      ]);
      setReport(detail);
      setHistory(detailHistory || []);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.eightD.loadDetailFailed'));
      setReport(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !reportId) return;
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

  const handleSave = async (values: Record<string, unknown>) => {
    if (!report?.id || !reportGates.update.allowed || reportGates.update.disabled) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        due_date: values.due_date ? dayjs(values.due_date as any).toISOString() : null,
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
        due_date: formValues.due_date ? dayjs(formValues.due_date as any).toISOString() : null,
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

  return (
    <DetailDrawerTemplate
      title={`${t('app.kuaizhizao.eightD.workbenchTitle')} - ${report?.report_code || ''}`}
      width={DRAWER_CONFIG.EXTRA_LARGE_WIDTH}
      open={open}
      onClose={onClose}
      loading={loading}
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.close')}</Button>
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
        </Space>
      }
      basic={
        report ? (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Descriptions
              column={3}
              size="small"
              items={[
                { key: 'title', label: t('app.kuaizhizao.eightD.columns.title'), children: report.title || '-' },
                {
                  key: 'severity',
                  label: t('app.kuaizhizao.eightD.columns.severity'),
                  children: <Tag>{getEightDSeverityText(t, report.severity)}</Tag>,
                },
                { key: 'owner', label: t('app.kuaizhizao.eightD.columns.owner'), children: report.owner_name || '-' },
                {
                  key: 'due_date',
                  label: t('app.kuaizhizao.eightD.columns.dueDate'),
                  children: report.due_date ? formatDateTime(report.due_date, 'YYYY-MM-DD HH:mm') : '-',
                },
                {
                  key: 'source_exception',
                  label: t('app.kuaizhizao.eightD.columns.sourceException'),
                  children: report.quality_exception_id ? (
                    <Button
                      type="link"
                      size="small"
                      style={{ paddingInline: 0 }}
                      onClick={() => navigate('/apps/kuaizhizao/production-execution/quality-exceptions')}
                    >
                      {t('app.kuaizhizao.eightD.source.qualityException', { id: report.quality_exception_id })}
                    </Button>
                  ) : (
                    '-'
                  ),
                },
                {
                  key: 'source_defect',
                  label: t('app.kuaizhizao.eightD.columns.sourceDefect'),
                  children: report.defect_record_id ? (
                    <Button
                      type="link"
                      size="small"
                      style={{ paddingInline: 0 }}
                      onClick={() =>
                        navigate(
                          `/apps/kuaizhizao/quality-management/nonconforming-ledger?defect_id=${report.defect_record_id}`,
                        )
                      }
                    >
                      {t('app.kuaizhizao.eightD.source.nonconformingLedger', { id: report.defect_record_id })}
                    </Button>
                  ) : (
                    '-'
                  ),
                },
              ]}
            />
            <UniLifecycleStepper
              steps={buildEightDStepperSteps(t, report.status)}
              nextStepSuggestions={report.next_step_suggestions || []}
              hideNextStepSuggestions={!report.next_step_suggestions?.length}
            />
          </Space>
        ) : null
      }
      collaboration={
        report ? (
          <EightDStageEditor
            form={form}
            report={report}
            saving={saving}
            onSave={handleSave}
          />
        ) : null
      }
      timeline={<EightDHistoryTimeline history={history} />}
      timelineVisible
      collaborationVisible
    />
  );
};
