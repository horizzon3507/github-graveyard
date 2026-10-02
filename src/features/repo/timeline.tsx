import { cn, formatAgo, formatDate } from "@/lib/utils";
import type { TimelineEvent } from "@/analysis/activity";

const TONE: Record<TimelineEvent["tone"], string> = {
  birth: "bg-grave-green",
  milestone: "bg-grave-blue",
  peak: "bg-grave-green ring-4 ring-grave-green/20",
  decline: "bg-grave-purple",
  end: "bg-muted-foreground",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative ml-2 grid gap-5 border-l border-border pl-6">
      {events.map((event) => (
        <li key={event.key} className="relative">
          <span className={cn("absolute top-1.5 -left-[29px] size-2.5 rounded-full", TONE[event.tone])} aria-hidden="true" />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <p className="text-sm font-medium">{event.title}</p>
            <time dateTime={event.date} className="font-mono text-xs text-muted-foreground">
              {formatDate(event.date)} · {formatAgo(event.date)}
            </time>
          </div>
          {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
