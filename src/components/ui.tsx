// 공통 UI 기본 요소(버튼·입력·모달·오류 표시·카드). 화면은 이 요소들로 일관된 모양을 유지한다.
"use client";

import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./icons";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-on-color shadow-sm hover:bg-brand-500 disabled:bg-brand-300 disabled:shadow-none",
  secondary: "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400 disabled:shadow-none",
  danger: "bg-red-500 text-on-color shadow-sm hover:bg-red-600 disabled:bg-red-300 disabled:shadow-none",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out-strong enabled:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[13px] font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    // 모달은 버튼에 붙은 팝오버가 아니므로 가운데에서 살짝 커지며 나타난다(@starting-style)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-[2px] transition-opacity duration-200 ease-out starting:opacity-0"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop transition-[opacity,transform] duration-200 ease-out-strong starting:scale-[0.96] starting:opacity-0`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            aria-label="닫기"
            className="rounded-md p-1.5 text-slate-400 transition-[color,background-color,transform] duration-150 ease-out-strong hover:bg-slate-100 hover:text-slate-700 active:scale-90"
            onClick={onClose}
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** 오류를 사용자용 문장으로 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "알 수 없는 오류가 발생했습니다.";
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {errorMessage(error)}
    </p>
  );
}

export function PageShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  // 화면이 길어도 내용 블록이 찌그러지지 않게(가로 스크롤 영역이 높이 0 으로 줄던 문제) 자식은 줄이지 않고 전체를 스크롤한다
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-8 sm:py-7 [&>*]:shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <div className="flex gap-2">{actions}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 흰 카드(테두리·둥근 모서리·옅은 그림자) */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-card border border-slate-200 bg-white shadow-card ${className}`}>{children}</section>;
}
