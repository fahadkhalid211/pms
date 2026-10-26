import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "secondary" | "destructive" | "muted" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
  muted: "border-transparent bg-muted text-muted-foreground",
  outline: "border-border text-foreground bg-transparent",
};

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function BadgeDefault(props: React.HTMLAttributes<HTMLDivElement>) {
  return <Badge variant="default" {...props} />;
}

export function BadgeSecondary(props: React.HTMLAttributes<HTMLDivElement>) {
  return <Badge variant="secondary" {...props} />;
}

export function BadgeDestructive(props: React.HTMLAttributes<HTMLDivElement>) {
  return <Badge variant="destructive" {...props} />;
}

export function BadgeMuted(props: React.HTMLAttributes<HTMLDivElement>) {
  return <Badge variant="muted" {...props} />;
}
