import type { DrawingSecurityLevel } from '../../../services/drawing';
import type {
  DrawingWatermarkPolicy,
  DrawingWatermarkPosition,
  DrawingWatermarkStyle,
} from '../../../services/drawingWatermark';

export const DEFAULT_DRAWING_WATERMARK_TEMPLATE =
  '{user} {time} {code}-{revision} {securityLevel}';

const SECURITY_LEVEL_LABELS: Record<DrawingSecurityLevel, string> = {
  public: '公开',
  internal: '内部',
  secret: '秘密',
  confidential: '机密',
};

export function templateForSecurityLevel(
  policy: Pick<
    DrawingWatermarkPolicy,
    'templatePublic' | 'templateInternal' | 'templateSecret' | 'templateConfidential'
  >,
  level: DrawingSecurityLevel,
): string {
  const map: Record<DrawingSecurityLevel, string> = {
    public: policy.templatePublic,
    internal: policy.templateInternal,
    secret: policy.templateSecret,
    confidential: policy.templateConfidential,
  };
  const raw = map[level]?.trim();
  return raw || DEFAULT_DRAWING_WATERMARK_TEMPLATE;
}

export function renderWatermarkTemplate(
  template: string,
  ctx: {
    user: string;
    time: string;
    code: string;
    revision: string;
    securityLevel: DrawingSecurityLevel;
    siteName: string;
  },
): string {
  const levelLabel = SECURITY_LEVEL_LABELS[ctx.securityLevel] ?? ctx.securityLevel;
  const text = template
    .replaceAll('{user}', ctx.user)
    .replaceAll('{time}', ctx.time)
    .replaceAll('{code}', ctx.code)
    .replaceAll('{revision}', ctx.revision)
    .replaceAll('{securityLevel}', levelLabel)
    .replaceAll('{siteName}', ctx.siteName);
  return text.replace(/\s+/g, ' ').trim();
}

export function applyWatermarkOpacity(color: string, opacity: number): string {
  const match = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return color;
  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length < 3) return color;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
}

export function watermarkPositionCss(position: DrawingWatermarkPosition): {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform: string;
} {
  const angleSuffix = (angle: number) => `rotate(${angle}deg)`;
  switch (position) {
    case 'center':
      return {
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) ${angleSuffix(0)}`.trim(),
      };
    case 'topLeft':
      return { top: '8%', left: '8%', transform: angleSuffix(0) };
    case 'topRight':
      return { top: '8%', right: '8%', left: 'auto', transform: angleSuffix(0) };
    case 'bottomLeft':
      return { bottom: '8%', left: '8%', top: 'auto', transform: angleSuffix(0) };
    case 'bottomRight':
      return { bottom: '8%', right: '8%', left: 'auto', top: 'auto', transform: angleSuffix(0) };
    case 'diagonal':
    default:
      return { top: '40%', left: '10%', transform: angleSuffix(-25) };
  }
}

export function buildWatermarkInlineStyle(style: DrawingWatermarkStyle): string {
  const pos = watermarkPositionCss(style.position);
  const color = applyWatermarkOpacity(style.color, style.opacity);
  const rotate =
    style.position === 'diagonal'
      ? `rotate(${style.angle}deg)`
      : pos.transform.includes('rotate')
        ? pos.transform
        : `rotate(${style.angle}deg)`;
  const transform =
    style.position === 'center'
      ? `translate(-50%, -50%) rotate(${style.angle}deg)`
      : rotate;
  return [
    'position:fixed',
    pos.top ? `top:${pos.top}` : '',
    pos.left ? `left:${pos.left}` : '',
    pos.right ? `right:${pos.right}` : '',
    pos.bottom ? `bottom:${pos.bottom}` : '',
    `font-size:${style.fontSize}px`,
    `color:${color}`,
    `transform:${transform}`,
    'pointer-events:none',
    'z-index:0',
    'white-space:pre-wrap',
    'max-width:80%',
  ]
    .filter(Boolean)
    .join(';');
}
