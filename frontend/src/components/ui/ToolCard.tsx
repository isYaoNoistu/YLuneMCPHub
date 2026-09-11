import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tool } from '@/types';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader,
  Edit,
  Check,
  Copy,
} from '@/components/icons/LucideIcons';
import {
  callTool,
  ToolCallResult,
  updateToolDescription,
  resetToolDescription,
} from '@/services/toolService';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useToast } from '@/contexts/ToastContext';
import { Switch } from './ToggleGroup';
import DynamicForm from './DynamicForm';
import ToolResult from './ToolResult';
import ResetDescriptionButton from './ResetDescriptionButton';
import { formatTokens } from '@/utils/contextCost';
import { getToolDescriptionInfo } from '@/utils/toolDescription';

interface ToolCardProps {
  server: string;
  tool: Tool;
  readOnly?: boolean;
  onToggle?: (toolName: string, enabled: boolean) => void;
  onDescriptionUpdate?: (
    toolName: string,
    description: string,
    options?: { restored?: boolean },
  ) => void;
  cost?: number;
}

// Helper to check for "empty" values
function isEmptyValue(value: any): boolean {
  if (value == null) return true; // null or undefined
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

const ToolCard = ({ tool, server, readOnly = false, onToggle, onDescriptionUpdate, cost }: ToolCardProps) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { nameSeparator } = useSettingsData();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRunForm, setShowRunForm] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ToolCallResult | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isResettingDescription, setIsResettingDescription] = useState(false);
  const [customDescription, setCustomDescription] = useState(tool.description || '');
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedToolName, setCopiedToolName] = useState(false);

  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, [isEditingDescription]);

  useEffect(() => {
    setCustomDescription(tool.description || '');
  }, [tool.description]);

  const toolDisplayName = tool.name.replace(server + nameSeparator, '');
  const descriptionInfo = getToolDescriptionInfo(tool, t('tool.noDescription'));
  const defaultDescriptionTooltip = descriptionInfo.hasDescriptionOverride
    ? t('tool.defaultDescriptionTooltip', {
        description: descriptionInfo.defaultDescription,
      })
    : undefined;

  // Generate a unique key for localStorage based on tool name and server
  const getStorageKey = useCallback(() => {
    return `mcphub_tool_form_${server ? `${server}_` : ''}${tool.name}`;
  }, [tool.name, server]);

  // Clear form data from localStorage
  const clearStoredFormData = useCallback(() => {
    localStorage.removeItem(getStorageKey());
  }, [getStorageKey]);

  const handleToggle = (enabled: boolean) => {
    if (!readOnly && onToggle) {
      onToggle(tool.name, enabled);
    }
  };

  const handleDescriptionEdit = () => {
    if (readOnly) return;
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = async () => {
    if (readOnly) return;
    try {
      const result = await updateToolDescription(server, tool.name, customDescription);
      if (result.success) {
        setIsEditingDescription(false);
        if (onDescriptionUpdate) {
          onDescriptionUpdate(tool.name, customDescription);
        }
      } else {
        // Revert on error
        setCustomDescription(tool.description || '');
        console.error('Failed to update tool description:', result.error);
      }
    } catch (error) {
      console.error('Error updating tool description:', error);
      setCustomDescription(tool.description || '');
      setIsEditingDescription(false);
    }
  };

  const handleDescriptionReset = async () => {
    if (readOnly) return;
    setIsResettingDescription(true);

    try {
      const result = await resetToolDescription(server, tool.name);
      if (result.success) {
        const restoredDescription = result.description || '';
        setCustomDescription(restoredDescription);
        setIsEditingDescription(false);
        onDescriptionUpdate?.(tool.name, restoredDescription, { restored: true });
      } else {
        showToast(result.error || t('tool.restoreDefaultFailed'), 'error');
      }
    } catch (error) {
      console.error('Error resetting tool description:', error);
      showToast(t('tool.restoreDefaultFailed'), 'error');
    } finally {
      setIsResettingDescription(false);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setCustomDescription(tool.description || '');
      setIsEditingDescription(false);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleDescriptionSave();
    }
  };

  const handleCopyToolName = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(tool.name);
        setCopiedToolName(true);
        showToast(t('common.copySuccess'), 'success');
        setTimeout(() => setCopiedToolName(false), 2000);
      } else {
        // Fallback for HTTP or unsupported clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = tool.name;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setCopiedToolName(true);
          showToast(t('common.copySuccess'), 'success');
          setTimeout(() => setCopiedToolName(false), 2000);
        } catch (err) {
          showToast(t('common.copyFailed'), 'error');
          console.error('Copy to clipboard failed:', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      showToast(t('common.copyFailed'), 'error');
      console.error('Copy to clipboard failed:', error);
    }
  };

  const handleRunTool = async (arguments_: Record<string, any>) => {
    setIsRunning(true);
    try {
      // filter empty values
      arguments_ = Object.fromEntries(
        Object.entries(arguments_).filter(([_, v]) => !isEmptyValue(v)),
      );
      const result = await callTool(
        {
          toolName: tool.name,
          arguments: arguments_,
        },
        server,
      );

      setResult(result);
      // Clear form data on successful submission
      // clearStoredFormData()
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancelRun = () => {
    setShowRunForm(false);
    // Clear form data when cancelled
    clearStoredFormData();
    setResult(null);
  };

  const handleCloseResult = () => {
    setResult(null);
  };

  return (
    <div
      className={`hub-cap-item${isExpanded ? ' is-open' : ''}${tool.enabled === false ? ' is-off' : ''}`}
    >
      <div
        className="hub-cap-item-main"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="hub-cap-copy">
          <div className="hub-cap-name-row">
            <span className="hub-cap-name">{toolDisplayName}</span>
            <button
              type="button"
              className="hub-icon-btn sm hub-cap-ghost"
              onClick={handleCopyToolName}
              title={t('common.copy')}
            >
              {copiedToolName ? (
                <Check size={12} style={{ color: 'var(--hub-ok)' }} />
              ) : (
                <Copy size={12} />
              )}
            </button>
            {descriptionInfo.hasDescriptionOverride && (
              <span className="hub-cap-badge" title={defaultDescriptionTooltip}>
                {t('tool.descriptionModifiedBadge')}
              </span>
            )}
            {!readOnly && !isEditingDescription && (
              <>
                <button
                  type="button"
                  className="hub-icon-btn sm hub-cap-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDescriptionEdit();
                  }}
                  title={t('server.edit')}
                >
                  <Edit size={12} />
                </button>
                <span className="hub-cap-ghost">
                  <ResetDescriptionButton
                    title={t('tool.restoreDefault')}
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
              <textarea
                ref={descriptionInputRef}
                className="hub-input hub-cap-edit-input"
                rows={3}
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
                title={t('tool.restoreDefault')}
                onClick={() => void handleDescriptionReset()}
                disabled={isResettingDescription}
                loading={isResettingDescription}
              />
            </div>
          ) : (
            <p className="hub-cap-desc" title={defaultDescriptionTooltip || descriptionInfo.currentDescription}>
              {descriptionInfo.currentDescription}
            </p>
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
              checked={tool.enabled ?? true}
              onCheckedChange={handleToggle}
              disabled={isRunning || readOnly}
              size="card"
              aria-label={`${t((tool.enabled ?? true) ? 'server.disable' : 'server.enable')} ${toolDisplayName}`}
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
              setShowRunForm(true);
            }}
            className="hub-btn sm"
            style={{ color: 'var(--hub-accent)' }}
            disabled={isRunning || !tool.enabled}
          >
            {isRunning ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            <span>{isRunning ? t('tool.running') : t('tool.run')}</span>
          </button>
          <button type="button" className="hub-icon-btn sm" aria-hidden="true">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="hub-cap-body">
          {descriptionInfo.hasDescriptionOverride && descriptionInfo.defaultDescription && (
            <div
              style={{
                background: 'var(--hub-bg-2)',
                borderRadius: 7,
                padding: '8px 12px',
                border: '1px dashed var(--hub-line)',
                fontSize: 11.5,
                color: 'var(--hub-ink-3)',
              }}
            >
              <span className="hub-sect" style={{ marginRight: 6 }}>
                {t('tool.defaultDescriptionLabel')}
              </span>
              <span className="whitespace-pre-wrap break-words">
                {descriptionInfo.defaultDescription}
              </span>
            </div>
          )}

          {/* Schema Display */}
          {!showRunForm && (
            <div style={{ background: 'var(--hub-bg-2)', borderRadius: 7, padding: '8px 12px', border: '1px solid var(--hub-line)' }}>
              <div className="hub-sect" style={{ marginBottom: 6 }}>{t('tool.inputSchema')}</div>
              <pre className="hub-mono overflow-auto" style={{ fontSize: 11.5, color: 'var(--hub-ink-2)', margin: 0 }}>
                {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </div>
          )}

          {/* Run Form */}
          {showRunForm && (
            <div style={{ border: '1px solid var(--hub-line)', borderRadius: 8, padding: 14 }}>
              <DynamicForm
                schema={tool.inputSchema || { type: 'object' }}
                onSubmit={handleRunTool}
                onCancel={handleCancelRun}
                loading={isRunning}
                storageKey={getStorageKey()}
                title={t('tool.runToolWithName', {
                  name: toolDisplayName,
                })}
              />
              {result && (
                <div style={{ marginTop: 12 }}>
                  <ToolResult result={result} onClose={handleCloseResult} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolCard;
