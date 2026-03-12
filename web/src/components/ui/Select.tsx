/**
 * Select 下拉选择组件
 *
 * 支持分组、搜索、清空和多选，是通用表单输入组件。
 * 组件内部处理弹层开关、搜索过滤和受控/非受控兼容，外部只需关注选中结果。
 */

'use client';

import React, { forwardRef, useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps {
  options?: SelectOption[];
  groups?: SelectGroup[];
  value?: string;
  values?: string[];
  defaultValue?: string;
  defaultValues?: string[];
  onChange?: (value: string, option: SelectOption) => void;
  onValuesChange?: (values: string[], options: SelectOption[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  clearable?: boolean;
  className?: string;
  wrapperClassName?: string;
}

const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options = [],
      groups,
      value,
      values,
      defaultValue,
      defaultValues,
      onChange,
      onValuesChange,
      placeholder = '请选择',
      label,
      error,
      helperText,
      disabled = false,
      searchable = false,
      multiple = false,
      clearable = false,
      className,
      wrapperClassName,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
    const [internalValues, setInternalValues] = useState<string[]>(defaultValues || []);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const currentValue = value !== undefined ? value : internalValue;
    const currentValues = values !== undefined ? values : internalValues;

    const allOptions = useMemo(
      () => (groups ? groups.flatMap((g) => g.options) : options),
      [groups, options]
    );

    const filteredOptions = searchQuery
      ? allOptions.filter(opt =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allOptions;

    const selectedOption = allOptions.find(opt => opt.value === currentValue);
    const selectedOptions = allOptions.filter(opt => currentValues.includes(opt.value));

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen && searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, searchable]);

    const handleSelect = useCallback((option: SelectOption) => {
      if (option.disabled) return;

      if (multiple) {
        const newValues = currentValues.includes(option.value)
          ? currentValues.filter(v => v !== option.value)
          : [...currentValues, option.value];

        if (values === undefined) {
          setInternalValues(newValues);
        }

        const newOptions = allOptions.filter(opt => newValues.includes(opt.value));
        onValuesChange?.(newValues, newOptions);
      } else {
        if (value === undefined) {
          setInternalValue(option.value);
        }
        onChange?.(option.value, option);
        setIsOpen(false);
      }

      setSearchQuery('');
    }, [multiple, currentValues, value, values, onChange, onValuesChange, allOptions]);

    const handleClear = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();

      if (multiple) {
        if (values === undefined) {
          setInternalValues([]);
        }
        onValuesChange?.([], []);
      } else {
        if (value === undefined) {
          setInternalValue(undefined);
        }
        onChange?.('', { value: '', label: '' });
      }
    }, [multiple, value, values, onChange, onValuesChange]);

    const baseTriggerStyles = 'flex items-center justify-between w-full rounded-lg border bg-white px-3 py-2 text-left text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 dark:bg-gray-800 dark:text-gray-100';

    const stateStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-900'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900';

    const renderOption = (option: SelectOption, groupIndex?: number) => {
      const isSelected = multiple
        ? currentValues.includes(option.value)
        : currentValue === option.value;

      return (
        <div
          key={`${groupIndex}-${option.value}`}
          className={cn(
            'flex items-center px-3 py-2 cursor-pointer transition-colors',
            option.disabled && 'opacity-50 cursor-not-allowed',
            isSelected
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
          )}
          onClick={() => handleSelect(option)}
        >
          {multiple && (
            <div
              className={cn(
                'w-4 h-4 rounded border mr-2 flex items-center justify-center transition-colors',
                isSelected
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-gray-300 dark:border-gray-500'
              )}
            >
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
          {option.icon && <span className="mr-2">{option.icon}</span>}
          <span className="flex-1">{option.label}</span>
          {!multiple && isSelected && (
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      );
    };

    return (
      <div ref={ref} className={cn('w-full', wrapperClassName)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <div ref={containerRef} className="relative">
          <button
            type="button"
            className={cn(baseTriggerStyles, stateStyles, className)}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            aria-expanded={isOpen}
          >
            <span className="flex items-center gap-2 truncate">
              {multiple ? (
                currentValues.length > 0 ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    {selectedOptions.slice(0, 3).map(opt => (
                      <span
                        key={opt.value}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      >
                        {opt.label}
                      </span>
                    ))}
                    {selectedOptions.length > 3 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{selectedOptions.length - 3}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
                )
              ) : selectedOption ? (
                <span className="flex items-center gap-2">
                  {selectedOption.icon}
                  {selectedOption.label}
                </span>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
              )}
            </span>
            <span className="flex items-center gap-1 ml-2">
              {clearable && (multiple ? currentValues.length > 0 : currentValue) && (
                <button
                  type="button"
                  className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleClear}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <svg
                className={cn(
                  'w-4 h-4 text-gray-400 transition-transform duration-200',
                  isOpen && 'transform rotate-180'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
              {searchable && (
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                      placeholder="搜索..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}

              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  暂无数据
                </div>
              ) : groups ? (
                groups.map((group, groupIndex) => {
                  const groupFilteredOptions = searchQuery
                    ? group.options.filter(opt =>
                        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    : group.options;

                  if (groupFilteredOptions.length === 0) return null;

                  return (
                    <div key={group.label}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                        {group.label}
                      </div>
                      {groupFilteredOptions.map((option, optionIndex) =>
                        renderOption(option, groupIndex * 1000 + optionIndex)
                      )}
                    </div>
                  );
                })
              ) : (
                filteredOptions.map((option, index) => renderOption(option, index))
              )}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
