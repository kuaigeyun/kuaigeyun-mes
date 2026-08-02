import React, { useEffect, useState } from 'react';
import { Button, message, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Render, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { dashboardPuckConfig } from '../puck/config';
import { EMPTY_PUCK_DATA, normalizePuckData } from '../puck/types';
import { getDashboard } from '../services/kuaireport';

const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { id: idFromParams } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const id = idFromParams || searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [puckData, setPuckData] = useState<Data>(EMPTY_PUCK_DATA);

  useEffect(() => {
    if (!id) {
      message.error('未指定看板ID');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await getDashboard(id);
        if (!res) return;
        setName(res.name || '');
        setPuckData(normalizePuckData(res.layout_config));
      } catch {
        message.error('加载看板失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050a0f' }}>
        <Spin size="large" tip="加载大屏中...">
          <div style={{ minHeight: 24 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#050a0f',
        overflow: 'auto',
        position: 'relative',
        color: '#fff',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: 0.2,
          transition: 'opacity 0.3s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.2';
        }}
      >
        <Button
          ghost
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ borderColor: 'rgba(255,255,255,0.3)' }}
        >
          返回
        </Button>
        <span style={{ fontSize: 18, fontWeight: 'bold', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>{name}</span>
      </div>

      <div style={{ minHeight: '100%' }}>
        <Render config={dashboardPuckConfig} data={puckData} />
      </div>
    </div>
  );
};

export default DashboardView;
