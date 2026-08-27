import React from 'react';
import { Priority } from '../../types/domain';
import { PRIORITY_CONFIG } from '../../domain/constants';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.bgClass} ${config.textClass} ${config.borderClass} ${
        isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className={`rounded-full ${config.dotClass} ${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      <span>{config.label}</span>
    </span>
  );
};
