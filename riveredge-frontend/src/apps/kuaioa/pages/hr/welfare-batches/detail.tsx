import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, InputNumber, Space, Switch, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { exportWelfareRegisterXlsx } from '../../../utils/exportWelfareRegisterXlsx';
import {
  confirmWelfareBatch,
  getWelfareBatch,
  rebuildWelfareBatch,
  reopenWelfareBatch,
  updateWelfareLine,
} from '../../../services/welfare';

type LineRow = Record<string, unknown> & { id: number; employee_name: string };

const WelfareBatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const batchId = Number(id);
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const perms = useResourcePermissions('kuaioa:welfare');
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(batchId) || batchId <= 0) return;
    setLoading(true);
    try {
      setBatch(await getWelfareBatch(batchId));
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [batchId, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = batch?.status === 'confirmed';
  const lines = (batch?.lines as LineRow[] | undefined) || [];
  const festivalKey = String(batch?.festival_type || '');
  const festivalLabel = festivalKey
    ? t(`app.kuaioa.welfare.festival.${festivalKey}`)
    : '';

  const patchLine = async (lineId: number, patch: Record<string, unknown>) => {
    if (!perms.canUpdate) return;
    if (locked && 'amount' in patch) return;
    try {
      await updateWelfareLine(batchId, lineId, patch);
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const columns: ColumnsType<LineRow> = [
    {
      title: t('app.kuaioa.welfare.seq'),
      key: 'seq',
      width: 64,
      render: (_v, _r, index) => index + 1,
    },
    {
      title: t('app.kuaioa.employee.fullName'),
      dataIndex: 'employee_name',
      width: 120,
      fixed: 'left',
    },
    {
      title: t('app.kuaioa.welfare.standardAmount'),
      dataIndex: 'standard_amount',
      width: 110,
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      title: t('app.kuaioa.welfare.amount'),
      dataIndex: 'amount',
      width: 120,
      render: (v, row) =>
        !locked && perms.canUpdate ? (
          <InputNumber
            size="small"
            min={0}
            changeOnBlur
            value={Number(v || 0)}
            onChange={(next) => {
              if (next === null || next === undefined) return;
              if (Number(next) === Number(v || 0)) return;
              void patchLine(Number(row.id), { amount: Number(next) });
            }}
            style={{ width: 100 }}
          />
        ) : (
          Number(v || 0).toFixed(2)
        ),
    },
    {
      title: t('app.kuaioa.welfare.sign'),
      key: 'sign',
      width: 100,
      render: () => '',
    },
    {
      title: t('app.kuaioa.welfare.received'),
      dataIndex: 'received',
      width: 100,
      render: (v, row) => (
        <Switch
          size="small"
          checked={!!v}
          disabled={!perms.canUpdate}
          onChange={(checked) => {
            void patchLine(Number(row.id), { received: checked });
          }}
        />
      ),
    },
  ];

  return (
    <ListPageTemplate
      title={t('app.kuaioa.welfare.sheetTitle', {
        year: batch?.year || '',
        festival: festivalLabel,
      })}
      toolbarExtra={
        <Space wrap>
          <Button onClick={() => navigate('/apps/kuaioa/hr/welfare-batches')}>
            {t('common.back')}
          </Button>
          {!locked && perms.canUpdate ? (
            <Button
              onClick={async () => {
                try {
                  await rebuildWelfareBatch(batchId);
                  message.success(t('app.kuaioa.welfare.rebuilt'));
                  await load();
                } catch (error) {
                  message.error(getApiErrorMessage(error));
                }
              }}
            >
              {t('app.kuaioa.welfare.rebuild')}
            </Button>
          ) : null}
          {!locked && perms.canAction?.('submit') ? (
            <Button
              type="primary"
              onClick={async () => {
                try {
                  await confirmWelfareBatch(batchId);
                  message.success(t('common.success'));
                  await load();
                } catch (error) {
                  message.error(getApiErrorMessage(error));
                }
              }}
            >
              {t('app.kuaioa.welfare.confirm')}
            </Button>
          ) : null}
          {locked && perms.canUpdate ? (
            <Button
              onClick={async () => {
                try {
                  await reopenWelfareBatch(batchId);
                  message.success(t('common.success'));
                  await load();
                } catch (error) {
                  message.error(getApiErrorMessage(error));
                }
              }}
            >
              {t('app.kuaioa.welfare.reopen')}
            </Button>
          ) : null}
          {perms.canExport && lines.length > 0 ? (
            <Button
              onClick={() =>
                void exportWelfareRegisterXlsx(lines, {
                  title: t('app.kuaioa.welfare.sheetTitle', {
                    year: batch?.year || '',
                    festival: festivalLabel,
                  }),
                  departmentLabel: t('app.kuaioa.welfare.departmentLabel', {
                    name: String(batch?.workshop_name || ''),
                  }),
                  headers: {
                    seq: t('app.kuaioa.welfare.seq'),
                    name: t('app.kuaioa.employee.fullName'),
                    amount: t('app.kuaioa.welfare.amount'),
                    sign: t('app.kuaioa.welfare.sign'),
                  },
                  fileName: `${t('app.kuaioa.welfare.exportFileName')}_${batch?.year || ''}_${festivalLabel}`,
                }).catch((error) => message.error(getApiErrorMessage(error)))
              }
            >
              {t('common.export')}
            </Button>
          ) : null}
        </Space>
      }
    >
      <Typography.Paragraph>
        {t('app.kuaioa.welfare.departmentLabel', {
          name: String(batch?.workshop_name || ''),
        })}
      </Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Text>
          {t('app.kuaioa.welfare.lineCount')}: {Number(batch?.line_count || lines.length)}
        </Typography.Text>
        <Typography.Text>
          {t('app.kuaioa.welfare.amountTotal')}: {Number(batch?.amount_total || 0).toFixed(2)}
        </Typography.Text>
      </Space>
      <Table<LineRow>
        size="small"
        loading={loading}
        rowKey="id"
        columns={columns}
        dataSource={lines}
        pagination={false}
        bordered
        scroll={{ x: 500 }}
      />
    </ListPageTemplate>
  );
};

export default WelfareBatchDetailPage;
