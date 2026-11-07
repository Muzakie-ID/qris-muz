import { STATUS_LABEL, type TransactionStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const STYLE: Record<TransactionStatus, { pill: string; dot: string | null }> = {
  PAID: { pill: "bg-ok-bg text-ok", dot: "bg-ok-dot" },
  PENDING: { pill: "bg-subtle text-ink-2", dot: "border-[1.5px] border-muted" },
  LATE_PAID: { pill: "bg-warn-bg text-warn", dot: "bg-warn-dot" },
  EXPIRED: { pill: "border border-line bg-surface text-faint", dot: null },
  CANCELLED: { pill: "border border-line bg-surface text-faint line-through decoration-faint/50", dot: null },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const s = STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", s.pill)}>
      {s.dot && <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}
