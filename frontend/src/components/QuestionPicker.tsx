"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { questionTypes, typeLabels, type QuestionType } from "../lib/drafts";
import { QuestionTypeIcon } from "./QuestionTypeIcon";

export function QuestionPicker({ onChoose, onClose }: {
  onChoose: (type: QuestionType) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const groups = [
    { label: "Text & contact", types: questionTypes.filter((t) => ["short_text", "long_text", "email"].includes(t)) },
    { label: "Choice", types: questionTypes.filter((t) => ["multiple_choice", "dropdown", "yes_no"].includes(t)) },
    { label: "Number & rating", types: questionTypes.filter((t) => ["number", "rating"].includes(t)) },
  ];
  return (
    <dialog ref={dialog} className="question-picker" aria-labelledby="picker-title"
      onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <header><h2 id="picker-title">Add form elements</h2>
        <button className="icon-button" aria-label="Close question picker" onClick={onClose}><X size={20} /></button>
      </header>
      <div className="picker-body">
        <label className="search-field"><Search size={17} />
          <input autoFocus aria-label="Search form elements" placeholder="Search form elements"
            value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="picker-groups">
          {groups.map((group) => <section key={group.label}>
            <h3>{group.label}</h3>
            {group.types.filter((type) => typeLabels[type].toLowerCase().includes(search.toLowerCase())).map((type) =>
              <button className="picker-option" key={type} onClick={() => onChoose(type)}>
                <QuestionTypeIcon type={type} />{typeLabels[type]}
              </button>
            )}
          </section>)}
        </div>
      </div>
    </dialog>
  );
}
