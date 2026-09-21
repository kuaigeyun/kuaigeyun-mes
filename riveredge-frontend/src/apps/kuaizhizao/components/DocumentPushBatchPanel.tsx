/**
 * 统一外推批次面板（标准形态以工单推送为准）：
 * UniPullQueryModal 多选候选 → profile 多选 →（金蝶）连接器/Save 接口 → 预览 dry-run → /document-push。
 * SyncPushHub 内嵌时设 embedded。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Col, Flex, Modal, Row, Select, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  UniPullQueryModal,
  useUniPullQuery,
} from '../../../components/uni-pull-query';
import { DocumentPushUnavailablePanel } from '../../../components/sync-push-hub';
import {
  getApplicationConnectionListAll,
  type ApplicationConnection,
} from '../../../services/applicationConnection';
import { getAPIList, type API } from '../../../services/apiManagement';
import {
  filterProfilesForSource,
  listDocumentPushProfiles,
  pushDocumentExternal,
  resolveDefaultTargetProfiles,
} from '../services/document-push';

export const DOCUMENT_PUSH_PROFILE_LABEL_KEYS: Record<string, string> = {
  kingdee_prd_mo: 'app.kuaizhizao.documentPush.profile.kingdee_prd_mo',
  oa_http_webhook: 'app.kuaizhizao.documentPush.profile.oa_http_webhook',
  feishu_im_notify: 'app.kuaizhizao.documentPush.profile.feishu_im_notify',
  kingdee_prd_morpt: 'app.kuaizhizao.documentPush.profile.kingdee_prd_morpt',
  kingdee_sal_saleorder: 'app.kuaizhizao.documentPush.profile.kingdee_sal_saleorder',
  kingdee_pur_purchaseorder: 'app.kuaizhizao.documentPush.profile.kingdee_pur_purchaseorder',
  kingdee_stk_miscellaneous: 'app.kuaizhizao.documentPush.profile.kingdee_stk_miscellaneous',
};

export interface DocumentPushBindingState {
  connection_code?: string;
  save_api_uuid?: string;
  sync_mode?: string;
  schedule_interval_minutes?: number;
}

export interface DocumentPushBatchPanelProps<T extends { id: number }> {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  embedded?: boolean;
  preferIds?: number[];
  sourceType: string;
  /**
   * 偏好勾选（与 GET /document-push/profiles ∩ source 求交）。
   * 空数组 = 该 source 接口返回的全部已知 profile 作为默认；禁止写死「仅金蝶」。
   */
  defaultProfiles?: string[];
  /** 勾选后需要金蝶连接器 + Save 接口的 profile */
  kingdeeProfiles?: string[];
  title: string;
  hint: string;
  pipelineDesc: string;
  searchPlaceholder: string;
  needSelectMessage: string;
  confirmText?: string;
  columns: TableColumnsType<T>;
  getRowLabel: (row: T) => string;
  loadCandidates: (params: {
    keyword: string;
    page: number;
    pageSize: number;
    preferIds: number[];
  }) => Promise<{ data: T[]; total: number }>;
  matchSaveApi?: (api: API, connection: ApplicationConnection) => boolean;
  preferSaveApi?: (items: API[]) => string | undefined;
  saveApiSearchHints?: string[];
  loadBinding?: () => Promise<DocumentPushBindingState | null | undefined>;
  saveBinding?: (payload: DocumentPushBindingState) => Promise<unknown>;
  showScheduleControls?: boolean;
  successCountKey?: string;
  partialCountKey?: string;
  failedTitleKey?: string;
  skippedHintKey?: string;
}

function defaultPreferSaveApi(items: API[]): string | undefined {
  return items[0]?.uuid;
}

const EMPTY_STRING_ARRAY: string[] = [];

