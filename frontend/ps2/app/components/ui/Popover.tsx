import React, { useState, useRef, useEffect } from "react";

interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "left" | "right";
  className?: string;
}

export function Popover({
  trigger,
  content,
  open: controlledOpen,
  onOpenChange,
  align = "left",
  className = "",
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const close = React.useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    onOpenChange?.(false);
  }, [isControlled, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div ref={popoverRef} className="relative inline-block">
      <div onClick={toggleOpen} className="inline-block">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          className={`absolute top-full mt-1.5 z-50 rounded-[8px] border border-line bg-surface p-3 shadow-[0_8px_24px_rgba(16,24,40,.12)] text-ink ${
            align === "right" ? "right-0" : "left-0"
          } ${className}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = "" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 z-50 whitespace-nowrap rounded-[4px] border border-line-strong bg-ink px-2 py-1 text-xs text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${className}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
