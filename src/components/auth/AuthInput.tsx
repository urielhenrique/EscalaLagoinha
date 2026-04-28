import type { InputHTMLAttributes } from "react";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function AuthInput({ label, id, ...props }: AuthInputProps) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-medium text-app-100">{label}</span>
      <input
        id={id}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-app-200/70 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/30"
        {...props}
      />
    </label>
  );
}
