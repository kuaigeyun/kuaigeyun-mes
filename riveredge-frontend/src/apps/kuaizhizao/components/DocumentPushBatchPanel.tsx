/**
 * 统一外推批次面板（标准形态以工单推送为准）：
 * UniPullQueryModal 多选候选 → profile 多选 →（金蝶）连接器/Save 接口 → 预览 dry-run → /document-push。
 * SyncPushHub 内嵌时设 embedded。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Checkbox, Empty, Flex, Modal, Select, Space, Table, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  UniPullQueryModal,
  useUniPullQuery,
} from '../../../components/uni-pull-query';
import {
  getApplicationConnectionListAll,
  type ApplicationConnection,
} from '../../../services/applicationConnection';
import { getAPIList, type API } from '../../../services/apiManagement';
import { ThemedSegmented } from '../../../components/themed-segmented/ThemedSegmented';
import { getDataSourceListAllMatching, type DataSource } from '../../../services/dataSource';
import { getDatasetList, type Dataset } from '../../../services/dataset';
import {
  filterProfilesForSource,
  listDocumentPushProfiles,
  pushDocumentExternal,
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

export interface DocumentPushTargetBinding {
  connection_code?: string;
  save_api_uuid?: string;
  target_profile: string;
  push_mode?: 'auto' | 'manual';
  trigger_actions?: string[];
  destination_kind?: 'api' | 'data_source';
  data_source_uuid?: string;
  dataset_uuid?: string;
  /** 仅点过确认保存的目标。缺省的历史行不展示。 */
  user_saved?: boolean;
}

