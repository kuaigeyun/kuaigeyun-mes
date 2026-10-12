/**
 * 数据备份策略：定时（天/周/月）、存储落点、定期清理（预设选择）。
 * 本组织策略按选中租户号请求；平台管理员可从全平台组织列表选择。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  App,
  Alert,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Switch,
  Tabs,
  TimePicker,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { MODAL_CONFIG } from '../../../components/layout-templates';
import {
  getDataBackupPolicy,
  getPlatformDataBackupPolicy,
  getDataBackupStorageConnections,
  saveDataBackupPolicy,
  savePlatformDataBackupPolicy,
  type DataBackupPolicy,
  type DataBackupStorageConnection,
} from '../../../services/dataBackup';
import { getTenantList, TenantStatus } from '../../../services/tenant';
import { getApiErrorMessage } from '../../../utils/errorHandler';

const LOCAL_VALUE = '__local__';

/** 清理：模式单选 + 天数/份数预设选择（禁止自由填任意大数） */
const RETENTION_DAYS_OPTIONS = [7, 30, 90, 180, 365] as const;
const RETENTION_KEEP_OPTIONS = [3, 5, 7, 10, 20] as const;

type RetentionMode = 'none' | 'days' | 'keep_count';
type ScheduleFreq = 'daily' | 'weekly' | 'monthly';

type PolicyFormValues = {
  schedule_enabled: boolean;
  schedule_freq: ScheduleFreq;
  schedule_weekday?: number;
  schedule_month_day?: number;
  schedule_time?: Dayjs;
  include_files: boolean;
  storage_location: string;
  key_prefix?: string;
  retention_mode: RetentionMode;
  retention_days?: number;
  retention_keep_count?: number;
};

type TenantOption = { value: number; label: string; name: string };

function snapToPreset(value: number, presets: readonly number[], fallback: number): number {
  if (presets.includes(value as (typeof presets)[number])) {
    return value;
  }
  return fallback;
}

function defaultTime(): Dayjs {
  return dayjs().hour(2).minute(0).second(0);
}

function parseCronToSchedule(cron: string): {
  freq: ScheduleFreq;
  weekday: number;
  monthDay: number;
  time: Dayjs;
} {
  const parts = (cron || '0 2 * * *').trim().split(/\s+/);
  if (parts.length !== 5) {
    return { freq: 'daily', weekday: 1, monthDay: 1, time: defaultTime() };
  }
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  const day = parts[2];
  const month = parts[3];
  const weekday = parts[4];
  const time =
    Number.isFinite(minute) && Number.isFinite(hour)
      ? dayjs().hour(hour).minute(minute).second(0)
      : defaultTime();

  if (month === '*' && day === '*' && weekday === '*') {
    return { freq: 'daily', weekday: 1, monthDay: 1, time };
  }
  if (month === '*' && day === '*' && /^\d+$/.test(weekday)) {
    return { freq: 'weekly', weekday: Number(weekday), monthDay: 1, time };
  }
  if (month === '*' && /^\d+$/.test(day) && weekday === '*') {
    return { freq: 'monthly', weekday: 1, monthDay: Number(day), time };
  }
  return { freq: 'daily', weekday: 1, monthDay: 1, time };
}

function scheduleToCron(values: PolicyFormValues): string {
  const t = values.schedule_time || defaultTime();
  const minute = t.minute();
  const hour = t.hour();
  const freq = values.schedule_freq || 'daily';
  if (freq === 'weekly') {
    const wd = Number(values.schedule_weekday ?? 1);
    return `${minute} ${hour} * * ${wd}`;
  }
  if (freq === 'monthly') {
    const md = Math.min(31, Math.max(1, Number(values.schedule_month_day ?? 1)));
    return `${minute} ${hour} ${md} * *`;
  }
  return `${minute} ${hour} * * *`;
}

function emptyPolicy(): DataBackupPolicy {
  return {
    schedule_enabled: false,
    cron: '0 2 * * *',
    include_files: true,
    storage: { backend: 'local', connection_uuid: null, key_prefix: 'data-backups' },
    retention: { mode: 'none', days: 30, keep_count: 7 },
  } as DataBackupPolicy;
}

