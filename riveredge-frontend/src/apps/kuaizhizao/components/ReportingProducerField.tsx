/**
 * 报工「生产人员」字段：标题行右侧重叠分段切换 生产人员 / 工作小组，小组支持快速新建。
 * 分段器须在 Form.Item label 之外，避免 label 关联焦点 / mousedown 拦截导致无法切换。
 * 外层只输出一列 Col；内部关闭 ProForm grid，避免 Select 再套 Col 导致左右双重 gutter。
 */
import React, { useCallback } from 'react';
import { Col, Form, theme } from 'antd';
import { ProFormItem } from '@ant-design/pro-components';
import { GridContext } from '@ant-design/pro-form';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { UniUserSelect } from '../../../components/uni-user-select';
import type { User } from '../../../services/user';
import { WorkGroupSelectDropdown } from '../../master-data/components/WorkGroupSelectDropdown';
import type { WorkGroup } from '../../master-data/types/factory';

export type ReportingProducerMode = 'worker' | 'team';

export type ReportingProducerFieldProps = {
  /** 生产人员表单字段（uuid） */
  workerFieldName?: string;
  /** 工作小组表单字段（id） */
  teamFieldName?: string;
  /** 工作小组名称表单字段（提交用） */
  teamNameFieldName?: string;
  /** 模式字段，默认 producer_mode */
  modeFieldName?: string;
  defaultBadgeUserIds?: number[];
  onWorkerChange?: (user: Pick<User, 'id' | 'full_name' | 'username'> | null) => void;
  onTeamChange?: (team: { id: number; name: string } | null) => void;
  colProps?: { span?: number; xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  modalZIndex?: number;
};

export const ReportingProducerField: React.FC<ReportingProducerFieldProps> = ({
  workerFieldName = 'proxy_worker_uuid',
  teamFieldName = 'report_team_id',
  teamNameFieldName = 'report_team_name',
  modeFieldName = 'producer_mode',
  defaultBadgeUserIds,
  onWorkerChange,
  onTeamChange,
  colProps = { span: 12 },
  modalZIndex,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const mode = (Form.useWatch(modeFieldName, form) as ReportingProducerMode | undefined) || 'worker';

  const handleModeChange = useCallback(
    (next: ReportingProducerMode) => {
      form?.setFieldsValue({
        [modeFieldName]: next,
        ...(next === 'worker'
          ? { [teamFieldName]: undefined, [teamNameFieldName]: undefined }
          : { [workerFieldName]: undefined }),
      });
      if (next === 'worker') {
        onTeamChange?.(null);
      } else {
        onWorkerChange?.(null);
      }
    },
    [
      form,
      modeFieldName,
      onTeamChange,
      onWorkerChange,
      teamFieldName,
      teamNameFieldName,
      workerFieldName,
    ],
  );

  return (
    <Col {...colProps}>
      <GridContext.Provider value={{ grid: false }}>
        <ProFormItem name={modeFieldName} initialValue="worker" hidden>
          <input type="hidden" />
        </ProFormItem>
        <ProFormItem name={teamNameFieldName} hidden>
          <input type="hidden" />
        </ProFormItem>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: token.marginXXS,
            minHeight: token.controlHeightSM,
          }}
        >
          <span
            style={{
              color: token.colorTextHeading,
              fontSize: token.fontSize,
              lineHeight: token.lineHeight,
            }}
          >
            {t('app.kuaizhizao.workReporting.formProxyWorker')}
          </span>
          <ThemedSegmented
            size="small"
            value={mode}
            options={[
              {
                label: t('app.kuaizhizao.workReporting.producerModeWorker'),
                value: 'worker',
              },
              {
                label: t('app.kuaizhizao.workReporting.producerModeTeam'),
                value: 'team',
              },
            ]}
            onChange={(v) => handleModeChange(v as ReportingProducerMode)}
            style={{ background: token.colorFillAlter }}
          />
        </div>
        {mode === 'worker' ? (
          <UniUserSelect
            name={workerFieldName}
            label={false}
            placeholder={t('app.kuaizhizao.workReporting.formProxyWorkerPlaceholder')}
            defaultBadgeUserIds={defaultBadgeUserIds}
            style={{ width: '100%' }}
            formItemProps={{ style: { marginBottom: token.marginLG, width: '100%' } }}
            onChange={(_uuid, u) => {
              onWorkerChange?.(
                u && !Array.isArray(u)
                  ? { id: u.id, full_name: u.full_name, username: u.username }
                  : null,
              );
            }}
          />
        ) : (
          <ProFormItem
            name={teamFieldName}
            style={{ marginBottom: token.marginLG, width: '100%' }}
            rules={[
              {
                required: true,
                message: t('app.kuaizhizao.workReporting.formWorkGroupRequired'),
              },
            ]}
          >
            <WorkGroupSelectDropdown
              placeholder={t('app.kuaizhizao.workReporting.formWorkGroupPlaceholder')}
              modalZIndex={modalZIndex}
              style={{ width: '100%' }}
              onWorkGroupPick={(wg: WorkGroup | null) => {
                if (!wg) {
                  form?.setFieldsValue({ [teamNameFieldName]: undefined });
                  onTeamChange?.(null);
                  return;
                }
                const picked = {
                  id: Number(wg.id),
                  name: String(wg.name || '').trim(),
                };
                form?.setFieldsValue({ [teamNameFieldName]: picked.name });
                onTeamChange?.(picked);
              }}
            />
          </ProFormItem>
        )}
      </GridContext.Provider>
    </Col>
  );
};
