const COLORS: Record<string, string> = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572a5", Go: "#00add8", Rust: "#dea584", Ruby: "#701516", PHP: "#4f5d95", Java: "#b07219", "C++": "#f34b7d", C: "#7a7a7a", Swift: "#f05138", Kotlin: "#a97bff", "C#": "#178600", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c", Lua: "#000080", Perl: "#0298c3", Haskell: "#5e5086", Scala: "#c22d40", Clojure: "#db5855", "Objective-C": "#438eff", CoffeeScript: "#244776", Vue: "#41b883", Dart: "#00b4ab", Elixir: "#6e4a7e", "Jupyter Notebook": "#da5b0b",
};

export function LanguageDot({ language }: { language: string | null }) {
  if (!language) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: COLORS[language] ?? "#8a8e99" }} aria-hidden="true" />
      {language}
    </span>
  );
}
