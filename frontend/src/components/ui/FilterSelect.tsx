import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  searchable?: boolean;
  allowEmpty?: boolean;
}

const MENU_HEIGHT = 260;

const FilterSelect = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  searchable = true,
  allowEmpty = true,
}: FilterSelectProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anyLabel = emptyLabel || t('common.all') || 'All';

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const placeMenu = () => {
    const el = controlRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < MENU_HEIGHT && rect.top > MENU_HEIGHT;
    setMenuBox({
      top: openUp ? Math.max(8, rect.top - MENU_HEIGHT - 4) : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    placeMenu();
    const onReposition = () => placeMenu();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const menu = open && menuBox
    ? createPortal(
        <div
          ref={menuRef}
          className="hub-multiselect-menu is-portal"
          style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
          role="listbox"
          aria-labelledby={id}
        >
          {searchable ? (
            <div className="hub-multiselect-search">
              <input
                className="hub-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('common.search')}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name={`ylune-filter-${id}`}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          ) : null}
          <div className="hub-multiselect-list">
            {allowEmpty ? (
              <button
                type="button"
                className={`hub-multiselect-option${!value ? ' is-selected' : ''}`}
                onClick={() => pick('')}
              >
                <span>{anyLabel}</span>
                {!value ? <Check size={14} /> : null}
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <div className="hub-multiselect-empty">{t('common.noMatches')}</div>
            ) : (
              filtered.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`hub-multiselect-option${option.value === value ? ' is-selected' : ''}`}
                  onClick={() => pick(option.value)}
                >
                  <span className="hub-mono">{option.label}</span>
                  {option.value === value ? <Check size={14} /> : null}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="activity-filter-field" ref={rootRef}>
      <label className="ylune-label" htmlFor={id}>
        {label}
      </label>
      <div className="hub-multiselect is-compact">
        <button
          id={id}
          ref={controlRef}
          type="button"
          className={`hub-multiselect-control${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            setOpen((prev) => !prev);
            setQuery('');
          }}
        >
          <span className={selected ? 'hub-mono' : 'hub-multiselect-placeholder'}>
            {selected?.label || placeholder || anyLabel}
          </span>
          <span className="hub-multiselect-grow" />
          {allowEmpty && value ? (
            <span
              className="hub-multiselect-remove"
              role="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                pick('');
              }}
              aria-label={t('common.clear')}
            >
              <X size={13} />
            </span>
          ) : null}
          <ChevronDown className={`hub-multiselect-caret${open ? ' is-open' : ''}`} />
        </button>
        {menu}
      </div>
    </div>
  );
};

export default FilterSelect;
