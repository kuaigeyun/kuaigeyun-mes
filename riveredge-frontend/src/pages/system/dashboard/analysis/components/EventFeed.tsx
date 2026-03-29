import React, { useId } from 'react';
import type { TFunction } from 'i18next';
import type { FeedItem } from '../mockData';

const levelDot: Record<FeedItem['level'], string> = {
  info: 'rgba(56, 189, 248, 0.55)',
  warn: 'rgba(251, 191, 36, 0.55)',
  risk: 'rgba(244, 63, 94, 0.55)',
};

export const EventFeed: React.FC<{ items: FeedItem[]; t: TFunction }> = ({ items, t }) => {
  const animId = useId().replace(/:/g, '');
  const scrollKey = `event-scroll-${animId}`;
  const scrollItems = [...items, ...items];

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
        maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
      }}
    >
      <style>
        {`
          @keyframes ${scrollKey} {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          .event-feed-container {
            animation: ${scrollKey} 48s linear infinite;
          }
          .event-feed-container:hover {
            animation-play-state: paused;
          }
          @media (prefers-reduced-motion: reduce) {
            .event-feed-container {
              animation: none !important;
            }
          }
        `}
      </style>
      <div
        className="event-feed-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {scrollItems.map((it, idx) => (
          <div
            key={`${it.id}-${idx}`}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  marginTop: 6,
                  flexShrink: 0,
                  background: levelDot[it.level],
                  boxShadow: `0 0 6px ${levelDot[it.level]}`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{t(it.titleKey)}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#64748b',
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      flexShrink: 0,
                    }}
                  >
                    {it.time}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.45, letterSpacing: 0.1 }}>
                  {t(it.detailKey)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
