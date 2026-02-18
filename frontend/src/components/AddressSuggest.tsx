import { useState, useEffect, useRef, useCallback } from 'react';
import { addressSuggestApi } from '../services/api';

const DEBOUNCE_MS = 300;

interface AddressSuggestProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export default function AddressSuggest({ value, onChange, placeholder, className, id }: AddressSuggestProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await addressSuggestApi.suggest(query, 10);
      const data = res.data as { suggestions?: { value?: string; unrestricted_value?: string }[]; hint?: string };
      const list = (data.suggestions || []).map((s) => s?.value ?? s?.unrestricted_value ?? '').filter(Boolean);
      setSuggestions(list);
      setOpen(list.length > 0);
      setHighlightIndex(-1);
      if (list.length === 0 && data.hint === 'DADATA_API_KEY not set') {
        setError('Подсказки адресов отключены. Добавьте DADATA_API_KEY в .env на сервере.');
      } else {
        setError(null);
      }
    } catch (err) {
      setSuggestions([]);
      setOpen(false);
      setError('Подсказки адресов временно недоступны. Введите адрес вручную.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setSuggestions([]);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
      return;
    }
    if (e.key === 'Enter' && highlightIndex >= 0 && suggestions[highlightIndex]) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  return (
    <div className="address-suggest" ref={wrapperRef}>
      <input
        type="text"
        id={id}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.length >= 2 && suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
      />
      {loading && (
        <span className="address-suggest-loading" aria-hidden>
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="address-suggest-list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              className={`address-suggest-item ${i === highlightIndex ? 'highlight' : ''}`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="address-suggest-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
