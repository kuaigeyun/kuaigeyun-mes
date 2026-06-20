/**
 * 期初数据导入页面（SME 向导：快照、分步门禁、错误反馈、进度持久化）
 */

import React, { useState, Suspense, lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Drawer,
  Modal,
  Space,
  Steps,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  DownloadOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport }))
);
import {
  importInitialInventory,
  importInitialWIP,
  importInitialReceivablesPayables,
  getCountdown,
  patchWizardCountdown,
  type InitialInventoryImportResponse,
} from '../../../services/initial-data';
import dayjs, { Dayjs } from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

/** 与后端 header_map 一致的默认列（CSV 模板同步） */
const INV_HEADER_KEYS = [
  'app.kuaizhizao.initialData.csvHeaders.material_code',
  'app.kuaizhizao.initialData.csvHeaders.warehouse_code',
  'app.kuaizhizao.initialData.csvHeaders.quantity',
  'app.kuaizhizao.initialData.csvHeaders.amount',
  'app.kuaizhizao.initialData.csvHeaders.batch_number',
  'app.kuaizhizao.initialData.csvHeaders.location_code',
];
const INV_EXAMPLE = ['MAT001', 'WH001', '100', '1000.00', 'BATCH001', 'LOC001'];

const WIP_HEADER_KEYS = [
  'app.kuaizhizao.initialData.csvHeaders.work_order_code',
  'app.kuaizhizao.initialData.csvHeaders.product_code',
  'app.kuaizhizao.initialData.csvHeaders.current_operation',
  'app.kuaizhizao.initialData.csvHeaders.wip_quantity',
  'app.kuaizhizao.initialData.csvHeaders.input_quantity',
  'app.kuaizhizao.initialData.csvHeaders.estimated_completion_time',
  'app.kuaizhizao.initialData.csvHeaders.workshop_code',
];
const WIP_EXAMPLE = ['', 'PROD001', 'OP001', '50', '100', '2026-01-20 18:00:00', 'WS001'];

const AR_HEADER_KEYS = [
  'app.kuaizhizao.initialData.csvHeaders.type',
  'app.kuaizhizao.initialData.csvHeaders.customer_code',
  'app.kuaizhizao.initialData.csvHeaders.supplier_code',
  'app.kuaizhizao.initialData.csvHeaders.source_type',
  'app.kuaizhizao.initialData.csvHeaders.source_code',
  'app.kuaizhizao.initialData.csvHeaders.business_date',
  'app.kuaizhizao.initialData.csvHeaders.receivable_amount',
  'app.kuaizhizao.initialData.csvHeaders.payable_amount',
  'app.kuaizhizao.initialData.csvHeaders.received_amount',
  'app.kuaizhizao.initialData.csvHeaders.paid_amount',
  'app.kuaizhizao.initialData.csvHeaders.due_date',
  'app.kuaizhizao.initialData.csvHeaders.invoice_number',
];

