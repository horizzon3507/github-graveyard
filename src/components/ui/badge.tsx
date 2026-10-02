import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&>svg]:size-3", {
  variants: {
    variant: {
      default: "border-border bg-secondary text-secondary-foreground",
      outline: "border-border text-muted-foreground",
      green: "border-grave-green/25 bg-grave-green/10 text-grave-green",
      purple: "border-grave-purple/25 bg-grave-purple/10 text-grave-purple",
      blue: "border-grave-blue/25 bg-grave-blue/10 text-grave-blue",
      amber: "border-grave-amber/25 bg-grave-amber/10 text-grave-amber",
      muted: "border-white/10 bg-white/5 text-muted-foreground",
      red: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
