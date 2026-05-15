'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';

export interface ComboboxOption {
  readonly id: string;
  readonly label: string;
}

interface Props {
  options: readonly ComboboxOption[];
  value: string;
  onChange: (value: string, option: ComboboxOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  id?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * A compact combobox with:
 *   - substring-match filtering (case-insensitive)
 *   - ArrowUp/Down to move highlight, Enter to select, Esc to close
 *   - Type a new value + Enter → fires onChange with option=null so the
 *     caller can decide whether to create on-the-fly
 *   - Mouse click selects
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  allowCreate = true,
  id,
  className = '',
  inputRef: externalInputRef,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  }, [options, query]);

  const exactMatch = options.find((o) => o.label.toLowerCase() === query);
  const showCreate = allowCreate && query.length > 0 && !exactMatch;

  // Keep highlight in bounds as the filtered list changes.
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Close when focus leaves the whole component.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const select = (opt: ComboboxOption) => {
    onChange(opt.label, opt);
    setOpen(false);
  };

  const selectCreate = () => {
    onChange(value.trim(), null);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const total = filtered.length + (showCreate ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => (total === 0 ? 0 : (h + 1) % total));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => (total === 0 ? 0 : (h - 1 + total) % total));
    } else if (e.key === 'Enter') {
      if (!open) return; // let parent form handle Enter when popup isn't shown
      e.preventDefault();
      if (highlight < filtered.length) {
        select(filtered[highlight]!);
      } else if (showCreate) {
        selectCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab') {
      // If the highlighted option exactly matches, commit; otherwise leave value as typed.
      if (open && highlight < filtered.length) {
        select(filtered[highlight]!);
      } else {
        setOpen(false);
      }
    }
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, null);
    setOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={value}
        onChange={onInputChange}
        onFocus={(e) => { if (e.relatedTarget !== null) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        className="input"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-md border border-border-strong bg-surface py-1 shadow-lg"
        >
          {filtered.map((opt, i) => {
            const active = i === highlight;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(opt)}
                className={`block w-full truncate px-3 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-accent-soft text-accent' : 'text-text'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {showCreate && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === filtered.length}
              onMouseEnter={() => setHighlight(filtered.length)}
              onClick={selectCreate}
              className={`block w-full truncate border-t border-border px-3 py-1.5 text-left text-sm transition-colors ${
                highlight === filtered.length
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-secondary'
              }`}
            >
              + Use "{value.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