export function DocumentPushBatchPanel<T extends { id: number }>({
  open,
  onClose,
  onComplete,
  embedded = false,
  preferIds,
  sourceType,
  defaultProfiles = EMPTY_STRING_ARRAY,
  kingdeeProfiles = EMPTY_STRING_ARRAY,
  title,
  hint,
  pipelineDesc,
  searchPlaceholder,
  needSelectMessage,
  confirmText,
  columns,
  getRowLabel,
  loadCandidates,
  matchSaveApi,
  preferSaveApi = defaultPreferSaveApi,
  saveApiSearchHints = EMPTY_STRING_ARRAY,
  loadBinding,
  saveBinding,
  showScheduleControls = false,
  successCountKey = 'app.kuaizhizao.documentPush.batch.success',
  partialCountKey = 'app.kuaizhizao.documentPush.batch.partial',
  failedTitleKey = 'app.kuaizhizao.documentPush.pushFailed',
  skippedHintKey = 'app.kuaizhizao.documentPush.batch.skippedHint',
}: DocumentPushBatchPanelProps<T>): React.ReactElement | null {
  // 关闭态直接不渲染：hooks 仍执行，但下方网络 effect 均以 open 门控
  // （embedded Hub 在 push Tab 未激活时由上层不挂载本组件）
  const { t } = useTranslation();
  const [connectors, setConnectors] = useState<ApplicationConnection[]>([]);
  const [connectionCode, setConnectionCode] = useState<string | undefined>();
  const [saveApis, setSaveApis] = useState<API[]>([]);
  const [saveApiUuid, setSaveApiUuid] = useState<string | undefined>();
  const [syncMode, setSyncMode] = useState<string>('manual_full');
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] = useState<number>(15);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [apisLoading, setApisLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [targetProfiles, setTargetProfiles] = useState<string[]>([]);
  const [profileOptions, setProfileOptions] = useState<Array<{ label: string; value: string }>>([]);
  const preferIdsRef = useRef<number[]>([]);
  const prefilledRef = useRef(false);
  const bindingLoadedRef = useRef(false);
  const connectionCodeRef = useRef<string | undefined>();
  const saveApiUuidRef = useRef<string | undefined>();
  const syncModeRef = useRef('manual_full');
  const scheduleIntervalRef = useRef(15);
  const targetProfilesRef = useRef<string[]>([]);
  const profileOptionsRef = useRef<Array<{ label: string; value: string }>>([]);
  connectionCodeRef.current = connectionCode;
  saveApiUuidRef.current = saveApiUuid;
  syncModeRef.current = syncMode;
  scheduleIntervalRef.current = scheduleIntervalMinutes;
  targetProfilesRef.current = targetProfiles;
  profileOptionsRef.current = profileOptions;

  const needsKingdeeConnector = useMemo(
    () => targetProfiles.some((p) => kingdeeProfiles.includes(p)),
    [kingdeeProfiles, targetProfiles],
  );

  const selectedConnector = useMemo(
    () => connectors.find((row) => row.code === connectionCode),
    [connectionCode, connectors],
  );

  const profileLabel = useCallback(
    (profile: string) => {
      const key = DOCUMENT_PUSH_PROFILE_LABEL_KEYS[profile];
      if (key) return t(key);
      return profile;
    },
    [t],
  );

  const loadConnectors = useCallback(async () => {
    setConnectorsLoading(true);
    try {
      const rows = await getApplicationConnectionListAll({
        type: 'kingdee_galaxy',
        is_active: true,
      });
      setConnectors(rows);
      setConnectionCode((prev) => {
        if (prev && rows.some((row) => row.code === prev)) return prev;
        return rows[0]?.code;
      });
    } catch {
      setConnectors([]);
      setConnectionCode(undefined);
    } finally {
      setConnectorsLoading(false);
    }
  }, []);

  // 内容稳定的字符串 key：父页常传内联数组，引用变化不得触发重复请求
  const defaultProfilesKey = defaultProfiles.join('|');
  const saveApiHintsKey = saveApiSearchHints.join('|');
  const saveApiSearchHintsRef = useRef(saveApiSearchHints);
  saveApiSearchHintsRef.current = saveApiSearchHints;
  const defaultProfilesRef = useRef(defaultProfiles);
  defaultProfilesRef.current = defaultProfiles;
  const profileLabelRef = useRef(profileLabel);
  profileLabelRef.current = profileLabel;

  const loadSaveApis = useCallback(
    async (connection: ApplicationConnection | undefined) => {
      if (!connection || !matchSaveApi) {
        setSaveApis([]);
        setSaveApiUuid(undefined);
        return;
      }
      setApisLoading(true);
      try {
        const res = await getAPIList({
          is_active: true,
          page: 1,
          page_size: 100,
        });
        let items = (res.items || []).filter((api) => matchSaveApi(api, connection));
        for (const hint of saveApiSearchHintsRef.current) {
          if (items.length) break;
          const byHint = await getAPIList({
            is_active: true,
            page: 1,
            page_size: 100,
            search: hint,
          });
          items = (byHint.items || []).filter((api) => matchSaveApi(api, connection));
        }
        setSaveApis(items);
        setSaveApiUuid((prev) => {
          if (prev && items.some((api) => api.uuid === prev)) return prev;
          return preferSaveApi(items);
        });
      } catch {
        setSaveApis([]);
        setSaveApiUuid(undefined);
      } finally {
        setApisLoading(false);
      }
    },
    // saveApiHintsKey：内容变才重建；避免内联 ['生产汇报',…] 每帧换引用
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hints via ref + key
    [matchSaveApi, preferSaveApi, saveApiHintsKey],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const preferred = defaultProfilesRef.current;
    const labelOf = profileLabelRef.current;
    setProfilesLoading(true);
    setProfilesLoaded(false);
    void (async () => {
      try {
        const rows = await listDocumentPushProfiles();
        if (cancelled) return;
        // 仅展示接口 ∩ 已知 SUPPORTED profile；不把 connector 目录品类当目标
        const available = filterProfilesForSource(rows, sourceType);
        const opts = available.map((value) => ({
          value,
          label: labelOf(value),
        }));
        setProfileOptions(opts);
        setTargetProfiles(resolveDefaultTargetProfiles(available, preferred));
      } catch {
        if (cancelled) return;
        // 失败时禁止回退到硬编码默认（避免伪造成功可推）
        setProfileOptions([]);
        setTargetProfiles([]);
      } finally {
        if (!cancelled) {
          setProfilesLoading(false);
          setProfilesLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // defaultProfilesKey / 不用 profileLabel：父页重渲染不得重复拉 profiles
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable keys
  }, [defaultProfilesKey, open, sourceType]);

  useEffect(() => {
    // 关闭态 / 非金蝶目标不拉 /core/apis，避免列表页或 sync Tab 误打
    if (!open || !needsKingdeeConnector) return;
    void loadSaveApis(selectedConnector);
  }, [loadSaveApis, needsKingdeeConnector, open, selectedConnector]);

  useEffect(() => {
    if (!open || bindingLoadedRef.current || !loadBinding) return;
    bindingLoadedRef.current = true;
    void (async () => {
      try {
        const binding = await loadBinding();
        if (!binding) return;
        if (binding.connection_code) setConnectionCode(binding.connection_code);
        if (binding.save_api_uuid) setSaveApiUuid(binding.save_api_uuid);
        if (binding.sync_mode) setSyncMode(binding.sync_mode);
        if (binding.schedule_interval_minutes) {
          setScheduleIntervalMinutes(binding.schedule_interval_minutes);
        }
      } catch {
        // 无绑定则用默认
      }
    })();
  }, [loadBinding, open]);

  const allowedProfileSet = useMemo(
    () => new Set(profileOptions.map((o) => o.value)),
    [profileOptions],
  );

  const profilesReady = useMemo(() => {
    if (!profilesLoaded || profilesLoading) return false;
    if (!profileOptions.length || !targetProfiles.length) return false;
    return targetProfiles.every((p) => allowedProfileSet.has(p));
  }, [
    allowedProfileSet,
    profileOptions.length,
    profilesLoaded,
    profilesLoading,
    targetProfiles,
  ]);

  const connectorReady = useMemo(() => {
    if (!needsKingdeeConnector) return true;
    if (connectorsLoading) return false;
    if (!connectionCode) return false;
    if (matchSaveApi) {
      if (apisLoading) return false;
      if (!saveApiUuid) return false;
    }
    return true;
  }, [
    apisLoading,
    connectionCode,
    connectorsLoading,
    matchSaveApi,
    needsKingdeeConnector,
    saveApiUuid,
  ]);

  const pushReady = profilesReady && connectorReady;
  const pushReadyRef = useRef(pushReady);
  pushReadyRef.current = pushReady;

  const notReadyReason = useMemo(() => {
    if (!profilesLoaded || profilesLoading) {
      return t('app.kuaizhizao.documentPush.batch.profilesLoading');
    }
    if (!profileOptions.length) {
      return t('app.kuaizhizao.documentPush.batch.noProfiles');
    }
    if (!targetProfiles.length || !targetProfiles.every((p) => allowedProfileSet.has(p))) {
      return t('app.kuaizhizao.documentPush.batch.needTargetProfile');
    }
    if (needsKingdeeConnector && !connectionCode) {
      return t('app.kuaizhizao.documentPush.batch.needConnector');
    }
    if (needsKingdeeConnector && matchSaveApi && !saveApiUuid) {
      return t('app.kuaizhizao.documentPush.batch.needApi');
    }
    return null;
  }, [
    allowedProfileSet,
    connectionCode,
    matchSaveApi,
    needsKingdeeConnector,
    profileOptions.length,
    profilesLoaded,
    profilesLoading,
    saveApiUuid,
    t,
    targetProfiles,
  ]);

  const pull = useUniPullQuery<T>({
    rowKey: 'id',
    selectionType: 'checkbox',
    loadData: async ({ keyword, page, pageSize }) => {
      const res = await loadCandidates({
        keyword,
        page,
        pageSize,
        preferIds: preferIdsRef.current,
      });
      return { data: res.data || [], total: res.total || 0 };
    },
    onConfirm: async (_keys, rows) => {
      // 未就绪禁止推送与成功 toast
      if (!pushReadyRef.current) {
        Modal.warning({
          title,
          content: notReadyReason || t('components.syncPushHub.pushNotReady'),
        });
        return;
      }
      const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) {
        Modal.warning({ title, content: needSelectMessage });
        return;
      }
      const conn = connectionCodeRef.current;
      const apiUuid = saveApiUuidRef.current;
      const allowed = new Set(profileOptionsRef.current.map((o) => o.value));
      const profiles = targetProfilesRef.current.filter((p) => p && allowed.has(p));
      if (!profiles.length) {
        Modal.warning({
          title,
          content: t('app.kuaizhizao.documentPush.batch.needTargetProfile'),
        });
        return;
      }
      const needKd = profiles.some((p) => kingdeeProfiles.includes(p));
      if (needKd && !conn) {
        Modal.warning({
          title,
          content: t('app.kuaizhizao.documentPush.batch.needConnector'),
        });
        return;
      }
      if (needKd && matchSaveApi && !apiUuid) {
        Modal.warning({
          title,
          content: t('app.kuaizhizao.documentPush.batch.needApi'),
        });
        return;
      }
      try {
        if (needKd && conn && apiUuid && saveBinding) {
          await saveBinding({
            connection_code: conn,
            save_api_uuid: apiUuid,
            sync_mode: syncModeRef.current,
            schedule_interval_minutes: scheduleIntervalRef.current,
          });
        }

        let created = 0;
        let skipped = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const id of ids) {
          try {
            const result = await pushDocumentExternal({
              source_type: sourceType,
              source_id: id,
              target_profiles: profiles,
              connection_code: needKd ? conn : undefined,
              save_api_uuid: needKd ? apiUuid : undefined,
              dry_run: false,
            });
            if (result.multi) {
              created += Number(result.created || 0);
              skipped += Number(result.skipped || 0);
              failed += Number(result.failed || 0);
              for (const one of result.results || []) {
                if (one.success === false) {
                  errors.push(
                    `${id}/${one.target_profile}: ${one.message || t(failedTitleKey)}`,
                  );
                }
              }
            } else if (result.success === false) {
              failed += 1;
              errors.push(`${id}: ${result.message || t(failedTitleKey)}`);
            } else if (result.skipped) {
              skipped += 1;
            } else {
              created += 1;
            }
          } catch (err: unknown) {
            failed += 1;
            const msg = err instanceof Error ? err.message : String(err || '');
            errors.push(`${id}: ${msg || t(failedTitleKey)}`);
          }
        }

        if (failed > 0 && created === 0) {
          Modal.error({
            title: t(failedTitleKey),
            content: (
              <div>
                {errors.slice(0, 5).map((err) => (
                  <Typography.Paragraph key={err} type="danger" style={{ marginBottom: 4 }}>
                    {err}
                  </Typography.Paragraph>
                ))}
              </div>
            ),
          });
          return;
        }
        if (failed > 0) {
          Modal.warning({
            title: t(partialCountKey, { created, skipped, failed }),
            content: errors.slice(0, 5).join('\n') || undefined,
          });
        } else {
          Modal.success({
            title: t(successCountKey, { count: created }),
            content: skipped > 0 ? t(skippedHintKey, { skipped }) : undefined,
          });
        }
        onComplete?.();
        onClose();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error || '');
        Modal.error({
          title: t(failedTitleKey),
          content: msg || t(failedTitleKey),
        });
      }
    },
    onClose,
  });

  useEffect(() => {
    if (open) {
      preferIdsRef.current = (preferIds || []).filter((id) => Number.isFinite(id));
      prefilledRef.current = false;
      bindingLoadedRef.current = false;
      void loadConnectors();
      pull.openModal();
      return;
    }
    if (pull.open) {
      pull.resetModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只跟随外部 open
  }, [open]);

  useEffect(() => {
    if (!open || prefilledRef.current || !preferIdsRef.current.length || !pull.dataSource.length) {
      return;
    }
    const preferSet = new Set(preferIdsRef.current);
    const rows = pull.dataSource.filter((row) => preferSet.has(row.id));
    if (!rows.length) return;
    pull.handleSelectedRowKeysChange(
      rows.map((row) => row.id),
      rows,
    );
    prefilledRef.current = true;
  }, [open, pull.dataSource, pull.handleSelectedRowKeysChange]);

  const handlePreviewPayload = useCallback(async () => {
    if (!pushReadyRef.current) {
      Modal.warning({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: notReadyReason || t('components.syncPushHub.pushNotReady'),
      });
      return;
    }
    const rows = pull.selectedRows || [];
    const first = rows[0];
    if (!first?.id) {
      Modal.warning({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: t('app.kuaizhizao.documentPush.batch.previewNeedOne'),
      });
      return;
    }
    const conn = connectionCodeRef.current;
    const apiUuid = saveApiUuidRef.current;
    const allowed = new Set(profileOptionsRef.current.map((o) => o.value));
    const profiles = targetProfilesRef.current.filter((p) => p && allowed.has(p));
    if (!profiles.length) {
      Modal.warning({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: t('app.kuaizhizao.documentPush.batch.needTargetProfile'),
      });
      return;
    }
    const needKd = profiles.some((p) => kingdeeProfiles.includes(p));
    if (needKd && !conn) {
      Modal.warning({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: t('app.kuaizhizao.documentPush.batch.needConnector'),
      });
      return;
    }
    if (needKd && matchSaveApi && !apiUuid) {
      Modal.warning({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: t('app.kuaizhizao.documentPush.batch.needApi'),
      });
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await pushDocumentExternal({
        source_type: sourceType,
        source_id: Number(first.id),
        target_profiles: profiles,
        connection_code: needKd ? conn : undefined,
        save_api_uuid: needKd ? apiUuid : undefined,
        dry_run: true,
      });
      const model = (result.model || {}) as Record<string, unknown>;
      const profileLabelText = result.multi
        ? (result.target_profiles || profiles).map(profileLabel).join(', ')
        : profileLabel(String(result.target_profile || profiles[0]));
      Modal.info({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        width: 720,
        content: (
          <div>
            <Typography.Paragraph>
              profile=<Typography.Text code>{profileLabelText}</Typography.Text>
              {' · '}
              form_id=<Typography.Text code>{String(result.form_id || '—')}</Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph type="warning" style={{ marginBottom: 8 }}>
              {t('app.kuaizhizao.documentPush.previewSourceNote')}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <pre style={{ maxHeight: 360, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(result.multi ? result.results : model, null, 2)}
              </pre>
            </Typography.Paragraph>
          </div>
        ),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || '');
      Modal.error({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: msg || t(failedTitleKey),
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [
    failedTitleKey,
    kingdeeProfiles,
    matchSaveApi,
    notReadyReason,
    profileLabel,
    pull.selectedRows,
    sourceType,
    t,
  ]);

  const connectorOptions = useMemo(
    () =>
      connectors.map((row) => ({
        value: row.code,
        label: row.name ? `${row.name}（${row.code}）` : row.code,
      })),
    [connectors],
  );

  const apiOptions = useMemo(
    () =>
      saveApis.map((api) => ({
        value: api.uuid,
        label: api.name ? `${api.name}（${api.code}）` : api.code,
      })),
    [saveApis],
  );

  const { token } = theme.useToken();
  const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontSize: token.fontSizeSM,
    color: token.colorTextSecondary,
  };

  if (!open) return null;

  return (
    <UniPullQueryModal<T>
      open={pull.open}
      embedded={embedded}
      title={title}
      onCancel={pull.closeModal}
      onOk={pull.handleConfirm}
      confirmLoading={pull.confirmLoading}
      okButtonProps={{ disabled: !pushReady || pull.confirmLoading }}
      rowKey="id"
      columns={columns}
      dataSource={pull.dataSource}
      loading={pull.loading}
      selectionType="checkbox"
      selectedRowKeys={pull.selectedRowKeys}
      onSelectedRowKeysChange={pull.handleSelectedRowKeysChange}
      selectedRows={pull.selectedRows}
      getRowLabel={getRowLabel}
      searchDraft={pull.searchDraft}
      onSearchDraftChange={pull.setSearchDraft}
      onSearchApply={pull.handleSearchApply}
      onSearchClear={pull.handleSearchClear}
      appliedKeyword={pull.appliedKeyword}
      searchPlaceholder={searchPlaceholder}
      page={pull.page}
      pageSize={pull.pageSize}
      total={pull.total}
      onPageChange={pull.handlePageChange}
      okText={confirmText || t('app.kuaizhizao.documentPush.batch.confirm')}
      alert={
        <Flex vertical gap={8}>
          <Alert type="info" showIcon message={hint} description={pipelineDesc} />
          {!pushReady && profilesLoaded ? (
            <DocumentPushUnavailablePanel message={notReadyReason || undefined} />
          ) : null}
        </Flex>
      }
      filterExtraPlacement="block"
      filterExtra={
        <Flex vertical gap={8} style={{ width: '100%' }}>
          <Flex wrap="wrap" gap={8} align="center" justify="space-between">
            <Flex wrap="wrap" gap={8} align="center" style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                {t('app.kuaizhizao.documentPush.batch.targetProfiles')}
              </Typography.Text>
              <Checkbox.Group
                style={{ flex: 1, minWidth: 0 }}
                options={profileOptions}
                value={targetProfiles}
                disabled={profilesLoading || !profileOptions.length}
                onChange={(vals) => setTargetProfiles(vals.map(String))}
              />
            </Flex>
            <Button
              loading={previewLoading}
              disabled={!pushReady}
              onClick={() => void handlePreviewPayload()}
            >
              {t('app.kuaizhizao.documentPush.preview')}
            </Button>
          </Flex>
          {needsKingdeeConnector ? (
            <Row gutter={[12, 8]}>
              <Col xs={24} sm={12} md={8}>
                <Typography.Text style={fieldLabelStyle}>
                  {t('app.kuaizhizao.documentPush.batch.connectorPlaceholder')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  loading={connectorsLoading}
                  placeholder={t('app.kuaizhizao.documentPush.batch.connectorPlaceholder')}
                  options={connectorOptions}
                  value={connectionCode}
                  onChange={(value) => setConnectionCode(value)}
                  allowClear={false}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent={t('app.kuaizhizao.documentPush.batch.connectorEmpty')}
                />
              </Col>
              {matchSaveApi ? (
                <Col xs={24} sm={12} md={8}>
                  <Typography.Text style={fieldLabelStyle}>
                    {t('app.kuaizhizao.documentPush.batch.apiPlaceholder')}
                  </Typography.Text>
                  <Select
                    style={{ width: '100%' }}
                    loading={apisLoading}
                    placeholder={t('app.kuaizhizao.documentPush.batch.apiPlaceholder')}
                    options={apiOptions}
                    value={saveApiUuid}
                    onChange={(value) => setSaveApiUuid(value)}
                    allowClear={false}
                    showSearch
                    optionFilterProp="label"
                    notFoundContent={t('app.kuaizhizao.documentPush.batch.apiEmpty')}
                  />
                </Col>
              ) : null}
              {showScheduleControls ? (
                <Col xs={24} sm={12} md={4}>
                  <Typography.Text style={fieldLabelStyle}>
                    {t('app.kuaizhizao.documentPush.batch.modeLabel')}
                  </Typography.Text>
                  <Select
                    style={{ width: '100%' }}
                    value={syncMode}
                    onChange={setSyncMode}
                    options={[
                      {
                        value: 'manual_full',
                        label: t('app.kuaizhizao.documentPush.batch.modeManual'),
                      },
                      {
                        value: 'scheduled_full',
                        label: t('app.kuaizhizao.documentPush.batch.modeScheduled'),
                      },
                    ]}
                  />
                </Col>
              ) : null}
              {showScheduleControls && syncMode !== 'manual_full' ? (
                <Col xs={24} sm={12} md={4}>
                  <Typography.Text style={fieldLabelStyle}>
                    {t('app.kuaizhizao.documentPush.batch.intervalLabel')}
                  </Typography.Text>
                  <Select
                    style={{ width: '100%' }}
                    value={scheduleIntervalMinutes}
                    onChange={setScheduleIntervalMinutes}
                    options={[5, 15, 60, 360].map((n) => ({
                      value: n,
                      label: t('app.kuaizhizao.documentPush.batch.interval', { n }),
                    }))}
                  />
                </Col>
              ) : null}
            </Row>
          ) : null}
        </Flex>
      }
    />
  );
}

export default DocumentPushBatchPanel;
