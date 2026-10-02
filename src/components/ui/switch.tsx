"use client";

import * as React from "react";
import * as Primitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-grave-green/80", className)}
      {...props}
    >
      <Primitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-[#04130b]" />
    </Primitive.Root>
  );
}

export { Switch };
