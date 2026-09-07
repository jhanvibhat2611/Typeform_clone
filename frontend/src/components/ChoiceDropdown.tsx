"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Question } from "../lib/drafts";

// Select-only combobox: focus stays on the trigger; arrows move the active option.
export function ChoiceDropdown({ question, value, onChange, inputId, error }: {
  question: Question; value: string; onChange: (value: string) => void; inputId: string; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', time: 0 });
  const options = question.options;
  const selected = options.findIndex(option => option.id === value);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    const option = root.current?.querySelector<HTMLElement>('[data-active="true"]');
    const list = option?.parentElement;
    if (open && option && list) {
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [active, open]);
  function show() {
    const bounds = button.current?.getBoundingClientRect();
    setAbove(Boolean(bounds && window.innerHeight - bounds.bottom < 260 && bounds.top > 260));
    setActive(Math.max(0, selected)); setOpen(true);
  }
  function choose(index: number) {
    if (button.current?.matches(":disabled") || root.current?.closest("[inert]")) return;
    if (options[index]) onChange(options[index].id);
    setOpen(false); button.current?.focus({ preventScroll: true });
  }
  return <div className="dropdown-control" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={button} id={inputId} type="button" role="combobox" className={'preview-answer dropdown-trigger' + (selected < 0 ? ' placeholder' : '')}
      aria-expanded={open} aria-controls={inputId + '-options'} aria-haspopup="listbox"
      aria-activedescendant={open && options[active] ? inputId + '-option-' + active : undefined}
      aria-labelledby={inputId + '-label'} aria-required={question.required} aria-invalid={Boolean(error)}
      aria-describedby={[question.description ? inputId + '-description' : '', error ? inputId + '-error' : ''].filter(Boolean).join(' ') || undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          if (event.key === 'Escape') { setOpen(false); return; }
          if (!open) { show(); if (event.key === 'End') setActive(options.length - 1); return; }
          if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
          setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Tab') setOpen(false);
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now(); search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase(), time: now };
          const match = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text));
          if (match >= 0) { if (!open) show(); setActive(match); }
        }
      }}><span>{options[selected]?.label || 'Select an option'}</span><ChevronDown size={22} aria-hidden="true"/></button>
    {!question.required && selected >= 0 && <button type="button" className="dropdown-clear" onClick={() => { onChange(''); setOpen(false); button.current?.focus({ preventScroll: true }); }}>Clear answer</button>}
    {open && <ul id={inputId + '-options'} role="listbox" aria-labelledby={inputId + '-label'} className={'dropdown-options' + (above ? ' above' : '')}>
      {options.map((option, index) => <li id={inputId + '-option-' + index} key={option.id} role="option" aria-selected={value === option.id}
        data-active={active === index} onPointerDown={event => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>
        <span>{option.label || 'Choice ' + (index + 1)}</span>{value === option.id && <Check size={18} aria-hidden="true"/>}
      </li>)}
      {!options.length && <li role="option" aria-disabled="true" aria-selected="false">No options yet</li>}
    </ul>}
  </div>;
}
