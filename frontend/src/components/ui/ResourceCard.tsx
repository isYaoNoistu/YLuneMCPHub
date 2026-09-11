import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, Edit } from '@/components/icons/LucideIcons';
import { Resource } from '@/types';
import { Switch } from './ToggleGroup';
import ResetDescriptionButton from './ResetDescriptionButton';
import { formatTokens } from '@/utils/contextCost';

interface ResourceCardProps {
  resource: Resource;
  readOnly?: boolean;
  onToggle?: (resourceUri: string, enabled: boolean) => void;
  onDescriptionUpdate?: (
    resourceUri: string,
    description: string,
    options?: { restored?: boolean },
  ) => Promise<void> | void;
  cost?: number;
}

const ResourceCard = ({ resource, readOnly = false, onToggle, onDescriptionUpdate, cost }: ResourceCardProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isResettingDescription, setIsResettingDescription] = useState(false);
  const [customDescription, setCustomDescription] = useState(resource.description || '');
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, [isEditingDescription]);

  useEffect(() => {
    setCustomDescription(resource.description || '');
  }, [resource.description]);

  const resourceDisplayName = resource.name || resource.uri;

  const handleToggle = (enabled: boolean) => {
    if (!readOnly && onToggle) {
      onToggle(resource.uri, enabled);
    }
  };

  const handleDescriptionSave = async () => {
    if (readOnly) return;
    setIsEditingDescription(false);
    if (onDescriptionUpdate) {
      await onDescriptionUpdate(resource.uri, customDescription);
    }
  };

  const handleDescriptionReset = async () => {
    if (readOnly) return;
    setIsResettingDescription(true);
    try {
      await onDescriptionUpdate?.(resource.uri, '', { restored: true });
      setIsEditingDescription(false);
    } finally {
      setIsResettingDescription(false);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleDescriptionSave();
    } else if (e.key === 'Escape') {
      setCustomDescription(resource.description || '');
      setIsEditingDescription(false);
    }
  };

  return (
    <div className={`hub-cap-item${isExpanded ? ' is-open' : ''}${resource.enabled === false ? ' is-off' : ''}`}>
      <div
        className="hub-cap-item-main"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="hub-cap-copy">
          <div className="hub-cap-name-row">
            <span className="hub-cap-name">{resourceDisplayName}</span>
            <span className="hub-cap-kicker hub-mono">{resource.uri}</span>
            {!readOnly && !isEditingDescription && (
              <>
                <button
                  type="button"
                  className="hub-icon-btn sm hub-cap-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingDescription(true);
                  }}
                  title={t('server.edit')}
                >
                  <Edit size={12} />
                </button>
                <span className="hub-cap-ghost">
                  <ResetDescriptionButton
                    title={t('builtinResources.restoreDefault')}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDescriptionReset();
                    }}
                    disabled={isResettingDescription}
                    loading={isResettingDescription}
                  />
                </span>
              </>
            )}
          </div>
          {isEditingDescription ? (
            <div className="hub-cap-edit" onClick={(e) => e.stopPropagation()}>
              <input
                ref={descriptionInputRef}
                type="text"
                className="hub-input hub-cap-edit-input"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                onKeyDown={handleDescriptionKeyDown}
              />
              <button
                type="button"
                className="hub-icon-btn sm"
                onClick={() => void handleDescriptionSave()}
                disabled={isResettingDescription}
                title={t('common.save')}
              >
                <Check size={12} style={{ color: 'var(--hub-ok)' }} />
              </button>
              <ResetDescriptionButton
                title={t('builtinResources.restoreDefault')}
                onClick={() => void handleDescriptionReset()}
                disabled={isResettingDescription}
                loading={isResettingDescription}
              />
            </div>
          ) : (
            <p className="hub-cap-desc">{customDescription || t('tool.noDescription')}</p>
          )}
        </div>
        <div className="hub-cap-acts">
          {cost != null && (
            <span className="hub-cap-cost" title={t('cost.estimate')}>
              {formatTokens(cost)}
            </span>
          )}
          <div className="flex h-[26px] items-center" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={resource.enabled !== false}
              onCheckedChange={handleToggle}
              disabled={readOnly}
              size="card"
              aria-label={`${t(resource.enabled !== false ? 'server.disable' : 'server.enable')} ${resourceDisplayName}`}
            />
          </div>
          <button type="button" className="hub-icon-btn sm" aria-hidden="true">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="hub-cap-body">
          <span className="hub-sect">{t('builtinResources.mimeType')}:</span>{' '}
          <span style={{ fontSize: 12, color: 'var(--hub-ink-2)' }}>{resource.mimeType || 'text/plain'}</span>
        </div>
      )}
    </div>
  );
};

export default ResourceCard;
