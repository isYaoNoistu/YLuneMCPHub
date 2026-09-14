import type { LucideIcon } from 'lucide-react';
import type { ServerCost } from '@/types';
import { formatTokens } from '@/utils/contextCost';

export type CapabilityTabKey = 'tools' | 'prompts' | 'resources';
export type ExpandedTabKey = CapabilityTabKey | 'cost';

export interface CapabilitySummary {
  key: CapabilityTabKey;
  icon: LucideIcon;
  label: string;
  total: number;
  enabled: number;
}

export const CapabilityIcon = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className="hub-server-capability-icon" aria-hidden="true">
    <Icon size={11.5} strokeWidth={1.9} className="block" />
  </span>
);

interface CapabilityTabsProps {
  summaries: CapabilitySummary[];
  activeTab: ExpandedTabKey | null;
  cost?: ServerCost;
  costEstimateLabel: string;
  costTotalFootprintLabel: string;
  onToggle: (tab: ExpandedTabKey) => void;
}

const CapabilityTabs = ({
  summaries,
  activeTab,
  cost,
  costEstimateLabel,
  costTotalFootprintLabel,
  onToggle,
}: CapabilityTabsProps) => (
  <>
    {summaries.map((tab) => {
      const active = activeTab === tab.key;
      return (
        <button
          key={tab.key}
          onClick={() => onToggle(tab.key)}
          className={`hub-cap-tab${active ? ' is-active' : ''}`}
        >
          <CapabilityIcon icon={tab.icon} />
          <span>{tab.label}</span>
          <span
            className="hub-mono hub-num"
            style={{ color: 'var(--hub-ink-3)', fontSize: 11 }}
          >
            {tab.total === 0 ? '0' : `${tab.enabled}/${tab.total}`}
          </span>
        </button>
      );
    })}

    {cost && cost.connected && (
      <button
        onClick={() => onToggle('cost')}
        className={`hub-cap-tab${activeTab === 'cost' ? ' is-active' : ''}`}
        title={costEstimateLabel}
      >
        <span style={{ color: 'var(--hub-ink-3)' }}>Σ</span>
        <span>{costTotalFootprintLabel}</span>
        <span
          className="hub-mono hub-num"
          style={{ color: 'var(--hub-ink-3)', fontSize: 11 }}
        >
          {formatTokens(cost.exposed)}/{formatTokens(cost.gross)}
        </span>
      </button>
    )}
  </>
);

export default CapabilityTabs;
