/**
 * 通用同步弹窗：数据接口 / 数据集 + 字段映射
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Steps,
  Switch,
  Table,
  Typography,
} from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { ThemedSegmented } from '../themed-segmented/ThemedSegmented';
import { getAPIList, getAPIByUuid, testAPI } from '../../services/apiManagement';
import { getDatasetList, executeDatasetQuery } from '../../services/dataset';
import { formatDateTimeBySiteSetting } from '../../utils/format';
import {
  extractKingdeeFieldKeys,
  formatSyncErrorMessage,
  invertFieldMapping,
  isInactiveSyncSourceError,
  mappingFromBinding,
  normalizeApiBodyToRows,
  suggestTargetToSourceMapping,
  SYNC_PREVIEW_ROW_LIMIT,
  withKingdeePreviewLimit,
} from './syncSourceUtils';
import type {
  SyncBinding,
  SyncFromSourceConfig,
  SyncFromSourceResult,
  SyncProgressItem,
  SyncSourceType,
} from './types';

export type { SyncFromSourceConfig, SyncFromSourceResult, SyncSourceType } from './types';

/**
 * 多行表单项共用一列标签宽：按本块最长标签自动撑开（4 字/5 字都齐），禁止换行。
 * 勿再写死像素宽——字数变化会挤换行或对不齐。
 */
const SYNC_FIELD_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  columnGap: 12,
  rowGap: 12,
  alignItems: 'center',
  width: '100%',
};

const SYNC_FIELD_LABEL_STYLE: React.CSSProperties = {
  whiteSpace: 'nowrap',
  lineHeight: '32px',
};

const SYNC_FIELD_CONTROL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
};

export interface SyncFromSourceModalProps {
  open: boolean;
  onClose: () => void;
  config: SyncFromSourceConfig;
  onComplete?: (result: SyncFromSourceResult) => void;
  zIndex?: number;
}

