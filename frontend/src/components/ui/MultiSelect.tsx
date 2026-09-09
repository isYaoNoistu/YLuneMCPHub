import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleToggleOption = (value: string) => {
    if (disabled) return;

    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];

    onChange(newSelected);
  };

  const handleRemoveItem = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selected.filter((item) => item !== value));
  };

  const handleToggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const getSelectedLabels = () => {
    return selected
      .map((value) => options.find((opt) => opt.value === value)?.label || value)
      .filter(Boolean);
  };

  return (
    <div ref={dropdownRef} className={`hub-multiselect ${className}`.trim()}>
      <div
        onClick={handleToggleDropdown}
        className={`hub-multiselect-control${disabled ? ' is-disabled' : ''}${isOpen ? ' is-open' : ''}`}
      >
        {selected.length > 0 ? (
          getSelectedLabels().map((label, index) => (
            <span key={selected[index]} className="hub-tag accent">
              {label}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(selected[index], e)}
                  className="hub-multiselect-remove"
                  aria-label="remove"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="hub-multiselect-placeholder">{placeholder}</span>
        )}
        <span className="hub-multiselect-grow" />
        <ChevronDown className={`hub-multiselect-caret${isOpen ? ' is-open' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="hub-multiselect-menu">
          <div className="hub-multiselect-search">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="hub-input"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="hub-multiselect-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => handleToggleOption(option.value)}
                    className={`hub-multiselect-option${isSelected ? ' is-selected' : ''}`}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })
            ) : (
              <div className="hub-multiselect-empty">
                {searchTerm ? 'No results found' : 'No options available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
