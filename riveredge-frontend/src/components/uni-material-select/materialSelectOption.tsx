/**
 * 物料下拉选项统一展示：编号/名称 + 规格/型号 + 缩略图（名称可能重复时用于区分）
 */
import React from 'react';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../secure-image';

export const MATERIAL_SELECT_OPTION_ITEM_HEIGHT = 56;

function pickField(m: Record<string, unknown>, key: string): string {
  if (m == null || typeof m !== 'object') return '';
  const camel = m[key];
  if (camel != null && String(camel).trim()) return String(camel).trim();
  const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase();
  const snakeVal = m[snake];
  if (snakeVal != null && String(snakeVal).trim()) return String(snakeVal).trim();
  return '';
}

export function resolveMaterialSelectImageFileUuid(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const val = raw.trim();
    return /^[0-9a-fA-F-]{32,36}$/.test(val) ? val : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { uuid?: unknown; uid?: unknown };
  const uuid = typeof obj.uuid === 'string' ? obj.uuid.trim() : '';
  if (/^[0-9a-fA-F-]{32,36}$/.test(uuid)) return uuid;
  const uid = typeof obj.uid === 'string' ? obj.uid.trim() : '';
  if (/^[0-9a-fA-F-]{32,36}$/.test(uid)) return uid;
  return null;
}

/** 选中标签 / 搜索用纯文本：编号 - 名称（规格 / 型号） */
export function formatMaterialSelectLabel(m: Record<string, unknown> | null | undefined): string {
  if (!m) return '';
  const mainCode = pickField(m, 'mainCode') || pickField(m, 'code');
  const nameVal = pickField(m, 'name');
  const specification = pickField(m, 'specification');
  const model = pickField(m, 'model');
  const primary = `${mainCode} - ${nameVal}`.trim().replace(/^-\s*|-\s*$/g, '').trim();
  const extras = [specification, model].filter(Boolean).join(' / ');
  if (primary && extras) return `${primary}（${extras}）`;
  if (primary) return primary;
  if (extras) return extras;
  return String(m.id ?? m.uuid ?? '');
}

export type MaterialSelectOptionContentProps = {
  material: Record<string, unknown> | null | undefined;
  /** 无物料数据时的回退文案 */
  fallbackLabel?: React.ReactNode;
};

export const MaterialSelectOptionContent: React.FC<MaterialSelectOptionContentProps> = ({
  material,
  fallbackLabel,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  if (!material) {
    return <span>{fallbackLabel ?? '-'}</span>;
  }

  const mainCode = pickField(material, 'mainCode') || pickField(material, 'code');
  const nameVal = pickField(material, 'name');
  const specification = pickField(material, 'specification');
  const model = pickField(material, 'model');
  const images = Array.isArray(material.images) ? material.images : [];
  const fileUuid = images.length ? resolveMaterialSelectImageFileUuid(images[0]) : null;

  const metaParts: string[] = [];
  if (specification) {
    metaParts.push(`${t('app.master-data.materials.specification')}: ${specification}`);
  }
  if (model) {
    metaParts.push(`${t('app.master-data.materials.model')}: ${model}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minWidth: 0,
        padding: '2px 0',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: token.borderRadiusSM,
          overflow: 'hidden',
          background: token.colorFillAlter,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: token.colorTextQuaternary,
          fontSize: 12,
        }}
      >
        {fileUuid ? (
          <SecureImage
            fileUuid={fileUuid}
            width={40}
            height={40}
            lazyLoad
            thumbSize={64}
            alt={nameVal || mainCode || t('app.master-data.materials.productImage')}
          />
        ) : (
          '-'
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {mainCode ? `${mainCode} - ${nameVal}` : nameVal || fallbackLabel || '-'}
        </div>
        {metaParts.length > 0 ? (
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: token.colorTextSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {metaParts.join('  ')}
          </div>
        ) : null}
      </div>
    </div>
  );
};
