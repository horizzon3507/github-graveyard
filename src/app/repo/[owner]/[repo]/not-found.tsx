import { StateMessage } from "@/components/graveyard/states";

export default function RepoNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <StateMessage kind="not-found" title="Repository not found" action={{ href: "/explore", label: "Explore the graveyard" }}>
        It may not exist, it may have been deleted, or it may be private. GitHub Graveyard only analyzes public repositories.
      </StateMessage>
    </div>
  );
}