export interface DocumentPushBindingState {
  targets?: DocumentPushTargetBinding[];
  /** 已保存过出站目标（含空列表）。未点确认的目标不展示。 */
  targets_configured?: boolean;
  trigger_actions?: string[];
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
  successCountKey = 'app.kuaizhizao.documentPush.batch.success',
  partialCountKey = 'app.kuaizhizao.documentPush.batch.partial',
  failedTitleKey = 'app.kuaizhizao.documentPush.pushFailed',
  skippedHintKey = 'app.kuaizhizao.documentPush.batch.skippedHint',
}: DocumentPushBatchPanelProps<T>): React.ReactElement | null {
  // 关闭态直接不渲染：hooks 仍执行，但下方网络 effect 均以 open 门控
  // （embedded Hub 在 push Tab 未激活时由上层不挂载本组件）
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [connectors, setConnectors] = useState<ApplicationConnection[]>([]);
  const [connectionCode, setConnectionCode] = useState<string | undefined>();
  const [saveApis, setSaveApis] = useState<API[]>([]);
  const [saveApiUuid, setSaveApiUuid] = useState<string | undefined>();
  const [syncMode, setSyncMode] = useState<string>('manual_full');
  const [targetModes, setTargetModes] = useState<Record<string, 'auto' | 'manual'>>({});
  const [targetActionMap, setTargetActionMap] = useState<Record<string, string[]>>({});
  const [destinationKinds, setDestinationKinds] = useState<Record<string, 'api' | 'data_source'>>({});
  const [dataSourceUuids, setDataSourceUuids] = useState<Record<string, string | undefined>>({});
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataSourcesLoading, setDataSourcesLoading] = useState(false);
  const [datasetUuids, setDatasetUuids] = useState<Record<string, string | undefined>>({});
  const [writeDatasets, setWriteDatasets] = useState<Dataset[]>([]);
  const [rememberBinding, setRememberBinding] = useState(true);
  const [settingProfile, setSettingProfile] = useState<string | null>(null);
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
  /** 添加目标：保存前只在设置弹窗，不进列表（对齐入站 pendingNewSourceDraft） */
  const [pendingNewProfile, setPendingNewProfile] = useState<string | null>(null);
  const connectionCodeRef = useRef<string | undefined>();
  const saveApiUuidRef = useRef<string | undefined>();
  const syncModeRef = useRef('manual_full');
  const settingSnapshotRef = useRef<{
    connection?: string;
    api?: string;
    mode: 'auto' | 'manual';
    actions: string[];
    destination: 'api' | 'data_source';
    dataSourceUuid?: string;
  } | null>(null);
  const scheduleIntervalRef = useRef(15);
  const rememberBindingRef = useRef(true);
  const targetModesRef = useRef<Record<string, 'auto' | 'manual'>>({});
  const destinationKindsRef = useRef<Record<string, 'api' | 'data_source'>>({});
  const dataSourceUuidsRef = useRef<Record<string, string | undefined>>({});
  const datasetUuidsRef = useRef<Record<string, string | undefined>>({});
  const targetActionMapRef = useRef<Record<string, string[]>>({});
  const pushOnlyProfileRef = useRef<string | null>(null);
  const settingProfileRef = useRef<string | null>(null);
  const targetProfilesRef = useRef<string[]>([]);
  const profileOptionsRef = useRef<Array<{ label: string; value: string }>>([]);
  connectionCodeRef.current = connectionCode;
  saveApiUuidRef.current = saveApiUuid;
  syncModeRef.current = syncMode;
  scheduleIntervalRef.current = scheduleIntervalMinutes;
  rememberBindingRef.current = rememberBinding;
  targetModesRef.current = targetModes;
  destinationKindsRef.current = destinationKinds;
  dataSourceUuidsRef.current = dataSourceUuids;
  datasetUuidsRef.current = datasetUuids;
  targetActionMapRef.current = targetActionMap;
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
        is_active: true,
      });
      setConnectors(rows);
      setConnectionCode((prev) => {
        if (prev && rows.some((row) => row.code === prev)) return prev;
        return rows.length === 1 ? rows[0]?.code : undefined;
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
    const labelOf = profileLabelRef.current;
    setProfilesLoading(true);
    setProfilesLoaded(false);
    void (async () => {
      try {
        const rows = await listDocumentPushProfiles();
        if (cancelled) return;
        const available = filterProfilesForSource(rows, sourceType);
        setProfileOptions(
          available.map((value) => ({
            value,
            label: labelOf(value),
          })),
        );
      } catch {
        if (cancelled) return;
        setProfileOptions([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable keys
  }, [defaultProfilesKey, open, sourceType]);

  useEffect(() => {
    // 关闭态 / 非金蝶目标不拉 /core/apis，避免列表页或 sync Tab 误打
    if (!open || !needsKingdeeConnector) return;
    void loadSaveApis(selectedConnector);
  }, [loadSaveApis, needsKingdeeConnector, open, selectedConnector]);

  useEffect(() => {
    if (!open) return;
    // 对齐入站：打开先空表，只回填接口里已经保存的目标，绝不填默认 profile
    setTargetProfiles([]);
    setPendingNewProfile(null);
    setSettingProfile(null);
    if (!loadBinding) return;
    let cancelled = false;
    void (async () => {
      try {
        const binding = await loadBinding();
        if (cancelled) return;
        if (!binding) {
          setTargetProfiles([]);
          return;
        }
        const rows = (binding.targets || []).filter((row) =>
          sourceType === 'purchase_order' ? row.user_saved === true : Boolean(row.target_profile),
        );
        setTargetProfiles(rows.map((row) => row.target_profile).filter(Boolean));
        const modes: Record<string, 'auto' | 'manual'> = {};
        const actions: Record<string, string[]> = {};
        const kinds: Record<string, 'api' | 'data_source'> = {};
        const sources: Record<string, string | undefined> = {};
        const datasets: Record<string, string | undefined> = {};
        for (const row of rows) {
          modes[row.target_profile] = row.push_mode === 'manual' ? 'manual' : 'auto';
          actions[row.target_profile] = row.trigger_actions?.length
            ? row.trigger_actions
            : binding.trigger_actions || [];
          kinds[row.target_profile] =
            row.destination_kind === 'data_source' ? 'data_source' : 'api';
          sources[row.target_profile] = row.data_source_uuid;
          datasets[row.target_profile] = row.dataset_uuid;
        }
        setTargetModes(modes);
        setTargetActionMap(actions);
        setDestinationKinds(kinds);
        setDataSourceUuids(sources);
        setDatasetUuids(datasets);
        const kd = rows.find((row) => row.connection_code || row.save_api_uuid);
        if (kd?.connection_code) setConnectionCode(kd.connection_code);
        else if (binding.connection_code) setConnectionCode(binding.connection_code);
        if (kd?.save_api_uuid) setSaveApiUuid(kd.save_api_uuid);
        else if (binding.save_api_uuid) setSaveApiUuid(binding.save_api_uuid);
        if (binding.sync_mode) setSyncMode(binding.sync_mode);
        if (binding.schedule_interval_minutes) {
          setScheduleIntervalMinutes(binding.schedule_interval_minutes);
        }
      } catch {
        if (cancelled) return;
        setTargetProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBinding, open, sourceType]);

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
    const needsApiConnector = targetProfiles.some(
      (profile) => kingdeeProfiles.includes(profile) && (destinationKinds[profile] ?? 'api') === 'api',
    );
    if (!needsApiConnector) return true;
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
    destinationKinds,
    kingdeeProfiles,
    matchSaveApi,
    saveApiUuid,
    targetProfiles,
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
      const onlyProfile = pushOnlyProfileRef.current;
      const profiles = targetProfilesRef.current.filter((p) => {
        if (!p || !allowed.has(p)) return false;
        if (onlyProfile) return p === onlyProfile;
        return (targetModesRef.current[p] ?? 'auto') === 'manual';
      });
      if (!profiles.length) {
        Modal.warning({
          title,
          content: t('app.kuaizhizao.documentPush.batch.needTargetProfile'),
        });
        return;
      }
      const dataSourceProfiles = profiles.filter(
        (profile) => (destinationKindsRef.current[profile] ?? 'api') === 'data_source',
      );
      if (dataSourceProfiles.some((profile) => !datasetUuidsRef.current[profile])) {
        Modal.warning({
          title,
          content: t('app.kuaizhizao.documentPush.batch.needWriteDataset'),
        });
        return;
      }
      const apiProfiles = profiles.filter(
        (profile) => (destinationKindsRef.current[profile] ?? 'api') !== 'data_source',
      );
      const needKd = apiProfiles.some((p) => kingdeeProfiles.includes(p));
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
        if (saveBinding && rememberBindingRef.current) {
          const allProfiles = targetProfilesRef.current.filter((p) => p && allowed.has(p));
          const bound = allProfiles.map((profile) => ({
            target_profile: profile,
            push_mode: targetModesRef.current[profile] ?? 'auto',
            destination_kind: destinationKindsRef.current[profile] ?? 'api',
            data_source_uuid:
              (destinationKindsRef.current[profile] ?? 'api') === 'data_source'
                ? dataSourceUuidsRef.current[profile]
                : undefined,
            dataset_uuid:
              (destinationKindsRef.current[profile] ?? 'api') === 'data_source'
                ? datasetUuidsRef.current[profile]
                : undefined,
            trigger_actions:
              (targetModesRef.current[profile] ?? 'auto') === 'auto'
                ? targetActionMapRef.current[profile] ?? []
                : [],
            connection_code:
              kingdeeProfiles.includes(profile) &&
              (destinationKindsRef.current[profile] ?? 'api') === 'api'
                ? conn
                : undefined,
            save_api_uuid:
              kingdeeProfiles.includes(profile) &&
              (destinationKindsRef.current[profile] ?? 'api') === 'api'
                ? apiUuid
                : undefined,
          }));
          const autoActions = [
            ...new Set(bound.flatMap((row) => row.trigger_actions)),
          ];
          await saveBinding({
            targets: bound,
            trigger_actions: autoActions,
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
            const targets = profiles.map((profile) => ({
              target_profile: profile,
              destination_kind: destinationKindsRef.current[profile] ?? 'api',
              data_source_uuid:
                (destinationKindsRef.current[profile] ?? 'api') === 'data_source'
                  ? dataSourceUuidsRef.current[profile]
                  : undefined,
              dataset_uuid:
                (destinationKindsRef.current[profile] ?? 'api') === 'data_source'
                  ? datasetUuidsRef.current[profile]
                  : undefined,
              connection_code:
                kingdeeProfiles.includes(profile) &&
                (destinationKindsRef.current[profile] ?? 'api') === 'api'
                  ? conn
                  : undefined,
              save_api_uuid:
                kingdeeProfiles.includes(profile) &&
                (destinationKindsRef.current[profile] ?? 'api') === 'api'
                  ? apiUuid
                  : undefined,
            }));
            const result = await pushDocumentExternal({
              source_type: sourceType,
              source_id: id,
              targets,
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

        const notify = embedded ? messageApi : null;
        if (failed > 0 && created === 0) {
          const detail = errors.slice(0, 5).join('\n') || t(failedTitleKey);
          if (notify) notify.error(detail);
          else
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
          const title = t(partialCountKey, { created, skipped, failed });
          if (notify) notify.warning(title);
          else Modal.warning({ title, content: errors.slice(0, 5).join('\n') || undefined });
        } else {
          const title = t(successCountKey, { count: created });
          if (notify) notify.success(title);
          else
            Modal.success({
              title,
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
      setPendingNewProfile(null);
      setSettingProfile(null);
      void loadConnectors();
      setDataSourcesLoading(true);
      void getDataSourceListAllMatching({ is_active: true })
        .then((rows) => setDataSources(rows))
        .catch(() => setDataSources([]))
        .finally(() => setDataSourcesLoading(false));
      void getDatasetList({ query_type: 'sql_write', is_active: true, page: 1, page_size: 200 })
        .then((res) => setWriteDatasets(res.items || []))
        .catch(() => setWriteDatasets([]));
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
    const onlyProfile = settingProfileRef.current;
    const profiles = targetProfilesRef.current.filter((p) => {
      if (!p || !allowed.has(p)) return false;
      if (onlyProfile) return p === onlyProfile;
      return true;
    });
    if (!profiles.length) {
      Modal.warning({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: t('app.kuaizhizao.documentPush.batch.needTargetProfile'),
      });
      return;
    }
    const apiProfiles = profiles.filter(
      (profile) => (destinationKindsRef.current[profile] ?? 'api') !== 'data_source',
    );
    if (!apiProfiles.length) {
      Modal.info({
        title: t('app.kuaizhizao.documentPush.previewTitle'),
        content: t('app.kuaizhizao.documentPush.batch.dataSourceNoted'),
      });
      return;
    }
    const needKd = apiProfiles.some((p) => kingdeeProfiles.includes(p));
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
        target_profiles: apiProfiles,
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

  settingProfileRef.current = settingProfile;

  const closeTargetSetting = (apply: boolean) => {
    if (!apply && settingSnapshotRef.current && settingProfile) {
      const snap = settingSnapshotRef.current;
      setConnectionCode(snap.connection);
      setSaveApiUuid(snap.api);
      setTargetModes((prev) => ({ ...prev, [settingProfile]: snap.mode }));
      setTargetActionMap((prev) => ({ ...prev, [settingProfile]: snap.actions }));
      setDestinationKinds((prev) => ({ ...prev, [settingProfile]: snap.destination }));
      setDataSourceUuids((prev) => ({ ...prev, [settingProfile]: snap.dataSourceUuid }));
    }
    if (apply && pendingNewProfile && settingProfile) {
      setTargetProfiles((prev) =>
        prev.includes(settingProfile) ? prev : [...prev, settingProfile],
      );
    }
    setPendingNewProfile(null);
    setSettingProfile(null);
  };

  const settingModal = settingProfile ? (
    <Modal
      title={t('app.kuaizhizao.documentPush.batch.targetSettingTitle')}
      open
      onCancel={() => closeTargetSetting(false)}
      width={1100}
      zIndex={1100}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={() => closeTargetSetting(false)}>
          {t('common.cancel')}
        </Button>,
        (targetModes[settingProfile] ?? 'auto') === 'manual' &&
        (destinationKinds[settingProfile] ?? 'api') === 'api' ? (
          <Button
            key="preview"
            loading={previewLoading}
            disabled={!pushReady}
            onClick={() => void handlePreviewPayload()}
          >
            {t('app.kuaizhizao.documentPush.preview')}
          </Button>
        ) : null,
        (targetModes[settingProfile] ?? 'auto') === 'manual' ? (
          <Button
            key="push"
            type="primary"
            loading={pull.confirmLoading}
            disabled={!pushReady || pull.confirmLoading}
            onClick={() => {
              pushOnlyProfileRef.current = settingProfile;
              void pull.handleConfirm().finally(() => {
                pushOnlyProfileRef.current = null;
              });
            }}
          >
            {confirmText || t('app.kuaizhizao.documentPush.batch.confirm')}
          </Button>
        ) : (
          <Button key="save" type="primary" onClick={() => closeTargetSetting(true)}>
            {t('common.save')}
          </Button>
        ),
      ]}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'max-content minmax(0, 1fr)',
          columnGap: 12,
          rowGap: 12,
          alignItems: 'center',
        }}
      >
        <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
          {t('app.kuaizhizao.documentPush.batch.destinationKind')}
        </Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <ThemedSegmented
            block
            style={{ width: 200, maxWidth: '100%' }}
            value={destinationKinds[settingProfile] ?? 'api'}
            onChange={(value) => {
              const kind = value === 'data_source' ? 'data_source' : 'api';
              setDestinationKinds((prev) => ({ ...prev, [settingProfile]: kind }));
              if (kind === 'data_source' && dataSources.length === 1 && !dataSourceUuids[settingProfile]) {
                setDataSourceUuids((prev) => ({ ...prev, [settingProfile]: dataSources[0]?.uuid }));
              }
            }}
            options={[
              { label: t('app.kuaizhizao.documentPush.batch.apiPlaceholder'), value: 'api' },
              { label: t('app.kuaizhizao.documentPush.batch.destinationDataset'), value: 'data_source' },
            ]}
          />
        </div>
        <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
          {t('app.kuaizhizao.documentPush.batch.modeLabel')}
        </Typography.Text>
        <Select
          style={{ width: 220 }}
          value={targetModes[settingProfile] ?? 'auto'}
          onChange={(value: 'auto' | 'manual') =>
            setTargetModes((prev) => ({ ...prev, [settingProfile]: value }))
          }
          options={[
            { value: 'auto', label: t('app.kuaizhizao.documentPush.batch.modeAuto') },
            { value: 'manual', label: t('app.kuaizhizao.documentPush.batch.modeManual') },
          ]}
        />
        {(targetModes[settingProfile] ?? 'auto') === 'auto' ? (
          <>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
              {t('app.kuaizhizao.documentPush.batch.bindActions')}
            </Typography.Text>
            <Checkbox.Group
              options={[
                { label: t('permission.action.submit'), value: 'submit' },
                { label: t('permission.action.approve'), value: 'approve' },
              ]}
              value={targetActionMap[settingProfile] ?? []}
              onChange={(vals) =>
                setTargetActionMap((prev) => ({ ...prev, [settingProfile]: vals.map(String) }))
              }
            />
          </>
        ) : null}
        {(destinationKinds[settingProfile] ?? 'api') === 'data_source' ? (
          <>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
              {t('app.kuaizhizao.documentPush.batch.destinationDataSource')}
            </Typography.Text>
            <Select
              style={{ width: '100%', maxWidth: 520 }}
              loading={dataSourcesLoading}
              placeholder={t('app.kuaizhizao.documentPush.batch.dataSourcePlaceholder')}
              options={dataSources.map((row) => ({
                value: row.uuid,
                label: row.name ? `${row.name}（${row.code}）` : row.code,
              }))}
              value={dataSourceUuids[settingProfile]}
              onChange={(value) =>
                setDataSourceUuids((prev) => ({ ...prev, [settingProfile]: value }))
              }
              allowClear={false}
              showSearch
              optionFilterProp="label"
              notFoundContent={t('app.kuaizhizao.documentPush.batch.dataSourceEmpty')}
            />
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
              {t('app.kuaizhizao.documentPush.batch.writeDatasetPlaceholder')}
            </Typography.Text>
            <Select
              style={{ width: '100%', maxWidth: 520 }}
              placeholder={t('app.kuaizhizao.documentPush.batch.writeDatasetPlaceholder')}
              options={writeDatasets
                .filter((row) => !dataSourceUuids[settingProfile] || row.data_source_uuid === dataSourceUuids[settingProfile])
                .map((row) => ({
                  value: row.uuid,
                  label: row.name ? `${row.name}（${row.code}）` : row.code,
                }))}
              value={datasetUuids[settingProfile]}
              onChange={(value) =>
                setDatasetUuids((prev) => ({ ...prev, [settingProfile]: value }))
              }
              allowClear={false}
              showSearch
              optionFilterProp="label"
              notFoundContent={t('app.kuaizhizao.documentPush.batch.writeDatasetEmpty')}
            />
          </>
        ) : null}
        {(destinationKinds[settingProfile] ?? 'api') === 'api' &&
        kingdeeProfiles.includes(settingProfile) ? (
          <>
        <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
          {t('app.kuaizhizao.documentPush.batch.connectorPlaceholder')}
        </Typography.Text>
        <Select
          style={{ width: '100%', maxWidth: 520 }}
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
        {matchSaveApi ? (
          <>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', lineHeight: '32px' }}>
              {t('app.kuaizhizao.documentPush.batch.apiPlaceholder')}
            </Typography.Text>
            <Select
              style={{ width: '100%', maxWidth: 520 }}
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
          </>
        ) : null}
          </>
        ) : null}
      </div>
      {(destinationKinds[settingProfile] ?? 'api') === 'api' &&
      kingdeeProfiles.includes(settingProfile) &&
      !connectionCode ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          title={t('app.kuaizhizao.documentPush.batch.needConnector')}
        />
      ) : null}
      {(destinationKinds[settingProfile] ?? 'api') === 'data_source' &&
      !dataSourceUuids[settingProfile] ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          title={t('app.kuaizhizao.documentPush.batch.needDataSource')}
        />
      ) : null}
      {(destinationKinds[settingProfile] ?? 'api') === 'data_source' &&
      dataSourceUuids[settingProfile] &&
      !datasetUuids[settingProfile] ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          title={t('app.kuaizhizao.documentPush.batch.needWriteDataset')}
        />
      ) : null}
      {(destinationKinds[settingProfile] ?? 'api') === 'data_source' &&
      datasetUuids[settingProfile] ? (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          title={t('app.kuaizhizao.documentPush.batch.writeDatasetNoted')}
        />
      ) : null}
      {(targetModes[settingProfile] ?? 'auto') === 'manual' ? (
        <div style={{ marginTop: 16 }}>
          <UniPullQueryModal<T>
            open
            embedded
            hideFooter
            title={title}
            onCancel={() => closeTargetSetting(false)}
            onOk={pull.handleConfirm}
            confirmLoading={pull.confirmLoading}
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
          />
        </div>
      ) : null}
    </Modal>
  ) : null;

  if (!open) return null;

  const targetRows = targetProfiles.map((profile, index) => ({
    key: profile,
    index: index + 1,
    profile,
    name: profileLabel(profile),
  }));

  const addTarget = () => {
    const preferred = (defaultProfilesRef.current || []).filter(Boolean);
    const used = new Set([...targetProfiles, pendingNewProfile].filter(Boolean) as string[]);
    const next =
      preferred
        .map((value) => profileOptions.find((option) => option.value === value))
        .find((option) => option && !used.has(option.value)) ||
      profileOptions.find((option) => !used.has(option.value));
    if (!next) {
      messageApi.info(t('app.kuaizhizao.documentPush.batch.noMoreTargets'));
      return;
    }
    setPendingNewProfile(next.value);
    setTargetModes((prev) => ({ ...prev, [next.value]: prev[next.value] ?? 'auto' }));
    settingSnapshotRef.current = {
      connection: connectionCode,
      api: saveApiUuid,
      mode: 'auto',
      actions: [],
      destination: destinationKinds[next.value] ?? 'api',
      dataSourceUuid: dataSourceUuids[next.value],
    };
    setSettingProfile(next.value);
  };

  const confirmAuto = async () => {
    if (targetProfiles.length > 0 && !pushReady) {
      Modal.warning({
        title,
        content: notReadyReason || t('components.syncPushHub.pushNotReady'),
      });
      return;
    }
    if (!saveBinding) {
      messageApi.info(t('app.kuaizhizao.documentPush.batch.autoNeedBinding'));
      return;
    }
    if (!rememberBinding) {
      onClose();
      return;
    }
    const profiles = targetProfiles.filter((profile) => allowedProfileSet.has(profile));
    if (
      profiles.some(
        (profile) =>
          (destinationKinds[profile] ?? 'api') === 'data_source' && !dataSourceUuids[profile],
      )
    ) {
      Modal.warning({
        title,
        content: t('app.kuaizhizao.documentPush.batch.needDataSource'),
      });
      return;
    }
    if (
      profiles.some(
        (profile) =>
          (destinationKinds[profile] ?? 'api') === 'data_source' && !datasetUuids[profile],
      )
    ) {
      Modal.warning({
        title,
        content: t('app.kuaizhizao.documentPush.batch.needWriteDataset'),
      });
      return;
    }
    const bound = profiles.map((profile) => ({
      target_profile: profile,
      push_mode: targetModes[profile] ?? 'auto',
      destination_kind: destinationKinds[profile] ?? 'api',
      data_source_uuid:
        (destinationKinds[profile] ?? 'api') === 'data_source' ? dataSourceUuids[profile] : undefined,
      dataset_uuid:
        (destinationKinds[profile] ?? 'api') === 'data_source' ? datasetUuids[profile] : undefined,
      trigger_actions:
        (targetModes[profile] ?? 'auto') === 'auto' ? targetActionMap[profile] ?? [] : [],
      connection_code:
        kingdeeProfiles.includes(profile) && (destinationKinds[profile] ?? 'api') === 'api'
          ? connectionCode
          : undefined,
      save_api_uuid:
        kingdeeProfiles.includes(profile) && (destinationKinds[profile] ?? 'api') === 'api'
          ? saveApiUuid
          : undefined,
      user_saved: true,
    }));
    await saveBinding({
      targets: bound,
      trigger_actions: [...new Set(bound.flatMap((row) => row.trigger_actions))],
      connection_code: connectionCode,
      save_api_uuid: saveApiUuid,
      sync_mode: syncMode,
      schedule_interval_minutes: scheduleIntervalMinutes,
    });
    messageApi.success(t('app.kuaizhizao.documentPush.batch.autoSaved'));
  };

  const footer = (
    <Flex justify="flex-end" gap={8}>
      <Button onClick={onClose}>{t('common.cancel')}</Button>
      <Button
        type="primary"
        disabled={targetProfiles.length > 0 && !pushReady}
        onClick={() => {
          void confirmAuto();
        }}
      >
        {t('app.kuaizhizao.documentPush.batch.confirmAuto')}
      </Button>
    </Flex>
  );

  const body = (
    <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
      {hint ? <Alert type="info" showIcon title={hint} /> : null}
      <Flex justify="space-between" align="center" gap={12} wrap="wrap">
        <Space size={8} wrap align="center" style={{ flex: 1, minWidth: 200 }}>
          <Typography.Text strong>{t('app.kuaizhizao.documentPush.batch.targetProfiles')}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {t('app.kuaizhizao.documentPush.batch.targetsHint')}
          </Typography.Text>
        </Space>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={addTarget} disabled={profilesLoading}>
            {t('app.kuaizhizao.documentPush.batch.addTarget')}
          </Button>
          <Checkbox checked={rememberBinding} onChange={(event) => setRememberBinding(event.target.checked)}>
            {t('app.kuaizhizao.documentPush.batch.rememberBinding')}
          </Checkbox>
        </Space>
      </Flex>
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={targetRows}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.documentPush.batch.targetsEmpty')}
            />
          ),
        }}
        columns={[
          {
            title: t('components.syncFromSource.sourceIndex'),
            dataIndex: 'index',
            width: 56,
          },
          {
            title: t('components.syncFromSource.sourceKind'),
            dataIndex: 'profile',
            width: 120,
            render: (profile: string) =>
              (destinationKinds[profile] ?? 'api') === 'data_source'
                ? t('app.kuaizhizao.documentPush.batch.destinationDataset')
                : t('app.kuaizhizao.documentPush.batch.apiPlaceholder'),
          },
          {
            title: t('components.syncFromSource.sourceName'),
            dataIndex: 'name',
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.documentPush.batch.modeLabel'),
            dataIndex: 'profile',
            width: 96,
            render: (profile: string) =>
              (targetModes[profile] ?? 'auto') === 'manual'
                ? t('app.kuaizhizao.documentPush.batch.modeManual')
                : t('app.kuaizhizao.documentPush.batch.modeAuto'),
          },
          {
            title: t('common.actions'),
            key: 'actions',
            width: 140,
            render: (_value, record: { profile: string }) => (
              <Space size="small">
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      settingSnapshotRef.current = {
                        connection: connectionCode,
                        api: saveApiUuid,
                        mode: targetModes[record.profile] ?? 'auto',
                        actions: targetActionMap[record.profile] ?? [],
                        destination: destinationKinds[record.profile] ?? 'api',
                        dataSourceUuid: dataSourceUuids[record.profile],
                      };
                      setSettingProfile(record.profile);
                    }}
                  >
                    {t('components.syncFromSource.configureSource')}
                  </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setTargetProfiles((prev) => prev.filter((item) => item !== record.profile));
                    if (settingProfile === record.profile) setSettingProfile(null);
                  }}
                />
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );

  if (!embedded) {
    return (
      <Modal
        title={title}
        open={open}
        onCancel={onClose}
        width={1100}
        destroyOnHidden
        footer={footer}
      >
        {body}
        {settingModal}
      </Modal>
    );
  }

  return (
    <div>
      {body}
      <div style={{ marginTop: 16 }}>{footer}</div>
      {settingModal}
    </div>
  );
}

export default DocumentPushBatchPanel;
