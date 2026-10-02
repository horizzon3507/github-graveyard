export const CATEGORY_KEYS = ["developer-tools", "games", "libraries", "ai", "linux", "web", "mobile"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  "developer-tools": "Developer Tools",
  games: "Games",
  libraries: "Libraries",
  ai: "AI",
  linux: "Linux",
  web: "Web",
  mobile: "Mobile",
};

interface Rule {
  topics: string[];
  text: RegExp;
  languages?: string[];
}

const RULES: Record<CategoryKey, Rule> = {
  "developer-tools": {
    topics: ["cli", "devtools", "developer-tools", "tooling", "linter", "compiler", "debugger", "build-tool", "generator", "code-generator", "bundler", "ide", "editor"],
    text: /\b(cli|command[- ]line|dev ?tools?|linter|compiler|debugger|build tool|bundler|code generator|scaffold(ing)?|editor plugin|task runner)\b/i,
  },
  games: {
    topics: ["game", "games", "gamedev", "game-engine", "game-development", "roguelike", "minecraft", "emulator", "unity", "godot"],
    text: /\b(game|games|game engine|roguelike|emulator|gamedev)\b/i,
  },
  libraries: {
    topics: ["library", "framework", "sdk", "toolkit", "api-client", "wrapper"],
    text: /\b(library|framework|sdk|toolkit|api client|wrapper|bindings)\b/i,
  },
  ai: {
    topics: ["machine-learning", "deep-learning", "ai", "artificial-intelligence", "neural-network", "nlp", "tensorflow", "pytorch", "llm", "computer-vision", "chatbot"],
    text: /\b(machine learning|deep learning|neural network|artificial intelligence|nlp|llm|computer vision|chatbot)\b/i,
  },
  linux: {
    topics: ["linux", "kernel", "systemd", "gnome", "kde", "x11", "wayland", "unix", "dotfiles", "window-manager", "bash", "shell"],
    text: /\b(linux|gnome|kde|x11|wayland|unix|bsd|dotfiles|window manager|systemd)\b/i,
  },
  web: {
    topics: ["web", "frontend", "backend", "css", "html", "react", "vue", "angular", "nodejs", "web-framework", "http", "website", "wordpress", "webapp", "web-app", "javascript-framework"],
    text: /\b(web ?(app|site|framework|server)?|frontend|front-end|backend|browser|http|css|html|react|vue|angular|wordpress)\b/i,
    languages: ["HTML", "CSS"],
  },
  mobile: {
    topics: ["android", "ios", "mobile", "react-native", "flutter", "xamarin", "cordova", "ionic", "swift", "kotlin"],
    text: /\b(android|ios|iphone|mobile|react native|flutter|xamarin|cordova)\b/i,
    languages: ["Swift", "Kotlin", "Objective-C"],
  },
};

export function categorize(input: { name: string; description: string | null; topics: string[]; language: string | null }): CategoryKey[] {
  const topics = new Set(input.topics.map((t) => t.toLowerCase()));
  const text = `${input.name} ${input.description ?? ""}`;
  const result: CategoryKey[] = [];
  for (const key of CATEGORY_KEYS) {
    const rule = RULES[key];
    const byTopic = rule.topics.some((t) => topics.has(t));
    const byText = rule.text.test(text);
    const byLanguage = Boolean(input.language && rule.languages?.includes(input.language));
    if (byTopic || byText || byLanguage) result.push(key);
  }
  return result;
}

export function isCategoryKey(value: string): value is CategoryKey {
  return (CATEGORY_KEYS as readonly string[]).includes(value);
}