function policyToForm(policy: DataBackupPolicy): PolicyFormValues {
  const cron = policy.cron || '0 2 * * *';
  const sched = parseCronToSchedule(cron);
  const location =
    policy.storage?.backend === 'connection' && policy.storage.connection_uuid
      ? policy.storage.connection_uuid
      : LOCAL_VALUE;
  const mode = (policy.retention?.mode || 'none') as RetentionMode;
  return {
    schedule_enabled: !!policy.schedule_enabled,
    schedule_freq: sched.freq,
    schedule_weekday: sched.weekday,
    schedule_month_day: sched.monthDay,
    schedule_time: sched.time,
    include_files: policy.include_files !== false,
    storage_location: location,
    key_prefix: policy.storage?.key_prefix || 'data-backups',
    retention_mode: mode === 'days' || mode === 'keep_count' ? mode : 'none',
    retention_days: snapToPreset(policy.retention?.days ?? 30, RETENTION_DAYS_OPTIONS, 30),
    retention_keep_count: snapToPreset(
      policy.retention?.keep_count ?? 7,
      RETENTION_KEEP_OPTIONS,
      7,
    ),
  };
}

function formToPayload(values: PolicyFormValues): Partial<DataBackupPolicy> {
  const isConnection = values.storage_location && values.storage_location !== LOCAL_VALUE;
  const mode = values.retention_mode || 'none';
  return {
    schedule_enabled: !!values.schedule_enabled,
    cron: scheduleToCron(values),
    include_files: values.include_files !== false,
    storage: {
      backend: isConnection ? 'connection' : 'local',
      connection_uuid: isConnection ? values.storage_location : null,
      key_prefix: (values.key_prefix || 'data-backups').trim() || 'data-backups',
    },
    retention: {
      mode,
      days: snapToPreset(Number(values.retention_days ?? 30), RETENTION_DAYS_OPTIONS, 30),
      keep_count: snapToPreset(
        Number(values.retention_keep_count ?? 7),
        RETENTION_KEEP_OPTIONS,
        7,
      ),
    },
  };
}

type PolicyFieldsProps = {
  form: ReturnType<typeof Form.useForm<PolicyFormValues>>[0];
  connectionOptions: { value: string; label: string }[];
  scopeHint?: string;
  platformStorageHint?: boolean;
};

