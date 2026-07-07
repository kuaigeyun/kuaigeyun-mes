/**
 * 平台管理 · 构建来源汇总（仅 kuaigeyun.com 官方 SaaS）
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Statistic, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import { UniTable } from '../../../components/uni-table';
import {
  getInstallRepoSummary,
  type InstallRepoSummaryItem,
} from '../../../services/platformSettings';

const { Paragraph } = Typography;

export default function BuildProvenanceSummaryTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['installRepoSummary'],
    queryFn: getInstallRepoSummary,
    retry: false,
  });

  const columns: ProColumns<InstallRepoSummaryItem>[] = [
    {
      title: t('pages.infra.provenanceSummary.remote'),
      dataIndex: 'build_git_remote',
      ellipsis: true,
    },
    {
      title: t('pages.infra.provenanceSummary.instanceCount'),
      dataIndex: 'instance_count',
      width: 120,
    },
    {
      title: t('pages.infra.provenanceSummary.lastSeenAt'),
      dataIndex: 'last_seen_at',
      width: 200,
      render: (_, record) => record.last_seen_at || '—',
    },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('pages.infra.provenanceSummary.noticeTitle')}
        description={data?.disclaimer || t('pages.infra.provenanceSummary.disclaimerFallback')}
      />

      <Card style={{ marginBottom: 16 }}>
        <Statistic
          title={t('pages.infra.provenanceSummary.officialRemoteCount')}
          value={data?.official_remote_count ?? 0}
          loading={isLoading}
        />
      </Card>

      {isError ? (
        <Alert type="error" message={t('pages.infra.provenanceSummary.loadFailed')} />
      ) : (
        <>
          <Paragraph strong style={{ marginBottom: 12 }}>
            {t('pages.infra.provenanceSummary.nonOfficialTitle')}
          </Paragraph>
          <UniTable<InstallRepoSummaryItem>
            rowKey="build_git_remote"
            columns={columns}
            dataSource={data?.non_official_remotes ?? []}
            loading={isLoading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            search={false}
            options={false}
            toolBarRender={false}
          />
        </>
      )}
    </div>
  );
}
