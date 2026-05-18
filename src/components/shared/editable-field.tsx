"use client";

import { Check, X } from "lucide-react";

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function EditableField({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder = "",
  autoFocus = true,
}: EditableFieldProps) {
  return (
    <div className="flex items-center gap-2 w-full max-w-md">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSave();
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-b-2 border-zinc-700 px-1 py-2 text-sm font-mono text-zinc-200 outline-none focus:border-indigo-500/70 transition-colors"
        autoFocus={autoFocus}
      />
      <button
        onClick={onSave}
        className="shrink-0 w-9 h-9 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all duration-200 flex items-center justify-center shadow-[0_2px_8px_rgba(34,197,94,0.2)]"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="shrink-0 w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all duration-200 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
