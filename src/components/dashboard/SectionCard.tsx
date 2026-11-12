"use client";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4 shadow-xs",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"
            >
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold leading-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className={cn("flex-1", contentClassName)}>{children}</div>
    </section>
  );
}
