import React from 'react';
import { CheckCircle2, Clock, Layers, TrendingUp } from 'lucide-react';

export default function SummaryCards({ tasks = [] }) {
  const total = tasks.length;
  const active = tasks.filter((t) => !t.completed).length;
  const completed = tasks.filter((t) => t.completed).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const cards = [
    {
      label: 'Total Tasks',
      value: total,
      subtext: 'All tracked tasks',
      icon: Layers,
      accentColor: 'var(--accent-cyan)',
      bgGlow: 'rgba(84, 200, 232, 0.1)',
    },
    {
      label: 'Active Tasks',
      value: active,
      subtext: 'In progress',
      icon: Clock,
      accentColor: 'var(--accent-amber)',
      bgGlow: 'rgba(255, 179, 71, 0.1)',
    },
    {
      label: 'Completed Tasks',
      value: completed,
      subtext: 'Successfully closed',
      icon: CheckCircle2,
      accentColor: 'var(--accent-primary)',
      bgGlow: 'rgba(56, 242, 165, 0.1)',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      subtext: `${completed} of ${total} finished`,
      icon: TrendingUp,
      accentColor: 'var(--accent-primary)',
      bgGlow: 'rgba(56, 242, 165, 0.1)',
      showProgress: true,
      percentage: completionRate,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '18px 20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top row: Label + Icon badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {card.label}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: card.bgGlow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.accentColor,
                }}
              >
                <Icon size={16} />
              </div>
            </div>

            {/* Metric Value */}
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {card.value}
            </div>

            {/* Subtext or Progress bar */}
            {card.showProgress ? (
              <div style={{ marginTop: '10px' }}>
                <div
                  style={{
                    height: '5px',
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                    marginBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${card.percentage}%`,
                      background: 'linear-gradient(90deg, #54C8E8, #38F2A5)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.4s ease-out',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{card.subtext}</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {card.subtext}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
