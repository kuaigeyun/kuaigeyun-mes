import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Result,
  Row,
  Space,
  Spin,
  Tabs,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { ListPageTemplate, ProjectWorkbenchToolbar } from '../../../../../../components/layout-templates';
import { useLeaveFormTab } from '../../../../../../components/uni-tabs/navigateClosingTab';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { hasModulePermission } from '../../../../../../utils/permissionContract';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { eightDReportRowGates } from '../../../../../../hooks/useDocumentCapabilities';
import { formatDateTime } from '../../../../../../utils/format';
import {
  qualityImprovementApi,
  type Quality8DHistoryEntry,
  type Quality8DReport,
  type Quality8DStageRevisionEntry,
} from '../../../../services/quality-improvement';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../../utils/documentAttachments';
import DocumentAttachmentsField from '../../../../components/DocumentAttachmentsField';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import { EightDHistoryTimeline } from '../components/EightDHistoryTimeline';
import { EightDStageRevisionTimeline } from '../components/EightDStageRevisionTimeline';
import { EightDStageEditor } from '../components/EightDStageEditor';
import { EightDStageStepper } from '../components/EightDStageStepper';
import {
  EIGHT_D_STAGE_FIELDS,
  getEightDNextStatus,
  getEightDStatusText,
  isEightDCompletedStage,
  isEightDStageEditable,
  isEightDStageUnlocked,
  resolveEightDSeverityDisplay,
  resolveEightDSourceDisplay,
  stripEightDHistoryRemarks,
  normalizeEightDStageHtml,
  stripEightDHtml,
} from '../components/eightDMeta';
import './workbench.less';

const EIGHT_D_RESOURCE = 'kuaizhizao:quality-management-eight-d-reports';
const LIST_PATH = '/apps/kuaizhizao/quality-management/eight-d-reports';

function buildStagePayload(values: Record<string, unknown>, activeStageKey?: string) {
  const normalizeStage = (value: unknown) =>
    normalizeEightDStageHtml(typeof value === 'string' ? value : '');
  const payload: Record<string, unknown> = {
    attachments: normalizeDocumentAttachments(values.attachments as never),
    remarks: values.remarks,
    verification_result: values.verification_result,
  };
  const fieldName = activeStageKey ? EIGHT_D_STAGE_FIELDS[activeStageKey] : undefined;
  if (fieldName) {
    payload[fieldName] = normalizeStage(values[fieldName]);
  }
  return payload;
}

