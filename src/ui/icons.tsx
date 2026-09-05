import type { Section } from "../lib/nav";

export type IconId = Section | "menu" | "close" | "business" | "cloud" | "user" | "database" | "guide" | "back";

const PATHS: Record<IconId, string> = {
  dashboard: "M4 4h7v7H4V4Zm9 0h7v4h-7V4Zm0 7h7v9h-7v-9ZM4 14h7v6H4v-6Z",
  materials: "M4 8.5 12 4l8 4.5-8 4.5-8-4.5Zm0 0V16l8 4.5m0-11V20m0-11 8-4.5m0 0V16l-8 4.5",
  recipes: "M10 3h4m-1 0v5.2L17.5 18a1.6 1.6 0 0 1-1.4 2.4H7.9A1.6 1.6 0 0 1 6.5 18L11 8.2V3M8.5 14h7",
  lots: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  labels: "M4 4h5v5H4V4Zm11 0h5v5h-5V4ZM4 15h5v5H4v-5Zm11 1h2m-2 3.5h5V15h-3m-2 0v5m5-3h-3",
  plan: "M5 5h14v15H5V5Zm0 4.5h14M8 3v3.6M16 3v3.6M8.3 13.3h2m3.4 0h2m-7.4 3.6h2m3.4 0h2",
  qc: "m4.5 12.5 4.5 4.5L19.5 6.5",
  customers: "M9 11a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Zm-6 9c0-3.6 2.7-6 6-6s6 2.4 6 6M16.5 5a3.3 3.3 0 0 1 0 6.4M18.5 14.4c2 .6 3.5 2.6 3.5 5.6",
  finished: "M5 8.5 12 4l7 4.5V17L12 21l-7-4V8.5Zm7 4.5V21m0-8L5 8.5M12 13l7-4.5",
  reports: "M5 20V10m6.5 10V4m6.5 16v-7",
  settings:
    "M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 3.4a8.2 8.2 0 0 1-.1 1.3l2 1.6-2 3.4-2.4-1a8 8 0 0 1-2.2 1.3l-.4 2.6H9.7l-.4-2.6a8 8 0 0 1-2.2-1.3l-2.4 1-2-3.4 2-1.6a8.2 8.2 0 0 1 0-2.6l-2-1.6 2-3.4 2.4 1a8 8 0 0 1 2.2-1.3l.4-2.6h4.6l.4 2.6a8 8 0 0 1 2.2 1.3l2.4-1 2 3.4-2 1.6c.07.4.1.86.1 1.3Z",
  menu: "M4 6.5h16M4 12h16M4 17.5h16",
  close: "M5 5l14 14M19 5 5 19",
  business: "M4 10.5 12 4l8 6.5V21H4V10.5Zm5 10.5v-7h6v7",
  cloud: "M7.5 18a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.6-2A4 4 0 0 1 17.5 18h-10Z",
  user: "M12 12a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6ZM5 20c0-3.5 3-6 7-6s7 2.5 7 6",
  database:
    "M12 5c4 0 7 1.1 7 2.5S16 9 12 9s-7-1.4-7-2.5S8 5 12 5Zm-7 2.5V17c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5V7.5M5 12c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5",
  guide:
    "M4 5.5C4 4.7 4.9 4 6 4c2 0 4 .6 6 1.8C14 4.6 16 4 18 4c1.1 0 2 .7 2 1.5v13c0 .8-.9 1.5-2 1.5-2 0-4 .6-6 1.8-2-1.2-4-1.8-6-1.8-1.1 0-2-.7-2-1.5v-13ZM12 5.8v13",
  back: "M15 5 8 12l7 7",
};

export function NavIcon({ id, size = 19 }: { id: IconId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[id]} />
    </svg>
  );
}