const PolicyFields: React.FC<PolicyFieldsProps> = ({
  form,
  connectionOptions,
  scopeHint,
  platformStorageHint,
}) => {
  const { t } = useTranslation();
  const scheduleOn = Form.useWatch('schedule_enabled', form);
  const scheduleFreq = Form.useWatch('schedule_freq', form);
  const storageLocation = Form.useWatch('storage_location', form);
  const retentionMode = Form.useWatch('retention_mode', form);
  const isObject = !!storageLocation && storageLocation !== LOCAL_VALUE;

  const weekdayOptions = useMemo(
    () => [
      { value: 1, label: t('pages.system.dataBackups.policyWeekdayMon') },
      { value: 2, label: t('pages.system.dataBackups.policyWeekdayTue') },
      { value: 3, label: t('pages.system.dataBackups.policyWeekdayWed') },
      { value: 4, label: t('pages.system.dataBackups.policyWeekdayThu') },
      { value: 5, label: t('pages.system.dataBackups.policyWeekdayFri') },
      { value: 6, label: t('pages.system.dataBackups.policyWeekdaySat') },
      { value: 0, label: t('pages.system.dataBackups.policyWeekdaySun') },
    ],
    [t],
  );

  const monthDayOptions = useMemo(
    () =>
      Array.from({ length: 31 }, (_, i) => ({
        value: i + 1,
        label: t('pages.system.dataBackups.policyMonthDayOption', { day: i + 1 }),
      })),
    [t],
  );

  const retentionDaysOptions = useMemo(
    () =>
      RETENTION_DAYS_OPTIONS.map((d) => ({
        value: d,
        label: t('pages.system.dataBackups.policyRetentionDaysOption', { days: d }),
      })),
    [t],
  );

  const retentionKeepOptions = useMemo(
    () =>
      RETENTION_KEEP_OPTIONS.map((n) => ({
        value: n,
        label: t('pages.system.dataBackups.policyRetentionKeepOption', { count: n }),
      })),
    [t],
  );

  return (
    <>
      {scopeHint ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title={scopeHint} />
      ) : null}
      <Form.Item
        name="schedule_enabled"
        label={t('pages.system.dataBackups.policyScheduleEnabled')}
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
      {scheduleOn ? (
        <>
          <Form.Item
            name="schedule_freq"
            label={t('pages.system.dataBackups.policyScheduleFreq')}
            rules={[{ required: true, message: t('pages.system.dataBackups.policyScheduleFreqRequired') }]}
          >
            <Radio.Group>
              <Radio.Button value="daily">{t('pages.system.dataBackups.policyFreqDaily')}</Radio.Button>
              <Radio.Button value="weekly">{t('pages.system.dataBackups.policyFreqWeekly')}</Radio.Button>
              <Radio.Button value="monthly">{t('pages.system.dataBackups.policyFreqMonthly')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          {scheduleFreq === 'weekly' ? (
            <Form.Item
              name="schedule_weekday"
              label={t('pages.system.dataBackups.policyWeekday')}
              rules={[{ required: true, message: t('pages.system.dataBackups.policyWeekdayRequired') }]}
            >
              <Select options={weekdayOptions} />
            </Form.Item>
          ) : null}
          {scheduleFreq === 'monthly' ? (
            <Form.Item
              name="schedule_month_day"
              label={t('pages.system.dataBackups.policyMonthDay')}
              rules={[{ required: true, message: t('pages.system.dataBackups.policyMonthDayRequired') }]}
              extra={t('pages.system.dataBackups.policyMonthDayHint')}
            >
              <Select options={monthDayOptions} />
            </Form.Item>
          ) : null}
          <Form.Item
            name="schedule_time"
            label={t('pages.system.dataBackups.policyScheduleTime')}
            rules={[{ required: true, message: t('pages.system.dataBackups.policyScheduleTimeRequired') }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="include_files"
            label={t('pages.system.dataBackups.policyIncludeFiles')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </>
      ) : null}

      <Form.Item
        name="storage_location"
        label={t('pages.system.dataBackups.policyStorage')}
        rules={[{ required: true, message: t('pages.system.dataBackups.policyStorageRequired') }]}
      >
        <Select
          options={[
            { value: LOCAL_VALUE, label: t('pages.system.dataBackups.policyStorageLocal') },
            ...connectionOptions,
          ]}
        />
      </Form.Item>
      {isObject ? (
        <Form.Item
          name="key_prefix"
          label={t('pages.system.dataBackups.policyKeyPrefix')}
          extra={t('pages.system.dataBackups.policyKeyPrefixHint')}
        >
          <Input placeholder="data-backups" />
        </Form.Item>
      ) : null}
      {platformStorageHint && isObject ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
          {t('pages.system.dataBackups.policyPlatformStorageHint')}
        </Typography.Paragraph>
      ) : null}

      <Form.Item
        name="retention_mode"
        label={t('pages.system.dataBackups.policyRetention')}
        rules={[{ required: true, message: t('pages.system.dataBackups.policyRetentionRequired') }]}
      >
        <Radio.Group>
          <Radio value="none">{t('pages.system.dataBackups.policyRetentionNone')}</Radio>
          <Radio value="days">{t('pages.system.dataBackups.policyRetentionDays')}</Radio>
          <Radio value="keep_count">{t('pages.system.dataBackups.policyRetentionKeepCount')}</Radio>
        </Radio.Group>
      </Form.Item>
      {retentionMode === 'days' ? (
        <Form.Item
          name="retention_days"
          label={t('pages.system.dataBackups.policyRetentionDaysValue')}
          rules={[
            { required: true, message: t('pages.system.dataBackups.policyRetentionDaysRequired') },
          ]}
        >
          <Select options={retentionDaysOptions} />
        </Form.Item>
      ) : null}
      {retentionMode === 'keep_count' ? (
        <Form.Item
          name="retention_keep_count"
          label={t('pages.system.dataBackups.policyRetentionKeepCountValue')}
          rules={[
            {
              required: true,
              message: t('pages.system.dataBackups.policyRetentionKeepCountRequired'),
            },
          ]}
        >
          <Select options={retentionKeepOptions} />
        </Form.Item>
      ) : null}
    </>
  );
};

export interface BackupPolicyModalProps {
  open: boolean;
  onClose: () => void;
  isInfraAdmin: boolean;
  /** 当前会话绑定/顶栏选中的组织号 */
  boundTenantId?: number | null;
  /** 当前会话组织名称（可缺省，弹窗内用组织列表补全） */
  boundTenantName?: string | null;
}

const BackupPolicyModal: React.FC<BackupPolicyModalProps> = ({
  open,
  onClose,
  isInfraAdmin,
  boundTenantId,
  boundTenantName,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [tenantForm] = Form.useForm<PolicyFormValues>();
  const [platformForm] = Form.useForm<PolicyFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'tenant' | 'platform'>('tenant');
  const [connections, setConnections] = useState<DataBackupStorageConnection[]>([]);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [workingTenantId, setWorkingTenantId] = useState<number | null>(null);
  const [tenantPolicyReady, setTenantPolicyReady] = useState(false);

  const connectionOptions = useMemo(
    () =>
      connections.map((c) => ({
        value: c.uuid,
        label: `${c.type_label} ${c.name || c.code || c.uuid}`,
      })),
    [connections],
  );

  const workingTenantLabel = useMemo(() => {
    if (workingTenantId == null) return null;
    const hit = tenantOptions.find((o) => o.value === workingTenantId);
    const name =
      hit?.name ||
      (boundTenantId != null && Number(boundTenantId) === workingTenantId
        ? boundTenantName?.trim() || ''
        : '');
    return {
      id: workingTenantId,
      name: name || t('pages.system.dataBackups.policyTenantNameUnknown'),
    };
  }, [boundTenantId, boundTenantName, t, tenantOptions, workingTenantId]);

  const loadTenantOptions = useCallback(async (): Promise<TenantOption[]> => {
    if (!isInfraAdmin) {
      const id =
        boundTenantId != null && Number.isFinite(Number(boundTenantId)) && Number(boundTenantId) > 0
          ? Number(boundTenantId)
          : null;
      if (id == null) return [];
      return [
        {
          value: id,
          name: boundTenantName?.trim() || t('pages.system.dataBackups.policyTenantNameUnknown'),
          label: `${boundTenantName?.trim() || t('pages.system.dataBackups.policyTenantNameUnknown')} (#${id})`,
        },
      ];
    }
    const resp = await getTenantList(
      {
        page: 1,
        page_size: 100,
        status: TenantStatus.ACTIVE,
        sort: 'id',
        order: 'asc',
      },
      true,
    );
    return (resp.items ?? []).map((tenant) => {
      const id = Number(tenant.id);
      const name = (tenant.name || '').trim() || t('pages.system.dataBackups.policyTenantNameUnknown');
      return { value: id, name, label: `${name} (#${id})` };
    });
  }, [boundTenantId, boundTenantName, isInfraAdmin, t]);

  const loadTenantPolicy = useCallback(
    async (tenantId: number) => {
      const [conns, policy] = await Promise.all([
        getDataBackupStorageConnections(tenantId),
        getDataBackupPolicy(tenantId),
      ]);
      setConnections(conns);
      tenantForm.setFieldsValue(policyToForm(policy || emptyPolicy()));
      setTenantPolicyReady(true);
    },
    [tenantForm],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setTenantPolicyReady(false);
    setConnections([]);
    try {
      const options = await loadTenantOptions();
      setTenantOptions(options);

      const preferred =
        boundTenantId != null && Number.isFinite(Number(boundTenantId)) && Number(boundTenantId) > 0
          ? Number(boundTenantId)
          : null;
      const initialTenantId =
        preferred != null && options.some((o) => o.value === preferred)
          ? preferred
          : options[0]?.value ?? null;
      setWorkingTenantId(initialTenantId);

      if (initialTenantId != null) {
        await loadTenantPolicy(initialTenantId);
        setActiveTab('tenant');
      } else if (isInfraAdmin) {
        setActiveTab('platform');
      }

      if (isInfraAdmin) {
        const platformPolicy = await getPlatformDataBackupPolicy();
        platformForm.setFieldsValue(policyToForm(platformPolicy || emptyPolicy()));
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('pages.system.dataBackups.policyLoadFailed')));
      if (isInfraAdmin) {
        setActiveTab('platform');
      }
    } finally {
      setLoading(false);
    }
  }, [
    boundTenantId,
    isInfraAdmin,
    loadTenantOptions,
    loadTenantPolicy,
    messageApi,
    platformForm,
    t,
  ]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const handleTenantChange = async (tenantId: number) => {
    setWorkingTenantId(tenantId);
    setLoading(true);
    setTenantPolicyReady(false);
    try {
      await loadTenantPolicy(tenantId);
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('pages.system.dataBackups.policyLoadFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleOk = async () => {
    setSaving(true);
    try {
      if (activeTab === 'tenant') {
        if (workingTenantId == null) {
          messageApi.error(t('pages.system.dataBackups.policySelectTenantRequired'));
          return;
        }
        const values = await tenantForm.validateFields();
        await saveDataBackupPolicy(formToPayload(values), workingTenantId);
      } else {
        const values = await platformForm.validateFields();
        await savePlatformDataBackupPolicy(formToPayload(values), workingTenantId);
      }
      messageApi.success(t('pages.system.dataBackups.policySaveSuccess'));
      onClose();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      messageApi.error(getApiErrorMessage(error, t('pages.system.dataBackups.policySaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const showTenantTab = isInfraAdmin || workingTenantId != null || tenantPolicyReady;
  const canShowAnything = showTenantTab || isInfraAdmin;

  const tabItems: { key: string; label: string; children: React.ReactNode }[] = [];
  if (showTenantTab) {
    tabItems.push({
      key: 'tenant',
      label: t('pages.system.dataBackups.policyTabTenant'),
      children: (
        <>
          {isInfraAdmin ? (
            <div style={{ marginBottom: 16 }}>
              <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
                {t('pages.system.dataBackups.policySelectTenant')}
              </Typography.Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                placeholder={t('pages.system.dataBackups.policySelectTenantPlaceholder')}
                value={workingTenantId ?? undefined}
                options={tenantOptions}
                disabled={loading}
                onChange={(v) => void handleTenantChange(Number(v))}
              />
            </div>
          ) : null}
          {workingTenantLabel ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('pages.system.dataBackups.policyCurrentTenant', {
                name: workingTenantLabel.name,
                id: workingTenantLabel.id,
              })}
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={
                isInfraAdmin
                  ? t('pages.system.dataBackups.policySelectTenantRequired')
                  : t('pages.system.dataBackups.policyNeedTenant')
              }
            />
          )}
          {workingTenantId != null ? (
            <Form form={tenantForm} layout="vertical" disabled={loading}>
              <PolicyFields form={tenantForm} connectionOptions={connectionOptions} />
            </Form>
          ) : null}
        </>
      ),
    });
  }
  if (isInfraAdmin) {
    tabItems.push({
      key: 'platform',
      label: t('pages.system.dataBackups.policyTabPlatform'),
      children: (
        <Form form={platformForm} layout="vertical" disabled={loading}>
          <PolicyFields
            form={platformForm}
            connectionOptions={connectionOptions}
            scopeHint={t('pages.system.dataBackups.policyPlatformHint')}
            platformStorageHint
          />
        </Form>
      ),
    });
  }

  return (
    <Modal
      title={t('pages.system.dataBackups.policyModalTitle')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      destroyOnHidden
      mask={{ closable: false }}
      okButtonProps={{ disabled: activeTab === 'tenant' && workingTenantId == null }}
    >
      {!canShowAnything ? (
        <Alert type="warning" showIcon title={t('pages.system.dataBackups.policyNeedTenant')} />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'tenant' | 'platform')}
          items={tabItems}
        />
      )}
    </Modal>
  );
};

export default BackupPolicyModal;
