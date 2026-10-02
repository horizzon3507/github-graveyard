import { StateMessage } from "@/components/graveyard/states";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <StateMessage kind="not-found" title="Nothing buried here" action={{ href: "/", label: "Back to the surface" }}>
        This page doesn&apos;t exist.
      </StateMessage>
    </div>
  );
}