export const SyncFromSourceModal: React.FC<SyncFromSourceModalProps> = ({
  open,
  onClose,
  config,
  onComplete,
  zIndex,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const [sourceType, setSourceType] = useState<SyncSourceType>('dataset');
  const [apiOptions, setApiOptions] = useState<{ label: string; value: string }[]>([]);
  const [datasetOptions, setDatasetOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedApiUuid, setSelectedApiUuid] = useState<string>();
  const [selectedDatasetUuid, setSelectedDatasetUuid] = useState<string>();
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncElapsedSec, setSyncElapsedSec] = useState(0);
  const [saveBinding, setSaveBinding] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [syncMode, setSyncMode] = useState<string>('manual_full');
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] = useState<number>(15);
  const [bindingMeta, setBindingMeta] = useState<Pick<
    SyncBinding,
    'last_success_at' | 'last_attempt_at' | 'last_error'
  > | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [targetToSource, setTargetToSource] = useState<Record<string, string>>({});
  const [hasSavedMapping, setHasSavedMapping] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressItem[]>([]);

  useEffect(() => {
    if (!syncing) {
      setSyncElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    setSyncElapsedSec(0);
    const timer = window.setInterval(() => {
      setSyncElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [syncing]);

  const syncProgressPercent = useMemo(() => {
    if (syncProgress.length === 0) return 0;
    const settled = syncProgress.filter((step) =>
      step.status === 'finish' || step.status === 'error' || step.status === 'skip',
    ).length;
    const inProcess = syncProgress.some((step) => step.status === 'process');
    const units = settled + (inProcess ? 0.5 : 0);
    return Math.min(100, Math.round((units / syncProgress.length) * 100));
  }, [syncProgress]);

  const syncProgressStatus = useMemo(() => {
    if (syncProgress.some((step) => step.status === 'error')) return 'exception' as const;
    if (syncing) return 'active' as const;
    // 停用等软中断：进度条保持普通态，不用成功绿/危险红
    if (syncProgress.some((step) => step.status === 'skip')) return 'normal' as const;
    if (
      syncProgress.length > 0 &&
      syncProgress.every((step) => step.status === 'finish')
    ) {
      return 'success' as const;
    }
    return 'normal' as const;
  }, [syncProgress, syncing]);

  const syncCurrentStepTitle = useMemo(() => {
    const current = syncProgress.find((step) => step.status === 'process');
    return current ? t(current.titleKey) : null;
  }, [syncProgress, t]);

  const syncProgressHeaderHint = useMemo(() => {
    if (syncing) {
      if (syncCurrentStepTitle) {
        return `${t('components.syncFromSource.syncProgressCurrent', {
          step: syncCurrentStepTitle,
        })} · ${t('components.syncFromSource.syncProgressElapsed', {
          seconds: syncElapsedSec,
        })}`;
      }
      return `${t('components.syncFromSource.syncingInProgress')} · ${t(
        'components.syncFromSource.syncProgressElapsed',
        { seconds: syncElapsedSec },
      )}`;
    }
    if (syncProgress.some((step) => step.status === 'error')) {
      return t(config.failedKey);
    }
    if (syncProgress.some((step) => step.status === 'skip')) {
      return t('components.syncFromSource.inactiveSourceHint');
    }
    if (
      syncProgress.length > 0 &&
      syncProgress.every((step) => step.status === 'finish')
    ) {
      return t('components.syncFromSource.syncProgressDone');
    }
    return null;
  }, [config.failedKey, syncCurrentStepTitle, syncElapsedSec, syncProgress, syncing, t]);

  const formatStepResult = useCallback(
    (result: SyncFromSourceResult) => {
      const modeLabel =
        result.mode === 'incremental'
          ? t('components.syncFromSource.stepModeIncremental')
          : result.mode === 'full'
            ? t('components.syncFromSource.stepModeFull')
            : null;
      const fetched =
        typeof result.fetched === 'number'
          ? t('components.syncFromSource.stepFetched', { count: result.fetched })
          : null;
      const counts = t('components.syncFromSource.prerequisiteStepResult', {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      });
      const head = [modeLabel, fetched].filter(Boolean).join(' · ');
      let text = head ? `${head} · ${counts}` : counts;
      if (
        typeof result.fetched === 'number' &&
        result.fetched === 0 &&
        result.mode === 'incremental' &&
        result.created + result.updated + result.failed === 0
      ) {
        text = `${text}；${t('components.syncFromSource.stepIncrementalEmpty')}`;
      }
      if (result.failed > 0 && result.errors?.length) {
        const sample = result.errors.slice(0, 2).join('；');
        text = `${text}；${sample}`;
      }
      return text;
    },
    [t],
  );

  const targetFieldValues = useMemo(
    () => config.targetFields.map((field) => field.value),
    [config.targetFields],
  );

  const resetPreview = useCallback(() => {
    setPreviewRows([]);
    setPreviewColumns([]);
    setTargetToSource({});
  }, []);

  const applyBinding = useCallback(
    (binding: SyncBinding, columns: string[]) => {
      if (binding.source_type === 'api' || binding.source_type === 'dataset') {
        setSourceType(binding.source_type);
      }
      if (binding.api_uuid) setSelectedApiUuid(binding.api_uuid);
      if (binding.dataset_uuid) setSelectedDatasetUuid(binding.dataset_uuid);
      const fromBinding = mappingFromBinding(columns, binding.field_mapping || {});
      const suggested = suggestTargetToSourceMapping(columns, targetFieldValues);
      setTargetToSource({ ...suggested, ...fromBinding });
    },
    [targetFieldValues],
  );

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const apiOpts: { label: string; value: string }[] = [];
      let apiPage = 1;
      while (apiPage <= 50) {
        const res = await getAPIList({ page: apiPage, page_size: 100, is_active: true });
        apiOpts.push(
          ...res.items.map((item) => ({
            label: `${item.name} (${item.code})`,
            value: item.uuid,
          })),
        );
        if (res.items.length < 100 || apiOpts.length >= res.total) break;
        apiPage += 1;
      }
      setApiOptions(apiOpts);

      const dsOpts: { label: string; value: string }[] = [];
      let dsPage = 1;
      while (dsPage <= 50) {
        const res = await getDatasetList({ page: dsPage, page_size: 100, is_active: true });
        dsOpts.push(
          ...res.items.map((item) => ({
            label: `${item.name} (${item.code})`,
            value: item.uuid,
          })),
        );
        if (res.items.length < 100 || dsOpts.length >= res.total) break;
        dsPage += 1;
      }
      setDatasetOptions(dsOpts);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : t('components.syncFromSource.loadOptionsFailed'),
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    if (!open) return;
    resetPreview();
    setSaveBinding(true);
    setSyncProgress([]);
    setSyncMode('manual_full');
    setScheduleIntervalMinutes(15);
    setBindingMeta(null);
    setHasSavedMapping(false);
    void loadOptions();
    void config
      .getBinding()
      .then((binding) => {
        if (binding.source_type) setSourceType(binding.source_type);
        if (binding.api_uuid) setSelectedApiUuid(binding.api_uuid);
        if (binding.dataset_uuid) setSelectedDatasetUuid(binding.dataset_uuid);
        if (binding.sync_mode) setSyncMode(binding.sync_mode);
        if (binding.schedule_interval_minutes) {
          setScheduleIntervalMinutes(binding.schedule_interval_minutes);
        }
        setBindingMeta({
          last_success_at: binding.last_success_at,
          last_attempt_at: binding.last_attempt_at,
          last_error: binding.last_error,
        });
        const saved = binding.field_mapping || {};
        if (Object.keys(saved).length > 0) {
          setTargetToSource(mappingFromBinding([], saved));
          setHasSavedMapping(true);
        }
      })
      .catch(() => undefined);
  }, [open, loadOptions, resetPreview, config]);

  const handlePreview = async () => {
    if (sourceType === 'api' && !selectedApiUuid) {
      messageApi.warning(t('components.syncFromSource.selectApiFirst'));
      return;
    }
    if (sourceType === 'dataset' && !selectedDatasetUuid) {
      messageApi.warning(t('components.syncFromSource.selectDatasetFirst'));
      return;
    }

    setExecuting(true);
    resetPreview();
    try {
      let rows: Record<string, unknown>[] = [];
      if (sourceType === 'api' && selectedApiUuid) {
        const apiDetail = await getAPIByUuid(selectedApiUuid);
        const previewBody = withKingdeePreviewLimit(
          apiDetail.request_body as Record<string, unknown> | null | undefined,
          SYNC_PREVIEW_ROW_LIMIT,
        );
        const result = await testAPI(
          selectedApiUuid,
          previewBody ? { body: previewBody } : {},
        );
        if (result.status_code < 200 || result.status_code >= 300) {
          const detail =
            typeof result.body === 'object' && result.body && 'error' in result.body
              ? String((result.body as Record<string, unknown>).error)
              : `HTTP ${result.status_code}`;
          throw new Error(detail);
        }
        const columnNames = extractKingdeeFieldKeys(apiDetail.request_body);
        rows = normalizeApiBodyToRows(result.body, columnNames).slice(
          0,
          SYNC_PREVIEW_ROW_LIMIT,
        );
      } else if (sourceType === 'dataset' && selectedDatasetUuid) {
        const res = await executeDatasetQuery(selectedDatasetUuid, {
          limit: SYNC_PREVIEW_ROW_LIMIT,
          offset: 0,
        });
        if (!res.success) throw new Error(res.error || t('components.syncFromSource.queryFailed'));
        rows = ((res.data || []) as Record<string, unknown>[]).slice(
          0,
          SYNC_PREVIEW_ROW_LIMIT,
        );
      }

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      setPreviewRows(rows);
      setPreviewColumns(columns);

      const binding = await config.getBinding().catch(() => null);
      if (binding?.field_mapping && Object.keys(binding.field_mapping).length > 0) {
        applyBinding(binding, columns);
      } else {
        setTargetToSource(suggestTargetToSourceMapping(columns, targetFieldValues));
      }
      messageApi.success(t('components.syncFromSource.previewOk', { count: rows.length }));
    } catch (error: unknown) {
      const detail = formatSyncErrorMessage(error, t('components.syncFromSource.queryFailed'));
      if (isInactiveSyncSourceError(error)) {
        messageApi.info(detail);
      } else {
        messageApi.error(detail);
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleSync = async () => {
    // 打开弹窗后绑定可能仍在加载；确认前再兜一次保存的映射
    let effectiveTargetToSource = targetToSource;
    if (Object.keys(effectiveTargetToSource).length === 0) {
      const binding = await config.getBinding().catch(() => null);
      const saved = binding?.field_mapping || {};
      if (Object.keys(saved).length > 0) {
        effectiveTargetToSource = mappingFromBinding([], saved);
        setTargetToSource(effectiveTargetToSource);
        setHasSavedMapping(true);
      }
    }

    const mappingError = config.validateMapping
      ? config.validateMapping(effectiveTargetToSource, t)
      : (() => {
          for (const required of config.requiredTargets) {
            if (!effectiveTargetToSource[required]) {
              const label = config.targetFields.find((field) => field.value === required)?.labelKey;
              return t('components.syncFromSource.mappingRequired', {
                field: label ? t(label) : required,
              });
            }
          }
          return null;
        })();
    if (mappingError) {
      messageApi.warning(mappingError);
      return;
    }
    if (sourceType === 'api' && !selectedApiUuid) {
      messageApi.warning(t('components.syncFromSource.selectApiFirst'));
      return;
    }
    if (sourceType === 'dataset' && !selectedDatasetUuid) {
      messageApi.warning(t('components.syncFromSource.selectDatasetFirst'));
      return;
    }

    const effectiveFieldMapping = invertFieldMapping(effectiveTargetToSource);

    setSyncing(true);
    const prerequisiteSteps = config.prerequisiteSteps ?? [];
    const mainStepId = 'main';
    const progressItems: SyncProgressItem[] = [
      ...prerequisiteSteps.map((step) => ({
        id: step.id,
        titleKey: step.titleKey,
        status: 'wait' as const,
      })),
      {
        id: mainStepId,
        titleKey: config.mainStepTitleKey ?? config.titleKey,
        status: 'wait' as const,
      },
    ];
    setSyncProgress(progressItems);

    let progressState = [...progressItems];
    const patchProgress = (id: string, patch: Partial<SyncProgressItem>) => {
      progressState = progressState.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      setSyncProgress([...progressState]);
    };

    try {
      for (const step of prerequisiteSteps) {
          patchProgress(step.id, {
            status: 'process',
            description: t('components.syncFromSource.stepWorking'),
          });
          try {
            const binding = await step.getBinding();
            const hasBinding =
              Boolean(binding.source_type) &&
              Boolean(binding.field_mapping) &&
              Object.keys(binding.field_mapping).length > 0;
            if (!hasBinding) {
              patchProgress(step.id, {
                status: 'skip',
                description: t('components.syncFromSource.prerequisiteNotConfigured'),
              });
              continue;
            }
            // 关联同步：有成功水位则只拉增量；流式回报当前处理事务
            patchProgress(step.id, {
              status: 'process',
              description: t('components.syncFromSource.stepConnecting'),
            });
            const stepResult = await step.syncFromSource(
              {
                save_binding: false,
                incremental: true,
                active_only: activeOnly,
              },
              (message) => {
                patchProgress(step.id, {
                  status: 'process',
                  description: message,
                });
              },
            );
            patchProgress(step.id, {
              status: stepResult.failed > 0 ? 'error' : 'finish',
              description: formatStepResult(stepResult),
            });
          } catch (error: unknown) {
          const detail = formatSyncErrorMessage(error, t(config.failedKey));
          if (isInactiveSyncSourceError(error)) {
            patchProgress(step.id, {
              status: 'skip',
              description: detail,
            });
          } else {
            patchProgress(step.id, {
              status: 'error',
              description: detail,
            });
          }
        }
      }

      patchProgress(mainStepId, {
        status: 'process',
        description: t('components.syncFromSource.stepConnecting'),
      });

      const result = await config.syncFromSource(
        {
          source_type: sourceType,
          api_uuid: sourceType === 'api' ? selectedApiUuid : undefined,
          dataset_uuid: sourceType === 'dataset' ? selectedDatasetUuid : undefined,
          field_mapping: effectiveFieldMapping,
          save_binding: saveBinding,
          skip_prerequisite_syncs: config.skipBackendPrerequisites ?? prerequisiteSteps.length > 0,
          sync_mode: syncMode,
          schedule_interval_minutes: scheduleIntervalMinutes,
          // 与「同步方式」一致：定时增量时按 last_success_at 水位拉变更，勿硬编码全量
          incremental: syncMode === 'scheduled_incremental',
          active_only: activeOnly,
        },
        (message) => {
          patchProgress(mainStepId, {
            status: 'process',
            description: message,
          });
        },
      );

      patchProgress(mainStepId, {
        status: result.failed > 0 ? 'error' : 'finish',
        description: formatStepResult(result),
      });

      onComplete?.(result);
      if (result.failed > 0) {
        messageApi.warning(
          t(config.completePartialKey, {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            failed: result.failed,
          }),
        );
      } else {
        messageApi.success(
          t(config.completeSuccessKey, {
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
          }),
        );
      }
      onClose();
    } catch (error: unknown) {
      const detail = formatSyncErrorMessage(error, t(config.failedKey));
      if (isInactiveSyncSourceError(error)) {
        patchProgress(mainStepId, {
          status: 'skip',
          description: detail,
        });
        messageApi.info(t('components.syncFromSource.inactiveSourceHint'));
      } else {
        patchProgress(mainStepId, {
          status: 'error',
          description: detail,
        });
        messageApi.error(detail);
      }
    } finally {
      setSyncing(false);
    }
  };

  const mappingRows = config.targetFields.map((field) => ({
    key: field.value,
    target: field.value,
    label: t(field.labelKey),
    required: field.required ?? config.requiredTargets.includes(field.value),
  }));

  const previewTableColumns = previewColumns.map((col) => {
    const mappedTarget = Object.entries(targetToSource).find(([, source]) => source === col)?.[0];
    return {
      title: mappedTarget ?? col,
      dataIndex: col,
      key: col,
      ellipsis: true,
      width: 140,
    };
  });

  return (
    <Modal
      title={t(config.titleKey)}
      open={open}
      onCancel={() => {
        if (syncing) return;
        onClose();
      }}
      zIndex={zIndex}
      width={960}
      destroyOnHidden
      footer={[
        <Button key="cancel" disabled={syncing} onClick={onClose}>
          {t('common.cancel')}
        </Button>,
        <Button
          key="preview"
          icon={<SyncOutlined />}
          loading={executing}
          onClick={() => void handlePreview()}
        >
          {t('components.syncFromSource.previewFetch')}
        </Button>,
        <Button key="sync" type="primary" loading={syncing} onClick={() => void handleSync()}>
          {t('components.syncFromSource.confirmSync')}
        </Button>,
      ]}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {config.hintKey ? <Alert type="info" showIcon title={t(config.hintKey)} /> : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <ThemedSegmented
            value={sourceType}
            onChange={(value) => {
              setSourceType(value as SyncSourceType);
              resetPreview();
            }}
            options={[
              { label: t('components.syncFromSource.sourceApi'), value: 'api' },
              { label: t('components.syncFromSource.sourceDataset'), value: 'dataset' },
            ]}
          />
          <Checkbox checked={saveBinding} onChange={(event) => setSaveBinding(event.target.checked)}>
            {t('components.syncFromSource.saveBinding')}
          </Checkbox>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space size="middle" align="center">
            <Typography.Text>{t('components.syncFromSource.activeOnly')}</Typography.Text>
            <Switch
              checked={activeOnly}
              onChange={setActiveOnly}
              checkedChildren={t('components.syncFromSource.activeOnlyOn')}
              unCheckedChildren={t('components.syncFromSource.activeOnlyOff')}
            />
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12, flex: 1, minWidth: 240 }}>
            {t(
              activeOnly
                ? 'components.syncFromSource.activeOnlyHintOn'
                : 'components.syncFromSource.activeOnlyHintOff',
            )}
          </Typography.Text>
        </div>

        <div style={SYNC_FIELD_GRID_STYLE}>
          <Typography.Text type="secondary" style={SYNC_FIELD_LABEL_STYLE}>
            {t('components.syncFromSource.syncMode')}
          </Typography.Text>
          <div style={SYNC_FIELD_CONTROL_STYLE}>
            <Select
              style={{ width: 220 }}
              value={syncMode}
              onChange={setSyncMode}
              options={[
                {
                  value: 'manual_full',
                  label: t('components.syncFromSource.syncMode.manualFull'),
                },
                {
                  value: 'scheduled_incremental',
                  label: t('components.syncFromSource.syncMode.scheduledIncremental'),
                },
                {
                  value: 'scheduled_full',
                  label: t('components.syncFromSource.syncMode.scheduledFull'),
                },
              ]}
            />
            {syncMode !== 'manual_full' ? (
              <>
                <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                  {t('components.syncFromSource.scheduleInterval')}
                </Typography.Text>
                <Select
                  style={{ width: 140 }}
                  value={scheduleIntervalMinutes}
                  onChange={setScheduleIntervalMinutes}
                  options={[
                    { value: 5, label: t('components.syncFromSource.intervalMinutes', { n: 5 }) },
                    { value: 15, label: t('components.syncFromSource.intervalMinutes', { n: 15 }) },
                    { value: 60, label: t('components.syncFromSource.intervalMinutes', { n: 60 }) },
                    { value: 360, label: t('components.syncFromSource.intervalMinutes', { n: 360 }) },
                  ]}
                />
              </>
            ) : null}
          </div>

          <span />
          <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {t(
              syncMode === 'scheduled_incremental'
                ? 'components.syncFromSource.syncMode.incrementalHint'
                : 'components.syncFromSource.syncMode.fullHint',
            )}
          </Typography.Text>

          {sourceType === 'api' ? (
            <>
              <Typography.Text type="secondary" style={SYNC_FIELD_LABEL_STYLE}>
                {t('components.syncFromSource.selectApi')}
              </Typography.Text>
              <div style={SYNC_FIELD_CONTROL_STYLE}>
                <Select
                  style={{ width: '100%', maxWidth: 420 }}
                  placeholder={t('components.syncFromSource.selectApiPlaceholder')}
                  loading={loadingOptions}
                  options={apiOptions}
                  value={selectedApiUuid}
                  onChange={(value) => {
                    setSelectedApiUuid(value);
                    resetPreview();
                  }}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                />
              </div>
            </>
          ) : (
            <>
              <Typography.Text type="secondary" style={SYNC_FIELD_LABEL_STYLE}>
                {t('components.syncFromSource.selectDataset')}
              </Typography.Text>
              <div style={SYNC_FIELD_CONTROL_STYLE}>
                <Select
                  style={{ width: '100%', maxWidth: 420 }}
                  placeholder={t('components.syncFromSource.selectDatasetPlaceholder')}
                  loading={loadingOptions}
                  options={datasetOptions}
                  value={selectedDatasetUuid}
                  onChange={(value) => {
                    setSelectedDatasetUuid(value);
                    resetPreview();
                  }}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                />
              </div>
            </>
          )}
        </div>

        {!syncing && (bindingMeta?.last_success_at || bindingMeta?.last_error) ? (
          <Alert
            type={bindingMeta.last_error ? 'warning' : 'success'}
            showIcon
            title={
              bindingMeta.last_error
                ? t('components.syncFromSource.lastError', { error: bindingMeta.last_error })
                : t('components.syncFromSource.lastSuccess', {
                    time: formatDateTimeBySiteSetting(bindingMeta.last_success_at),
                  })
            }
          />
        ) : null}

        {hasSavedMapping && previewRows.length === 0 && !syncing ? (
          <Alert
            type="info"
            showIcon
            title={t('components.syncFromSource.savedMappingReady')}
          />
        ) : null}

        {sourceType === 'api' ? (
          <Typography.Text type="secondary">
            {t(config.apiRealtimeHintKey ?? 'components.syncFromSource.apiRealtimeHintDefault')}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            {t(config.datasetBatchHintKey ?? 'components.syncFromSource.datasetBatchHintDefault')}
          </Typography.Text>
        )}

        {syncing || syncProgress.length > 0 ? (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.02))',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              <Typography.Text strong>
                {t('components.syncFromSource.syncProgressTitle')}
              </Typography.Text>
              <Typography.Text type="secondary">
                {syncProgressHeaderHint}
              </Typography.Text>
            </div>
            <Progress
              percent={syncProgressPercent}
              status={syncProgressStatus}
              showInfo
            />
            {syncProgress.length > 0 ? (
              <Steps
                orientation="vertical"
                size="small"
                style={{ marginTop: 12 }}
                items={syncProgress.map((step) => ({
                  title: t(step.titleKey),
                  status:
                    step.status === 'skip'
                      ? 'wait'
                      : step.status === 'process'
                        ? 'process'
                        : step.status,
                  description:
                    step.status === 'skip' ? (
                      <Typography.Text type="secondary">{step.description}</Typography.Text>
                    ) : (
                      step.description
                    ),
                }))}
              />
            ) : null}
          </div>
        ) : null}

        {executing && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin description={t('components.syncFromSource.fetching')} />
          </div>
        )}

        {!executing && previewRows.length > 0 && (
          <>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t('components.syncFromSource.fieldMapping')}
            </Typography.Title>
            <Table
              size="small"
              pagination={false}
              dataSource={mappingRows}
              columns={[
                {
                  title: t(config.targetFieldLabelKey ?? 'components.syncFromSource.targetFieldLabel'),
                  dataIndex: 'label',
                  width: 180,
                  render: (text, record) => (
                    <span>
                      {text}
                      {record.required ? <Typography.Text type="danger"> *</Typography.Text> : null}
                    </span>
                  ),
                },
                {
                  title: t('components.syncFromSource.sourceColumn'),
                  dataIndex: 'target',
                  render: (target: string) => (
                    <Select
                      style={{ width: '100%' }}
                      allowClear
                      showSearch
                      placeholder={t('components.syncFromSource.sourceColumnPlaceholder')}
                      options={previewColumns.map((col) => ({ label: col, value: col }))}
                      value={targetToSource[target]}
                      onChange={(value) => {
                        setTargetToSource((prev) => {
                          const next = { ...prev };
                          for (const [key, src] of Object.entries(next)) {
                            if (src === value && key !== target) delete next[key];
                          }
                          if (value) next[target] = value;
                          else delete next[target];
                          return next;
                        });
                      }}
                    />
                  ),
                },
              ]}
            />

            <Typography.Title level={5} style={{ margin: 0 }}>
              {t('components.syncFromSource.previewData', { count: previewRows.length })}
            </Typography.Title>
            <Table
              size="small"
              scroll={{ x: 'max-content', y: 240 }}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              dataSource={previewRows.map((row, index) => ({ ...row, key: index }))}
              columns={previewTableColumns}
            />
          </>
        )}
      </Space>
    </Modal>
  );
};

export default SyncFromSourceModal;
