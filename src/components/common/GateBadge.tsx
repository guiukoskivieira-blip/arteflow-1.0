import React from 'react';
import { ArtworkGate, MaterialGate, FinancialGate } from '../../types/domain';
import { ARTWORK_GATE_CONFIG, MATERIAL_GATE_CONFIG, FINANCIAL_GATE_CONFIG } from '../../domain/constants';
import { Palette, Box, DollarSign, AlertCircle } from 'lucide-react';

interface GateBadgeProps {
  type: 'artwork' | 'material' | 'financial';
  value: ArtworkGate | MaterialGate | FinancialGate;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const GateBadge: React.FC<GateBadgeProps> = ({
  type,
  value,
  size = 'sm',
  showLabel = true,
}) => {
  let config: { label: string; bgClass: string; textClass: string; borderClass: string; isBlocking: boolean };
  let Icon = Palette;
  let titlePrefix = 'Arte';

  if (type === 'artwork') {
    config = ARTWORK_GATE_CONFIG[value as ArtworkGate] || ARTWORK_GATE_CONFIG.NOT_RECEIVED;
    Icon = Palette;
    titlePrefix = 'Controle de Arte';
  } else if (type === 'material') {
    config = MATERIAL_GATE_CONFIG[value as MaterialGate] || MATERIAL_GATE_CONFIG.NOT_CHECKED;
    Icon = Box;
    titlePrefix = 'Controle de Material';
  } else {
    config = FINANCIAL_GATE_CONFIG[value as FinancialGate] || FINANCIAL_GATE_CONFIG.RELEASED;
    Icon = DollarSign;
    titlePrefix = 'Controle Financeiro';
  }

  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border ${config.bgClass} ${config.textClass} ${config.borderClass} ${
        isSmall ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      }`}
      title={`${titlePrefix}: ${config.label}${config.isBlocking ? ' (Bloqueia produção)' : ''}`}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {showLabel && <span>{config.label}</span>}
      {config.isBlocking && (
        <AlertCircle className={`text-red-600 ${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      )}
    </span>
  );
};
