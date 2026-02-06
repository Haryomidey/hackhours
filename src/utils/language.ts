import path from "node:path";

const EXTENSION_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".rb": "Ruby",
  ".php": "PHP",
  ".swift": "Swift",
  ".dart": "Dart",
  ".lua": "Lua",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".ps1": "PowerShell",
  ".json": "JSON",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".toml": "TOML",
  ".md": "Markdown",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".less": "LESS",
  ".sql": "SQL",
};

export const detectLanguage = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? "Other";
};
