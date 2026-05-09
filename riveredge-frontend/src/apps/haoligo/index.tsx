/**
 * 好力GO（haoligo）应用入口 — 专用应用占位页
 *
 * 业务页面按 riveredge-adapt/haoli-go/PLAN.md 迭代；后端 API 前缀 /api/v1/apps/haoligo
 */

import React from 'react';

const HaoligoApp: React.FC = () => (
  <div style={{ padding: '48px 24px', maxWidth: 640, margin: '0 auto' }}>
    <h2 style={{ marginBottom: 12 }}>好力GO</h2>
    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
      本应用为<strong>定制应用</strong>：仅在平台将本应用授权绑定到当前组织后，组织内用户可在应用中心看到并安装启用。
    </p>
    <p style={{ color: 'var(--color-text-tertiary)', marginTop: 16, fontSize: 14 }}>
      Web 端页面与菜单将在此目录（<code>src/apps/haoligo</code>）逐步接入。
    </p>
  </div>
);

export default HaoligoApp;
