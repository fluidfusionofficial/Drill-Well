import React, { forwardRef } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "secondary",
    size = "md",
    icon,
    className = "",
    disabled,
    ...props
  },
  ref
) {
  const baseStyles =
    "inline-flex items-center justify-center gap-1.5 font-medium transition-colors select-none rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

  const sizeStyles =
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm";

  const variantStyles = {
    primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover/90 shadow-none border border-transparent",
    secondary: "bg-surface border border-line text-ink hover:bg-surface-muted hover:text-ink active:bg-surface-muted",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-muted hover:text-ink border border-transparent",
    danger: "bg-status-critical-soft text-status-critical border border-status-critical/20 hover:bg-status-critical-soft/80",
  }[variant];

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    children,
    variant = "ghost",
    size = "md",
    label,
    className = "",
    disabled,
    ...props
  },
  ref
) {
  const baseStyles =
    "inline-flex items-center justify-center shrink-0 transition-colors select-none rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

  const sizeStyles = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";

  const variantStyles = {
    primary: "bg-primary text-white hover:bg-primary-hover border border-transparent",
    secondary: "bg-surface border border-line text-ink hover:bg-surface-muted",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-muted hover:text-ink border border-transparent",
    danger: "bg-status-critical-soft text-status-critical border border-status-critical/20 hover:bg-status-critical-soft/80",
  }[variant];

  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});