const EightDWorkbench: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const leaveList = useLeaveFormTab(LIST_PATH);
  const currentUser = useCurrentUser();
  const { canUpdate, canPrint } = useResourcePermissions(EIGHT_D_RESOURCE);
  const canClose = hasModulePermission(currentUser ?? undefined, EIGHT_D_RESOURCE, 'close');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [report, setReport] = useState<Quality8DReport | null>(null);
  const [history, setHistory] = useState<Quality8DHistoryEntry[]>([]);
  const [stageRevisions, setStageRevisions] = useState<Quality8DStageRevisionEntry[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [activeStageKey, setActiveStageKey] = useState<string>('d0_prepare');
  const [form] = Form.useForm();

  const loadDetail = useCallback(async () => {
    if (!reportId || Number.isNaN(reportId)) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, detailHistory] = await Promise.all([
        qualityImprovementApi.eightD.getById(reportId),
        qualityImprovementApi.eightD.getHistory(reportId),
      ]);
      setReport(detail);
      setHistory(detailHistory || []);
    } catch (err: unknown) {
      setError((err as Error)?.message || t('app.kuaizhizao.eightD.loadDetailFailed'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [reportId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const loadStageRevisions = useCallback(async () => {
    if (!reportId || Number.isNaN(reportId)) return;
    setRevisionsLoading(true);
    try {
      const rows = await qualityImprovementApi.eightD.getStageRevisions(reportId, activeStageKey);
      setStageRevisions(rows || []);
    } catch {
      setStageRevisions([]);
    } finally {
      setRevisionsLoading(false);
    }
  }, [reportId, activeStageKey]);

  useEffect(() => {
    void loadStageRevisions();
  }, [loadStageRevisions]);

  useEffect(() => {
    const code = report?.report_code?.trim();
    if (!code) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: {
          key: tabKey,
          title: `${code} ${t('app.kuaizhizao.eightD.workbench.tabTitleSuffix')}`,
        },
      }),
    );
  }, [report?.report_code, location.pathname, location.search, t]);

  useEffect(() => {
    if (!report) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      ...report,
      attachments: mapAttachmentsToUploadList(report.attachments),
      remarks: stripEightDHistoryRemarks(report.remarks),
      d0_prepare: normalizeEightDStageHtml(report.d0_prepare),
      d1_team: normalizeEightDStageHtml(report.d1_team),
      d2_problem: normalizeEightDStageHtml(report.d2_problem),
      d3_containment: normalizeEightDStageHtml(report.d3_containment),
      d4_root_cause: normalizeEightDStageHtml(report.d4_root_cause),
      d5_corrective_action: normalizeEightDStageHtml(report.d5_corrective_action),
      d6_implement_result: normalizeEightDStageHtml(report.d6_implement_result),
      d7_prevent_recurrence: normalizeEightDStageHtml(report.d7_prevent_recurrence),
      d8_team_congratulation: normalizeEightDStageHtml(report.d8_team_congratulation),
    });
  }, [report, form]);

  useEffect(() => {
    if (!report?.status) return;
    const workflowKey = report.status === 'closed' ? 'd8_team_congratulation' : report.status;
    setActiveStageKey(workflowKey);
  }, [report?.id]);

  const reportGates = eightDReportRowGates(report, canUpdate, false, canClose, t, undefined, canPrint);
  const nextStatus = useMemo(() => getEightDNextStatus(report?.status), [report?.status]);
  const canTransitionToNext = useMemo(() => {
    if (!report || !nextStatus) return false;
    if (nextStatus === 'closed') {
      return reportGates.close.allowed && !reportGates.close.disabled;
    }
    return reportGates.transition.allowed && !reportGates.transition.disabled;
  }, [report, nextStatus, reportGates]);

  const isClosedReport = report?.status === 'closed';
  const activeStageEditable = useMemo(
    () => isEightDStageEditable(report?.status, activeStageKey, report?.stage_unlocks),
    [report?.status, report?.stage_unlocks, activeStageKey],
  );

  const handleSave = async (values: Record<string, unknown>) => {
    if (!report?.id) return;
    const saveAllowed =
      canUpdate &&
      activeStageEditable &&
      (isClosedReport || (reportGates.update.allowed && !reportGates.update.disabled));
    if (!saveAllowed) {
      messageApi.warning(reportGates.update.title || t('common.noPermission'));
      return;
    }
    setSaving(true);
    const unlockEditStage =
      isEightDCompletedStage(report.status, activeStageKey) &&
      isEightDStageUnlocked(report.stage_unlocks, activeStageKey);
    try {
      await qualityImprovementApi.eightD.update(
        report.id,
        buildStagePayload(values, activeStageKey),
      );
      messageApi.success(
        unlockEditStage
          ? t('app.kuaizhizao.eightD.stageUnlock.saveComplete')
          : t('app.kuaizhizao.eightD.saveSuccess'),
      );
      await loadDetail();
      await loadStageRevisions();
    } catch (err: unknown) {
      messageApi.error((err as Error)?.message || t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const submitSave = () => {
    if (!report) return;
    const fieldsToValidate: string[] = ['remarks', 'attachments'];
    const editingField = EIGHT_D_STAGE_FIELDS[activeStageKey];
    if (editingField && activeStageEditable) {
      fieldsToValidate.push(editingField);
    } else {
      const currentField = EIGHT_D_STAGE_FIELDS[report.status];
      if (currentField) {
        fieldsToValidate.push(currentField);
      }
    }
    form
      .validateFields(fieldsToValidate)
      .then((values) => handleSave(values))
      .catch(() => {
        messageApi.warning(t('app.kuaizhizao.eightD.saveValidationFailed'));
      });
  };

  const handleTransition = async () => {
    if (!report?.id || !nextStatus) return;
    try {
      const currentField = EIGHT_D_STAGE_FIELDS[report.status];
      if (currentField) {
        await form.validateFields([currentField]);
      }
    } catch {
      messageApi.warning(t('app.kuaizhizao.eightD.currentStageRequired', {
        stage: getEightDStatusText(t, report.status),
      }));
      return;
    }
    const formValues = form.getFieldsValue();
    setTransitioning(true);
    try {
      await qualityImprovementApi.eightD.update(
        report.id,
        buildStagePayload(formValues, report.status),
      );
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
      await loadDetail();
      if (nextStatus !== 'closed') {
        setActiveStageKey(nextStatus);
      }
    } catch (err: unknown) {
      messageApi.error((err as Error)?.message || t('app.kuaizhizao.eightD.transitionFailed'));
    } finally {
      setTransitioning(false);
    }
  };

  const handleRequestStageUnlock = async (stageKey: string, reason: string) => {
    if (!report?.id) return;
    setUnlocking(true);
    try {
      const updated = await qualityImprovementApi.eightD.requestStageUnlock(report.id, {
        stage_key: stageKey,
        reason,
      });
      setReport(updated);
      messageApi.success(t('app.kuaizhizao.eightD.stageUnlock.success'));
      await loadStageRevisions();
    } catch (err: unknown) {
      messageApi.error((err as Error)?.message || t('app.kuaizhizao.eightD.stageUnlock.failed'));
      throw err;
    } finally {
      setUnlocking(false);
    }
  };

  if (loading && !report) {
    return (
      <ListPageTemplate>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </ListPageTemplate>
    );
  }

  if (error && !report) {
    return (
      <ListPageTemplate>
        <Result
          status="error"
          title={error}
          extra={
            <Button type="primary" onClick={() => void loadDetail()}>
              {t('common.retry')}
            </Button>
          }
        />
      </ListPageTemplate>
    );
  }

  if (!report) {
    return (
      <ListPageTemplate>
        <Empty description={t('app.kuaizhizao.eightD.notFound')}>
          <Button onClick={leaveList}>{t('app.kuaizhizao.eightD.workbench.backToList')}</Button>
        </Empty>
      </ListPageTemplate>
    );
  }

  const severityDisplay = resolveEightDSeverityDisplay(t, report.severity);
  const sourceDisplay = resolveEightDSourceDisplay(t, report);
  const statusLabel = getEightDStatusText(t, report.status);
  const verificationDisplay = stripEightDHtml(
    typeof report.verification_result === 'string'
      ? report.verification_result
      : String(report.verification_result ?? ''),
  );
  const isClosed = report.status === 'closed';
  const canSave =
    canUpdate &&
    activeStageEditable &&
    (isClosed || (reportGates.update.allowed && !reportGates.update.disabled));

  const headerActions =
    canSave || (canPrint && reportGates.print.allowed) ? (
      <Space wrap>
        {canSave ? (
          <Button type="primary" loading={saving} onClick={submitSave}>
            {t('common.save')}
          </Button>
        ) : null}
        {canPrint && reportGates.print.allowed ? (
          <Button
            onClick={() => openPrint({ documentType: 'eight_d_report', documentId: report.id! })}
          >
            {t('common.print')}
          </Button>
        ) : null}
      </Space>
    ) : null;

  return (
    <>
      <ListPageTemplate>
        <Form
          form={form}
          layout="vertical"
          className="eight-d-workbench project-workbench-shell"
          onFinish={(values) => void handleSave(values)}
          onFinishFailed={() => {
            messageApi.warning(t('app.kuaizhizao.eightD.saveValidationFailed'));
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <ProjectWorkbenchToolbar
              backLabel={t('app.kuaizhizao.eightD.workbench.backToList')}
              onBack={leaveList}
              title={`${report.report_code} - ${report.title}`}
              status={
                <>
                  <MarkerTag color={isClosed ? 'default' : 'processing'}>{statusLabel}</MarkerTag>
                  {severityDisplay.label !== '-' ? (
                    <MarkerTag color={severityDisplay.color}>{severityDisplay.label}</MarkerTag>
                  ) : null}
                </>
              }
              actions={headerActions}
            />

          <Card size="small" className="project-workbench-overview">
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} md={16}>
                <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label={t('app.kuaizhizao.eightD.columns.severity')}>
                    {severityDisplay.label !== '-' ? (
                      <MarkerTag color={severityDisplay.color}>{severityDisplay.label}</MarkerTag>
                    ) : (
                      '—'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.eightD.columns.owner')}>
                    {report.owner_name || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.eightD.columns.dueDate')}>
                    {report.due_date ? formatDateTime(report.due_date, 'YYYY-MM-DD HH:mm:ss') : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.eightD.columns.source')}>
                    {sourceDisplay?.label ?? '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaizhizao.eightD.columns.verificationResult')}>
                    {verificationDisplay || '—'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col xs={24} md={8} className="eight-d-workbench-overview-stage">
                <Typography.Text type="secondary">
                  {t('app.kuaizhizao.eightD.workbench.currentStage')}
                </Typography.Text>
                <Typography.Title level={5} style={{ margin: '4px 0 8px' }}>
                  {statusLabel}
                </Typography.Title>
                {!isClosed && nextStatus ? (
                  <Button
                    type="primary"
                    block
                    disabled={!canTransitionToNext}
                    loading={transitioning}
                    title={!canTransitionToNext ? reportGates.transition.title : undefined}
                    onClick={() => void handleTransition()}
                  >
                    {t('app.kuaizhizao.eightD.transitionTo', {
                      status: getEightDStatusText(t, nextStatus),
                    })}
                  </Button>
                ) : null}
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card size="small" styles={{ body: { paddingTop: 12 } }} className="eight-d-workbench-main">
                <EightDStageStepper
                  reportStatus={report.status}
                  activeStageKey={activeStageKey}
                  onChange={(key) => setActiveStageKey(key)}
                />
                <div className="eight-d-workbench-stage-panel">
                  <EightDStageEditor
                    form={form}
                    report={report}
                    activeStageKey={activeStageKey}
                    saving={saving}
                    unlocking={unlocking}
                    canUpdate={canUpdate}
                    onSaveClick={submitSave}
                    onRequestUnlock={handleRequestStageUnlock}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card
                size="small"
                title={t('app.kuaizhizao.eightD.workbench.section.source')}
                style={{ marginBottom: 16 }}
              >
                <Space direction="vertical">
                  {report.quality_exception_id ? (
                    <Button
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() => navigate('/apps/kuaizhizao/production-execution/quality-exceptions')}
                    >
                      {t('app.kuaizhizao.eightD.source.qualityException', { id: report.quality_exception_id })}
                    </Button>
                  ) : null}
                  {report.defect_record_id ? (
                    <Button
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() =>
                        navigate(
                          `/apps/kuaizhizao/quality-management/nonconforming-ledger?defect_id=${report.defect_record_id}`,
                        )
                      }
                    >
                      {t('app.kuaizhizao.eightD.source.nonconformingLedger', { id: report.defect_record_id })}
                    </Button>
                  ) : null}
                  {!report.quality_exception_id && !report.defect_record_id ? (
                    <Typography.Text type="secondary">
                      {t('app.kuaizhizao.eightD.workbench.noSource')}
                    </Typography.Text>
                  ) : null}
                </Space>
              </Card>

              <Card
                size="small"
                title={t('common.attachments')}
                style={{ marginBottom: 16 }}
              >
                {!isClosed && canUpdate ? (
                  <DocumentAttachmentsField category="quality_8d_report_attachments" label={false} />
                ) : (
                  <Typography.Text type="secondary">
                    {t('app.uniDetail.attachmentCenter.empty')}
                  </Typography.Text>
                )}
              </Card>

              <Card size="small" title={t('app.kuaizhizao.eightD.workbench.section.history')}>
                <Tabs
                  items={[
                    {
                      key: 'report',
                      label: t('app.kuaizhizao.eightD.history.reportTab'),
                      children: <EightDHistoryTimeline history={history} />,
                    },
                    {
                      key: 'stage',
                      label: t('app.kuaizhizao.eightD.history.stageTab'),
                      children: revisionsLoading ? (
                        <div style={{ padding: 24, textAlign: 'center' }}>
                          <Spin />
                        </div>
                      ) : (
                        <EightDStageRevisionTimeline
                          revisions={stageRevisions}
                          stageKey={activeStageKey}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </Space>
        </Form>
      </ListPageTemplate>
      {PrintModal}
    </>
  );
};

export default EightDWorkbench;
