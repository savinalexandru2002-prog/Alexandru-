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

export const LIBS: ProjectMeta[] = [
  {
    slug: "api-spec",
    name: "API Spec",
    description: "OpenAPI specification that defines the contract between the frontend and backend.",
    icon: "📋",
  },
  {
    slug: "api-client-react",
    name: "API Client (React)",
    description: "Auto-generated React Query hooks and TypeScript types from the OpenAPI spec.",
    icon: "🔗",
  },
  {
    slug: "api-zod",
    name: "API Zod Schemas",
    description: "Auto-generated Zod validation schemas from the OpenAPI spec.",
    icon: "🛡️",
  },
  {
    slug: "db",
    name: "Database",
    description: "Drizzle ORM schema and PostgreSQL database configuration.",
    icon: "🗄️",
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
  return [...PROJECTS, ...LIBS].find(p => p.slug === slug);
}
