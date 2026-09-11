import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BuiltinPrompt, PromptArgument } from '@/types';
import { useBuiltinPromptData } from '@/hooks/useBuiltinPromptData';
import { useAuth } from '@/contexts/AuthContext';
import { Edit, Trash, Plus, MessageSquare, X, ChevronDown } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { StatusDot } from '@/components/ui/StatusDot';

// Form dialog for creating/editing a built-in prompt
interface PromptFormDialogProps {
  prompt?: BuiltinPrompt | null;
  onSave: (data: Omit<BuiltinPrompt, 'id'>) => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
}

const PromptFormDialog: React.FC<PromptFormDialogProps> = ({ prompt, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState(prompt?.name || '');
  const [title, setTitle] = useState(prompt?.title || '');
  const [description, setDescription] = useState(prompt?.description || '');
  const [template, setTemplate] = useState(prompt?.template || '');
  const [enabled, setEnabled] = useState(prompt?.enabled !== false);
  const [args, setArgs] = useState<PromptArgument[]>(prompt?.arguments || []);

  const handleAddArg = () => {
    setArgs([...args, { name: '', description: '', required: false }]);
  };

  const handleRemoveArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  const handleArgChange = (index: number, field: keyof PromptArgument, value: string | boolean) => {
    setArgs(args.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('builtinPrompts.nameRequired'));
      return;
    }
    if (!template.trim()) {
      setError(t('builtinPrompts.templateRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave({
        name: name.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        template,
        arguments: args.length > 0 ? args.filter((a) => a.name.trim()) : undefined,
        enabled,
      });
      if (!result.success) {
        setError(result.message || t('builtinPrompts.saveError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('builtinPrompts.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ylune-dialog-backdrop">
      <div className="ylune-dialog is-lg">
        <form className="ylune-dialog-form" onSubmit={handleSubmit}>
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">
              {prompt ? t('builtinPrompts.edit') : t('builtinPrompts.addNew')}
            </h2>
          </div>

          <div className="ylune-dialog-body">
            {error && <div className="ylune-error">{error}</div>}

            <div>
              <label className="ylune-label">
                {t('builtinPrompts.name')} <span className="ylune-req">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('builtinPrompts.namePlaceholder')}
                className="hub-input"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="ylune-label">{t('builtinPrompts.title')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('builtinPrompts.titlePlaceholder')}
                className="hub-input"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="ylune-label">{t('builtinPrompts.description')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('builtinPrompts.descriptionPlaceholder')}
                className="hub-input"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="ylune-label">
                {t('builtinPrompts.template')} <span className="ylune-req">*</span>
              </label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={t('builtinPrompts.templatePlaceholder')}
                rows={6}
                className="hub-input area mono"
                required
                disabled={isSubmitting}
              />
              <p className="ylune-help">{t('builtinPrompts.templateHint')}</p>
            </div>

            <div>
              <div className="ylune-inline">
                <label className="ylune-label" style={{ marginBottom: 0 }}>
                  {t('builtinPrompts.arguments')}
                </label>
                <button
                  type="button"
                  onClick={handleAddArg}
                  className="ylune-link-btn"
                  disabled={isSubmitting}
                >
                  <Plus size={14} />
                  {t('builtinPrompts.addArgument')}
                </button>
              </div>
              {args.map((arg, index) => (
                <div key={index} className="ylune-arg-row">
                  <input
                    type="text"
                    value={arg.name}
                    onChange={(e) => handleArgChange(index, 'name', e.target.value)}
                    placeholder={t('builtinPrompts.argName')}
                    className="hub-input"
                    disabled={isSubmitting}
                  />
                  <input
                    type="text"
                    value={arg.description || ''}
                    onChange={(e) => handleArgChange(index, 'description', e.target.value)}
                    placeholder={t('builtinPrompts.argDescription')}
                    className="hub-input"
                    disabled={isSubmitting}
                  />
                  <label className="ylune-check">
                    <input
                      type="checkbox"
                      checked={arg.required || false}
                      onChange={(e) => handleArgChange(index, 'required', e.target.checked)}
                      disabled={isSubmitting}
                    />
                    {t('builtinPrompts.argRequired')}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveArg(index)}
                    className="hub-icon-btn sm"
                    disabled={isSubmitting}
                    aria-label="remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <label className="ylune-check" htmlFor="enabled">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={isSubmitting}
              />
              {t('builtinPrompts.enabled')}
            </label>
          </div>

          <div className="ylune-dialog-foot">
            <button type="button" onClick={onCancel} className="hub-btn" disabled={isSubmitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="hub-btn primary">
              {isSubmitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PromptsPage: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const {
    prompts,
    loading,
    error,
    setError,
    addPrompt,
    editPrompt,
    removePrompt,
  } = useBuiltinPromptData();

  const [showForm, setShowForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<BuiltinPrompt | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<BuiltinPrompt | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isAdmin = auth.user?.isAdmin;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (data: Omit<BuiltinPrompt, 'id'>) => {
    const result = await addPrompt(data);
    if (result.success) {
      setShowForm(false);
    }
    return result;
  };

  const handleEdit = async (data: Omit<BuiltinPrompt, 'id'>) => {
    if (!editingPrompt) return { success: false, message: 'No prompt selected' };
    const result = await editPrompt(editingPrompt.id, data);
    if (result.success) {
      setEditingPrompt(null);
    }
    return result;
  };

  const handleConfirmDelete = async () => {
    if (promptToDelete) {
      await removePrompt(promptToDelete.id);
      setPromptToDelete(null);
    }
  };

  return (
    <div className="hub-page-stack">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('pages.prompts.title')}</h1>
          <p className="hub-sub">
            <span className="hub-num">{prompts.length}</span> {t('nav.prompts')}
          </p>
        </div>
        {isAdmin && (
          <div className="view-actions">
            <button type="button" onClick={() => setShowForm(true)} className="hub-btn primary">
              <Plus size={13} /> {t('builtinPrompts.add')}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="hub-card flex items-center justify-between gap-3"
          style={{
            padding: '10px 14px',
            borderColor: 'oklch(0.85 0.1 25)',
            background: 'oklch(0.97 0.03 25)',
            color: 'oklch(0.4 0.18 25)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <X size={14} className="flex-shrink-0" />
            <span className="truncate text-[13px]">{error}</span>
          </div>
          <button className="hub-icon-btn sm" onClick={() => setError(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="hub-card p-10 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          {t('app.loading')}
        </div>
      ) : prompts.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <div className="hub-empty-icon">
              <MessageSquare size={18} />
            </div>
            <p className="hub-empty-title">{t('builtinPrompts.noPrompts')}</p>
            {isAdmin && (
              <button type="button" onClick={() => setShowForm(true)} className="hub-empty-link">
                {t('builtinPrompts.addFirst')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="hub-card overflow-hidden">
          {prompts.map((prompt, idx) => {
            const isExpanded = expandedIds.has(prompt.id);
            const enabled = prompt.enabled !== false;
            return (
              <div
                key={prompt.id}
                style={{ borderTop: idx === 0 ? 0 : '1px solid var(--hub-line-2)' }}
              >
                <div
                  className="flex items-center justify-between cursor-pointer transition-colors hover:bg-[var(--hub-surface-hover)]"
                  style={{ padding: '12px 16px' }}
                  onClick={() => toggleExpand(prompt.id)}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <ChevronDown
                      size={12}
                      style={{
                        color: 'var(--hub-ink-3)',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.15s',
                        flexShrink: 0,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-medium truncate"
                          style={{
                            fontSize: 13.5,
                            color: enabled ? 'var(--hub-ink)' : 'var(--hub-ink-3)',
                          }}
                        >
                          {prompt.title || prompt.name}
                        </span>
                        <span
                          className="hub-mono"
                          style={{ fontSize: 11.5, color: 'var(--hub-ink-3)' }}
                        >
                          {prompt.name}
                        </span>
                        <StatusDot
                          kind={enabled ? 'ok' : 'muted'}
                          label={
                            enabled
                              ? t('builtinPrompts.active')
                              : t('builtinPrompts.inactive')
                          }
                        />
                      </div>
                      {prompt.description && (
                        <div
                          className="truncate mt-0.5"
                          style={{ fontSize: 12, color: 'var(--hub-ink-3)' }}
                        >
                          {prompt.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPrompt(prompt);
                        }}
                        className="hub-icon-btn sm"
                        title={t('builtinPrompts.edit')}
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPromptToDelete(prompt);
                        }}
                        className="hub-icon-btn sm"
                        title={t('builtinPrompts.delete')}
                        style={{ color: 'var(--hub-err)' }}
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <div
                    style={{
                      padding: '12px 16px 14px 38px',
                      background: 'var(--hub-bg-2)',
                      borderTop: '1px solid var(--hub-line-2)',
                    }}
                  >
                    <div>
                      <div className="hub-sect" style={{ marginBottom: 5 }}>
                        {t('builtinPrompts.template')}
                      </div>
                      <pre
                        className="hub-mono"
                        style={{
                          fontSize: 12,
                          color: 'var(--hub-ink-2)',
                          background: 'var(--hub-surface)',
                          border: '1px solid var(--hub-line)',
                          borderRadius: 7,
                          padding: 10,
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          margin: 0,
                        }}
                      >
                        {prompt.template}
                      </pre>
                    </div>
                    {prompt.arguments && prompt.arguments.length > 0 && (
                      <div className="mt-3">
                        <div className="hub-sect" style={{ marginBottom: 5 }}>
                          {t('builtinPrompts.arguments')}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {prompt.arguments.map((arg, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[12px]">
                              <code className="hub-mono hub-tag accent" style={{ fontSize: 11 }}>
                                {'{{' + arg.name + '}}'}
                              </code>
                              {arg.required && (
                                <span style={{ color: 'var(--hub-err)', fontSize: 11 }}>*</span>
                              )}
                              {arg.description && (
                                <span style={{ color: 'var(--hub-ink-3)' }}>
                                  — {arg.description}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form dialog */}
      {showForm && (
        <PromptFormDialog onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {/* Edit form dialog */}
      {editingPrompt && (
        <PromptFormDialog
          prompt={editingPrompt}
          onSave={handleEdit}
          onCancel={() => setEditingPrompt(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!promptToDelete}
        onClose={() => setPromptToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t('builtinPrompts.confirmDelete')}
        message={t('builtinPrompts.deleteWarning', { name: promptToDelete?.name || '' })}
        variant="danger"
      />
    </div>
  );
};

export default PromptsPage;
