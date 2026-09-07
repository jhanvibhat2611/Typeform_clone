import { AlignLeft, AlignJustify, List, ChevronDown, Mail, Hash, CircleCheck, Star } from "lucide-react";
import type { QuestionType } from "../lib/drafts";

const icons = {
  short_text: AlignLeft, long_text: AlignJustify, multiple_choice: List,
  dropdown: ChevronDown, email: Mail, number: Hash, yes_no: CircleCheck, rating: Star,
};

export function QuestionTypeIcon({ type }: { type: QuestionType }) {
  const Icon = icons[type];
  return <span className={"type-badge type-" + type}><Icon size={16} aria-hidden="true" /></span>;
}
