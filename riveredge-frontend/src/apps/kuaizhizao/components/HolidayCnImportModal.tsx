/**
 * 中国法定节假日 + 周休导入弹窗
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Checkbox, DatePicker, Form, Modal, Space, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { holidayApi } from '../services/performance';
import type { HolidayCnRestMode } from '../types/performance';

const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

const PRESET_WEEKDAYS: Record<Exclude<HolidayCnRestMode, 'custom'>, number[]> = {
  double: [5, 6],
  single: [6],
};

export interface HolidayCnImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HolidayCnImportModal: React.FC<HolidayCnImportModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [year, setYear] = useState<Dayjs>(() => dayjs());
  const [restMode, setRestMode] = useState<HolidayCnRestMode>('double');
  const [restWeekdays, setRestWeekdays] = useState<number[]>(PRESET_WEEKDAYS.double);

  useEffect(() => {
    if (!open) return;
    setYear(dayjs());
    setRestMode('double');
    setRestWeekdays(PRESET_WEEKDAYS.double);
    setSubmitting(false);
  }, [open]);

  const weekdayOptions = useMemo(
    () =>
      WEEKDAY_VALUES.map((value) => ({
        value,
        label: t(`app.kuaizhizao.performance.holidays.importCn.weekday.${value}`),
      })),
    [t],
  );

  const restModeOptions = useMemo(
    () => [
      { value: 'double' as const, label: t('app.kuaizhizao.performance.holidays.importCn.restMode.double') },
      { value: 'single' as const, label: t('app.kuaizhizao.performance.holidays.importCn.restMode.single') },
      { value: 'custom' as const, label: t('app.kuaizhizao.performance.holidays.importCn.restMode.custom') },
    ],
    [t],
  );

  const handleRestModeChange = (mode: HolidayCnRestMode) => {
    setRestMode(mode);
    if (mode === 'double' || mode === 'single') {
      setRestWeekdays(PRESET_WEEKDAYS[mode]);
    }
  };

  const handleOk = async () => {
    if (!year) {
      messageApi.warning(t('app.kuaizhizao.performance.holidays.importCn.messages.yearRequired'));
      return;
    }
    if (restMode === 'custom' && restWeekdays.length === 0) {
      messageApi.warning(t('app.kuaizhizao.performance.holidays.importCn.messages.weekdaysRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await holidayApi.importCn({
        year: year.year(),
        restMode,
        restWeekdays: restMode === 'custom' ? restWeekdays : undefined,
      });
      messageApi.success(
        t('app.kuaizhizao.performance.holidays.importCn.messages.success', {
          year: result.year,
          created: result.created,
          skipped: result.skipped,
          failed: result.failed,
        }),
      );
      onSuccess();
      onClose();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.holidays.importCn.messages.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('app.kuaizhizao.performance.holidays.importCn.title')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      okText={t('app.kuaizhizao.performance.holidays.importCn.ok')}
      cancelText={t('common.cancel')}
      destroyOnClose
      width={520}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('app.kuaizhizao.performance.holidays.importCn.hint')}
      </Typography.Paragraph>
      <Form layout="vertical">
        <Form.Item label={t('app.kuaizhizao.performance.holidays.importCn.year')} required>
          <DatePicker
            picker="year"
            value={year}
            onChange={(v) => setYear(v ?? dayjs())}
            style={{ width: '100%' }}
            allowClear={false}
          />
        </Form.Item>
        <Form.Item label={t('app.kuaizhizao.performance.holidays.importCn.restModeLabel')} required>
          <ThemedSegmented
            block
            value={restMode}
            options={restModeOptions}
            onChange={(v) => handleRestModeChange(v as HolidayCnRestMode)}
          />
        </Form.Item>
        <Form.Item label={t('app.kuaizhizao.performance.holidays.importCn.restWeekdays')} required>
          <Checkbox.Group
            value={restWeekdays}
            options={weekdayOptions}
            disabled={restMode !== 'custom'}
            onChange={(vals) => setRestWeekdays(vals.map((v) => Number(v)))}
          />
          {restMode !== 'custom' ? (
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              {t('app.kuaizhizao.performance.holidays.importCn.presetHint')}
            </Typography.Text>
          ) : null}
        </Form.Item>
        <Space direction="vertical" size={0}>
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.performance.holidays.importCn.rules.legal')}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.performance.holidays.importCn.rules.makeup')}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.performance.holidays.importCn.rules.skip')}
          </Typography.Text>
        </Space>
      </Form>
    </Modal>
  );
};

export default HolidayCnImportModal;
