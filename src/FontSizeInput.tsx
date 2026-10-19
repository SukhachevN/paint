import { useEffect, useState } from 'react';

export default function FontSizeInput({ value, onChange, label }: {
  value: number; onChange: (value: number) => void; label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <input aria-label={label} type="number" min="8" max="300" value={draft}
    onChange={event => {
      setDraft(event.target.value);
      const size = Number(event.target.value);
      if (size >= 8 && size <= 300) onChange(size);
    }}
    onBlur={() => {
      const size = Math.max(8, Math.min(300, Number(draft) || value));
      setDraft(String(size)); onChange(size);
    }}/ >;
}
