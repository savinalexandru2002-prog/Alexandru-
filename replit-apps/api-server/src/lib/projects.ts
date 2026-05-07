export interface ProjectMeta {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export const PROJECTS: ProjectMeta[] = [
  {
    slug: "mp3-player",
    name: "GitHub Distribution Hub",
    description: "Central hub for connecting and pushing all Replit projects to GitHub automatically.",
    icon: "🛰️",
  },
  {
    slug: "api-server",
    name: "API Server",
    description: "Express backend powering the Distribution Hub — handles GitHub auth, file pushing, and auto-sync.",
    icon: "⚙️",
  },
  {
    slug: "mockup-sandbox",
    name: "Component Sandbox",
    description: "Live preview environment for building and comparing UI components side-by-side.",
    icon: "🧪",
  },
];

export const ORIGINAL_FILES: ProjectMeta[] = [
  {
    slug: "termux-mp3",
    name: "Termux MP3 Player",
    description: "Original MP3 player script built for Termux on Android.",
    icon: "🎵",
  },
];

export function getProject(slug: string): ProjectMeta | undefined {
  return PROJECTS.find(p => p.slug === slug);
}
