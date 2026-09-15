import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface PreferenceSelectOption {
  value: string;
  label: string;
}

interface PreferenceSelectProps {
  value: string;
  options: PreferenceSelectOption[];
  onChange: (value: string) => void;
  /** Tailwind classes applied to the trigger button based on current value */
  triggerClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function PreferenceSelect({
  value,
  options,
  onChange,
  triggerClassName = "",
  disabled = false,
  "aria-label": ariaLabel,
}: PreferenceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label ?? value;

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      close();
    },
    [onChange, close],
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleTriggerClick() {
    if (disabled) return;
    setIsOpen((prev) => {
      if (!prev) setActiveIndex(-1);
      return !prev;
    });
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(-1);
        } else if (activeIndex >= 0) {
          selectOption(options[activeIndex].value);
        }
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev,
          );
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(options.length - 1);
        } else {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
        break;
      }
    }
  }

  function handleOptionKeyDown(
    e: React.KeyboardEvent,
    optionValue: string,
    index: number,
  ) {
    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        selectOption(optionValue);
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        setActiveIndex(index < options.length - 1 ? index + 1 : index);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActiveIndex(index > 0 ? index - 1 : index);
        break;
      }
      case "Escape": {
        e.preventDefault();
        close();
        break;
      }
      case "Tab": {
        close();
        break;
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={[
          "flex w-full items-center justify-between gap-1 rounded-lg border px-2 py-2 text-xs outline-none",
          "transition-colors duration-100",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          triggerClassName,
        ].join(" ")}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className="shrink-0 opacity-60"
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className={[
            "absolute z-50 mt-1 min-w-full overflow-y-auto rounded-lg border border-white/10",
            "bg-app-800 shadow-lg shadow-black/30",
            "max-h-48",
          ].join(" ")}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => selectOption(option.value)}
                onKeyDown={(e) => handleOptionKeyDown(e, option.value, index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={[
                  "cursor-pointer px-3 py-2 text-xs outline-none",
                  "transition-colors duration-75",
                  isSelected
                    ? "bg-white/10 text-white font-medium"
                    : isActive
                      ? "bg-white/5 text-app-100"
                      : "text-app-200 hover:bg-white/5 hover:text-app-100",
                ].join(" ")}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
