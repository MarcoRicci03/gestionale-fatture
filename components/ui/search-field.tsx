"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SEARCH_DEBOUNCE_MS = 300;

type SearchFieldProps = {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
};

// Stessa logica di debounce/resync di PersonaSearchField in
// components/invoices/invoices-filter-bar.tsx, ma senza il dropdown di
// suggerimenti: qui il campo filtra l'elenco stesso già visibile in pagina,
// non fa da autocomplete verso un'altra entità.
export function SearchField({
  id,
  label,
  placeholder,
  value,
  onValueChange,
}: SearchFieldProps) {
  const [inputValue, setInputValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalValue = useRef(value);

  useEffect(() => {
    if (value !== lastExternalValue.current) {
      setInputValue(value);
      lastExternalValue.current = value;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [value]);

  const flush = (next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    lastExternalValue.current = next;
    onValueChange(next);
  };

  const handleChange = (next: string) => {
    setInputValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      lastExternalValue.current = next;
      onValueChange(next);
    }, SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => flush(inputValue)}
        autoComplete="off"
      />
    </div>
  );
}
