import { Button, Descriptions, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getClientReleasesByApp, type ClientRelease } from '../../../../services/clientRelease';

type Props = {
  appCode: string;
};

export function ApplicationClientReleasesPanel({ appCode }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['clientReleasesByApp', appCode],
    queryFn: () => getClientReleasesByApp(appCode),
    enabled: Boolean(appCode),
  });

  if (isLoading) {
    return <Typography.Text type="secondary">加载客户端发布信息…</Typography.Text>;
  }
  if (!data?.length) {
    return null;
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Text strong>关联客户端</Typography.Text>
      {data.map((r: ClientRelease) => (
        <Descriptions key={r.id} column={1} size="small" bordered>
          <Descriptions.Item label="客户端">{r.client_key}</Descriptions.Item>
          <Descriptions.Item label="版本">
            {r.app_version}
            {r.version_code ? ` (${r.version_code})` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="平台">{r.platform}</Descriptions.Item>
          {(r.package?.url || r.apk?.url) && (
            <Descriptions.Item label="安装包">
              <a href={r.package?.url || r.apk?.url} target="_blank" rel="noreferrer">
                下载
              </a>
            </Descriptions.Item>
          )}
          {r.release_notes ? (
            <Descriptions.Item label="说明">{r.release_notes}</Descriptions.Item>
          ) : null}
        </Descriptions>
      ))}
      <Link to={`/infra/client-releases?app_code=${encodeURIComponent(appCode)}`} target="_blank">
        <Button type="link" size="small" style={{ padding: 0 }}>
          在平台控制台管理发布（需平台超管）
        </Button>
      </Link>
    </Space>
  );
}
