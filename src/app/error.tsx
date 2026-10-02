"use client";

import { useEffect } from "react";
import { StateMessage } from "@/components/graveyard/states";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <StateMessage kind="error" title="Something broke">
        An unexpected error occurred while rendering this page. {error.digest && <span className="font-mono text-xs">Ref: {error.digest}</span>}
      </StateMessage>
      <div className="mt-4 flex justify-center">
        <Button variant="secondary" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