function downloadCsvTemplate(headers: string[], filename: string) {
  const line = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',');
  const blob = new Blob([`\uFEFF${line}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ImportErr = { row: number; error: string };

const InitialDataImportPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { Text, Paragraph, Title } = Typography;

  const [currentStep, setCurrentStep] = useState(0);
  const [snapshotTime, setSnapshotTime] = useState<Dayjs | null>(null);
  const [launchDate, setLaunchDate] = useState<Dayjs | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [wipImportVisible, setWipImportVisible] = useState(false);
  const [receivablesPayablesImportVisible, setReceivablesPayablesImportVisible] = useState(false);
  const [inventoryGatePassed, setInventoryGatePassed] = useState(false);
  const [wipDone, setWipDone] = useState(false);
  const [wipSkipped, setWipSkipped] = useState(false);
  const [arDone, setArDone] = useState(false);
  const [arSkipped, setArSkipped] = useState(false);
  const [errorDrawerOpen, setErrorDrawerOpen] = useState(false);
  const [lastErrors, setLastErrors] = useState<ImportErr[]>([]);
  const [lastImportLabel, setLastImportLabel] = useState('');

  const invHeaders = useMemo(
    () => INV_HEADER_KEYS.map((k) => t(k)).filter(Boolean),
    [i18n.language, t],
  );

  const wipHeaders = useMemo(
    () => WIP_HEADER_KEYS.map((k) => t(k)).filter(Boolean),
    [i18n.language, t],
  );

  const arHeaders = useMemo(
    () => AR_HEADER_KEYS.map((k) => t(k)).filter(Boolean),
    [i18n.language, t],
  );

  const arExample = useMemo(
    () => [
      t('app.kuaizhizao.initialData.csvExample.ar.type'),
      'CUS001',
      '',
      t('app.kuaizhizao.initialData.csvExample.ar.source_type'),
      'SO001',
      '2026-01-10',
      '10000.00',
      '',
      '0',
      '',
      '2026-02-10',
      'INV001',
    ],
    [i18n.language, t],
  );

  const snapshotIso = useCallback(
    () => (snapshotTime ? snapshotTime.format('YYYY-MM-DD HH:mm:ss') : undefined),
    [snapshotTime]
  );

  const persistSnapshot = useCallback(async (d: Dayjs | null) => {
    if (!d) return;
    try {
      await patchWizardCountdown({ snapshot_time: d.format('YYYY-MM-DD HH:mm:ss') });
    } catch {
      /* 静默：无倒计时权限或网络问题时仍可本地继续 */
    }
  }, []);

  const hydrateFromProgress = useCallback((progress: Record<string, any> | undefined) => {
    if (!progress) return;
    const inv = progress.inventory;
    const invOk = !!inv?.completed;
    if (invOk) setInventoryGatePassed(true);

    const wip = progress.wip;
    let wipOk = false;
    if (wip?.completed) {
      wipOk = true;
      if (wip.status === 'skipped') {
        setWipSkipped(true);
        setWipDone(false);
      } else {
        setWipDone(true);
        setWipSkipped(false);
      }
    }

    const ar = progress.receivables_payables;
    let arOk = false;
    if (ar?.completed) {
      arOk = true;
      if (ar.status === 'skipped') {
        setArSkipped(true);
        setArDone(false);
      } else {
        setArDone(true);
        setArSkipped(false);
      }
    }

    const wiz = progress.wizard;
    let s =
      wiz && typeof wiz.current_step === 'number' ? Math.max(0, Math.min(3, wiz.current_step)) : 0;
    if (!invOk && s > 0) s = 0;
    if (!wipOk && s > 1) s = 1;
    if (!arOk && s > 2) s = 2;
    setCurrentStep(s);
  }, []);

  const loadCountdown = useCallback(async () => {
    try {
      const data = await getCountdown();
      if (!data) {
        setSnapshotTime(dayjs().subtract(1, 'day').hour(23).minute(59).second(0));
        return;
      }
      if (data.launch_date) setLaunchDate(dayjs(data.launch_date));
      if (data.snapshot_time) {
        setSnapshotTime(dayjs(data.snapshot_time));
      } else {
        setSnapshotTime(dayjs().subtract(1, 'day').hour(23).minute(59).second(0));
      }
      hydrateFromProgress(data.progress);
    } catch (e) {
      console.error(e);
    }
  }, [hydrateFromProgress]);

  React.useEffect(() => {
    loadCountdown();
  }, [loadCountdown]);

  React.useEffect(() => {
    if (!snapshotTime) return;
    const h = window.setTimeout(() => {
      persistSnapshot(snapshotTime);
    }, 600);
    return () => window.clearTimeout(h);
  }, [snapshotTime, persistSnapshot]);

  const showImportErrors = (label: string, result: InitialInventoryImportResponse) => {
    const errs = (result.errors || []) as ImportErr[];
    if (errs.length > 0) {
      setLastImportLabel(label);
      setLastErrors(errs);
      setErrorDrawerOpen(true);
    }
  };

  const handleImportReceivablesPayables = async (data: any[][]) => {
    try {
      const result = await importInitialReceivablesPayables(data, snapshotIso());
      showImportErrors(t('app.kuaizhizao.initialData.importArTitle'), result);
      if (result.failure_count === 0 && result.success_count > 0) {
        messageApi.success(
          t('app.kuaizhizao.initialData.importArOk', { n: result.success_count })
        );
        setReceivablesPayablesImportVisible(false);
        setArDone(true);
        setArSkipped(false);
        await patchWizardCountdown({
          stage: 'receivables_payables',
          stage_status: 'completed',
          wizard_step: 2,
        });
      } else if (result.failure_count > 0) {
        messageApi.warning(
          t('app.kuaizhizao.initialData.importPartial', {
            ok: result.success_count,
            bad: result.failure_count,
          })
        );
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.initialData.importFailed'));
    }
  };

  const handleImportWIP = async (data: any[][]) => {
    try {
      const result = await importInitialWIP(data, snapshotIso());
      showImportErrors(t('app.kuaizhizao.initialData.importWipTitle'), result);
      if (result.failure_count === 0 && result.success_count > 0) {
        messageApi.success(
          t('app.kuaizhizao.initialData.importWipOk', { n: result.success_count })
        );
        setWipImportVisible(false);
        setWipDone(true);
        setWipSkipped(false);
        await patchWizardCountdown({ stage: 'wip', stage_status: 'completed', wizard_step: 1 });
      } else if (result.failure_count > 0) {
        messageApi.warning(
          t('app.kuaizhizao.initialData.importPartial', {
            ok: result.success_count,
            bad: result.failure_count,
          })
        );
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.initialData.importFailed'));
    }
  };

  const handleImportInventory = async (data: any[][]) => {
    try {
      const result = await importInitialInventory(data, snapshotIso());
      showImportErrors(t('app.kuaizhizao.initialData.importInvTitle'), result);
      if (result.failure_count === 0 && result.success_count > 0) {
        messageApi.success(
          t('app.kuaizhizao.initialData.importInvOk', { n: result.success_count })
        );
        setImportVisible(false);
        setInventoryGatePassed(true);
        await patchWizardCountdown({ stage: 'inventory', stage_status: 'completed', wizard_step: 0 });
      } else if (result.failure_count > 0) {
        messageApi.warning(
          t('app.kuaizhizao.initialData.importPartial', {
            ok: result.success_count,
            bad: result.failure_count,
          })
        );
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.initialData.importFailed'));
    }
  };

  const canGoNext = useMemo(() => {
    if (currentStep === 0) return inventoryGatePassed;
    if (currentStep === 1) return wipDone || wipSkipped;
    if (currentStep === 2) return arDone || arSkipped;
    return false;
  }, [currentStep, inventoryGatePassed, wipDone, wipSkipped, arDone, arSkipped]);

  const nextDisabledHint = useMemo(() => {
    if (canGoNext || currentStep >= 3) return '';
    if (currentStep === 0) return t('app.kuaizhizao.initialData.nextHintNeedInventory');
    if (currentStep === 1) return t('app.kuaizhizao.initialData.nextHintNeedWip');
    return t('app.kuaizhizao.initialData.nextHintNeedAr');
  }, [canGoNext, currentStep, t]);

  const snapshotAfterLaunch =
    launchDate &&
    snapshotTime &&
    snapshotTime.isAfter(dayjs(launchDate).endOf('day'));

  const handleNext = async () => {
    if (!canGoNext || currentStep >= 3) return;
    const next = currentStep + 1;
    try {
      await patchWizardCountdown({ wizard_step: next });
    } catch {
      /* ignore */
    }
    setCurrentStep(next);
  };

  const handlePrev = async () => {
    if (currentStep <= 0) return;
    const prev = currentStep - 1;
    try {
      await patchWizardCountdown({ wizard_step: prev });
    } catch {
      /* ignore */
    }
    setCurrentStep(prev);
  };

  const confirmSkipWip = () => {
    Modal.confirm({
      title: t('app.kuaizhizao.initialData.skipWipTitle'),
      content: t('app.kuaizhizao.initialData.skipWipBody'),
      okText: t('app.kuaizhizao.initialData.skipConfirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setWipSkipped(true);
        setWipDone(false);
        try {
          await patchWizardCountdown({
            stage: 'wip',
            stage_status: 'skipped',
            wizard_step: 1,
          });
        } catch {
          /* ignore */
        }
        messageApi.info(t('app.kuaizhizao.initialData.skippedWip'));
      },
    });
  };

  const confirmSkipAr = () => {
    Modal.confirm({
      title: t('app.kuaizhizao.initialData.skipArTitle'),
      content: t('app.kuaizhizao.initialData.skipArBody'),
      okText: t('app.kuaizhizao.initialData.skipConfirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setArSkipped(true);
        setArDone(false);
        try {
          await patchWizardCountdown({
            stage: 'receivables_payables',
            stage_status: 'skipped',
            wizard_step: 2,
          });
        } catch {
          /* ignore */
        }
        messageApi.info(t('app.kuaizhizao.initialData.skippedAr'));
      },
    });
  };

  const copyErrors = () => {
    const text = lastErrors.map((e) => `${e.row}\t${e.error}`).join('\n');
    navigator.clipboard.writeText(text).then(
      () => messageApi.success(t('app.kuaizhizao.initialData.copiedErrors')),
      () => messageApi.error(t('app.kuaizhizao.initialData.copyFailed'))
    );
  };

  const downloadErrorsCsv = () => {
    const headers = [t('app.kuaizhizao.initialData.colRow'), t('app.kuaizhizao.initialData.colError')];
    const lines = [
      headers.join(','),
      ...lastErrors.map((e) => `${e.row},"${String(e.error).replace(/"/g, '""')}"`),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('app.kuaizhizao.initialData.errorCsvFileName', { ts: formatDateTime(dayjs(), 'YYYYMMDD-HHmm') });
    a.click();
    URL.revokeObjectURL(url);
  };

  const steps = [
    {
      title: t('app.kuaizhizao.initialData.stepInventory'),
      content: t('app.kuaizhizao.initialData.stepInventoryDesc'),
    },
    {
      title: t('app.kuaizhizao.initialData.stepWip'),
      content: t('app.kuaizhizao.initialData.stepWipDesc'),
    },
    {
      title: t('app.kuaizhizao.initialData.stepAr'),
      content: t('app.kuaizhizao.initialData.stepArDesc'),
    },
    {
      title: t('app.kuaizhizao.initialData.stepDone'),
      content: t('app.kuaizhizao.initialData.stepDoneDesc'),
    },
  ];

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('app.kuaizhizao.initialData.pageIntro')}
          </Paragraph>

          <Card size="small" styles={{ body: { padding: 48 } }}>
            <Space orientation="vertical" size={0} style={{ width: '100%' }}>
              <Space size={6} align="center" wrap style={{ marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {t('app.kuaizhizao.initialData.cardPrepTitle')}
                </Title>
                <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{t('app.kuaizhizao.initialData.checklistHintShort')}</span>}>
                  <QuestionCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />
                </Tooltip>
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                {t('app.kuaizhizao.initialData.checklistHint')}
              </Paragraph>
              <Space wrap size="middle">
                <Button type="link" icon={<LinkOutlined />} onClick={() => navigate('/apps/master-data/materials')}>
                  {t('app.kuaizhizao.initialData.linkMaterials')}
                </Button>
                <Button type="link" icon={<LinkOutlined />} onClick={() => navigate('/apps/master-data/warehouse/warehouses')}>
                  {t('app.kuaizhizao.initialData.linkWarehouses')}
                </Button>
              </Space>
            </Space>
          </Card>

          {launchDate ? (
            <Text type="secondary">
              <Text strong>{t('app.kuaizhizao.initialData.launchDateShort')}</Text>
              {launchDate.format('YYYY-MM-DD')}
            </Text>
          ) : null}

          {snapshotAfterLaunch ? (
            <Alert type="warning" showIcon title={t('app.kuaizhizao.initialData.snapshotAfterLaunch')} />
          ) : null}

          <Card size="small" styles={{ body: { padding: 48 } }}>
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Space size={6} align="center" wrap style={{ marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    {t('app.kuaizhizao.initialData.snapshotTitle')}
                  </Title>
                  <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{t('app.kuaizhizao.initialData.snapshotAdvancedBody')}</span>}>
                    <QuestionCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />
                  </Tooltip>
                </Space>
                <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  {t('app.kuaizhizao.initialData.snapshotHint')}
                </Paragraph>
                <Space wrap align="center" size={12} style={{ width: '100%', rowGap: 12 }}>
                  <Button onClick={() => setSnapshotTime(dayjs().subtract(1, 'day').hour(23).minute(59).second(0))}>
                    {t('app.kuaizhizao.initialData.snapshotYesterday')}
                  </Button>
                  <Button onClick={() => setSnapshotTime(dayjs().endOf('month').hour(23).minute(59).second(0))}>
                    {t('app.kuaizhizao.initialData.snapshotMonthEnd')}
                  </Button>
                  <Button onClick={() => setSnapshotTime(dayjs().second(0).millisecond(0))}>
                    {t('app.kuaizhizao.initialData.snapshotNow')}
                  </Button>
                  <DatePicker
                    showTime
                    size="middle"
                    format="YYYY-MM-DD HH:mm:ss"
                    placeholder={t('app.kuaizhizao.initialData.snapshotPlaceholder')}
                    value={snapshotTime}
                    onChange={(d) => setSnapshotTime(d)}
                    style={{ width: 280, maxWidth: '100%' }}
                  />
                </Space>
              </div>

              <Divider style={{ margin: 0 }} />

              <div>
                <Space size={6} align="center" wrap style={{ marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    {t('app.kuaizhizao.initialData.importInvSection')}
                  </Title>
                  <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{t('app.kuaizhizao.initialData.idempotencyBody')}</span>}>
                    <QuestionCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />
                  </Tooltip>
                </Space>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  {t('app.kuaizhizao.initialData.importInvFields')}
                </Paragraph>
                <Space wrap align="center">
                  <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportVisible(true)}>
                    {t('app.kuaizhizao.initialData.openSheet')}
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      downloadCsvTemplate(
                        invHeaders,
                        t('app.kuaizhizao.initialData.inventoryTemplateFileName'),
                      )
                    }
                  >
                    {t('app.kuaizhizao.initialData.downloadTemplate')}
                  </Button>
                </Space>
                {inventoryGatePassed ? (
                  <Alert style={{ marginTop: 16 }} type="success" showIcon title={t('app.kuaizhizao.initialData.inventoryDone')} />
                ) : null}
              </div>
            </Space>
          </Card>
        </Space>
      );
    }
    if (currentStep === 1) {
      return (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Paragraph type="secondary">{t('app.kuaizhizao.initialData.wipIntro')}</Paragraph>
          <Space wrap align="center">
            <Button type="primary" icon={<ImportOutlined />} onClick={() => setWipImportVisible(true)}>
              {t('app.kuaizhizao.initialData.openSheet')}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                downloadCsvTemplate(wipHeaders, t('app.kuaizhizao.initialData.wipTemplateFileName'))
              }
            >
              {t('app.kuaizhizao.initialData.downloadTemplate')}
            </Button>
            <Button danger type="default" onClick={confirmSkipWip}>
              {t('app.kuaizhizao.initialData.skipStep')}
            </Button>
          </Space>
          {wipDone ? (
            <Alert type="success" showIcon title={t('app.kuaizhizao.initialData.wipImported')} />
          ) : null}
          {wipSkipped ? (
            <Alert type="info" showIcon title={t('app.kuaizhizao.initialData.wipSkippedBanner')} />
          ) : null}
        </Space>
      );
    }
    if (currentStep === 2) {
      return (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Paragraph type="secondary">{t('app.kuaizhizao.initialData.arIntro')}</Paragraph>
          <Space wrap align="center">
            <Button type="primary" icon={<ImportOutlined />} onClick={() => setReceivablesPayablesImportVisible(true)}>
              {t('app.kuaizhizao.initialData.openSheet')}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                downloadCsvTemplate(arHeaders, t('app.kuaizhizao.initialData.arapTemplateFileName'))
              }
            >
              {t('app.kuaizhizao.initialData.downloadTemplate')}
            </Button>
            <Button danger type="default" onClick={confirmSkipAr}>
              {t('app.kuaizhizao.initialData.skipStep')}
            </Button>
          </Space>
          {arDone ? (
            <Alert type="success" showIcon title={t('app.kuaizhizao.initialData.arImported')} />
          ) : null}
          {arSkipped ? (
            <Alert type="info" showIcon title={t('app.kuaizhizao.initialData.arSkippedBanner')} />
          ) : null}
        </Space>
      );
    }
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
        <Typography.Title level={4} style={{ marginTop: 8 }}>
          {t('app.kuaizhizao.initialData.finishTitle')}
        </Typography.Title>
        <Paragraph type="secondary">{t('app.kuaizhizao.initialData.finishBody')}</Paragraph>
        <Alert
          style={{ maxWidth: 560, margin: '24px auto', textAlign: 'left' }}
          type="info"
          message={t('app.kuaizhizao.initialData.finishHint')}
        />
      </div>
    );
  };

  return (
    <ListPageTemplate>
      <Card styles={{ body: { padding: 48 } }}>
        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

        <div style={{ minHeight: 400, marginBottom: 24 }}>{renderStepContent()}</div>

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {currentStep > 0 && currentStep < 3 && (
            <Button onClick={handlePrev}>{t('app.kuaizhizao.initialData.prev')}</Button>
          )}
          {currentStep < 3 && (
            <Tooltip title={nextDisabledHint || undefined}>
              <Button type="primary" disabled={!canGoNext} onClick={handleNext}>
                {t('app.kuaizhizao.initialData.next')}
              </Button>
            </Tooltip>
          )}
        </Space>
      </Card>

      {(importVisible || wipImportVisible || receivablesPayablesImportVisible) && (
        <Suspense fallback={null}>
          {importVisible && (
            <LazyUniImport
              visible={importVisible}
              onCancel={() => setImportVisible(false)}
              onConfirm={handleImportInventory}
              title={t('app.kuaizhizao.initialData.importInvTitle')}
              headers={invHeaders}
              exampleRow={INV_EXAMPLE}
            />
          )}
          {wipImportVisible && (
            <LazyUniImport
              visible={wipImportVisible}
              onCancel={() => setWipImportVisible(false)}
              onConfirm={handleImportWIP}
              title={t('app.kuaizhizao.initialData.importWipTitle')}
              headers={wipHeaders}
              exampleRow={WIP_EXAMPLE}
            />
          )}
          {receivablesPayablesImportVisible && (
            <LazyUniImport
              visible={receivablesPayablesImportVisible}
              onCancel={() => setReceivablesPayablesImportVisible(false)}
              onConfirm={handleImportReceivablesPayables}
              title={t('app.kuaizhizao.initialData.importArTitle')}
              headers={arHeaders}
              exampleRow={arExample}
            />
          )}
        </Suspense>
      )}

      <Drawer
        title={`${lastImportLabel} — ${t('app.kuaizhizao.initialData.errorDrawerTitle')}`}
        size={560}
        open={errorDrawerOpen}
        onClose={() => setErrorDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={copyErrors}>{t('app.kuaizhizao.initialData.copyErrors')}</Button>
            <Button type="primary" onClick={downloadErrorsCsv}>
              {t('app.kuaizhizao.initialData.downloadErrors')}
            </Button>
          </Space>
        }
      >
        <Table
          size="small"
          pagination={{ pageSize: 20 }}
          rowKey={(r) => `${r.row}-${r.error}`}
          dataSource={lastErrors}
          columns={[
            { title: t('app.kuaizhizao.initialData.colRow'), dataIndex: 'row', width: 72 },
            { title: t('app.kuaizhizao.initialData.colError'), dataIndex: 'error' },
          ]}
        />
      </Drawer>
    </ListPageTemplate>
  );
};

export default InitialDataImportPage;
