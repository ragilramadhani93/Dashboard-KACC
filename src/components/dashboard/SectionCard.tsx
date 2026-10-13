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
        "flex flex-col rounded-xl border border-white/10 bg-card/60 p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="rounded-lg bg-white/5 p-1.5">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold leading-tight text-foreground">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground">
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
