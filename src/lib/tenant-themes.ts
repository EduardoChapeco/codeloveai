/**
 * Tenant Theme Presets
 * Each preset defines CSS variable overrides applied via TenantContext
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; card: string; primary: string; accent: string };
  variables: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "apple-glass",
    name: "Apple Glass",
    description: "Glassmorphism estilo iCloud — superfícies translúcidas, blur alto",
    preview: { bg: "#f8f8fa", card: "#ffffffb8", primary: "#0A84FF", accent: "#5E5CE6" },
    variables: {
      "--background": "0 0% 97.5%",
      "--card": "0 0% 100%",
      "--muted": "0 0% 95.5%",
      "--border": "0 0% 90%",
      "--glass-bg": "0 0% 100% / 0.72",
      "--glass-border": "0 0% 100% / 0.5",
      "--glass-blur": "24px",
      "--glass-saturate": "180%",
      "--radius": "1rem",
    },
  },
  {
    id: "midnight",
    name: "Midnight Pro",
    description: "Tema escuro sofisticado — ideal para devs e tech",
    preview: { bg: "#0f1117", card: "#1a1d27", primary: "#6366f1", accent: "#818cf8" },
    variables: {
      "--background": "228 14% 7%",
      "--foreground": "210 20% 95%",
      "--card": "228 14% 11%",
      "--card-foreground": "210 20% 95%",
      "--popover": "228 14% 11%",
      "--popover-foreground": "210 20% 95%",
      "--muted": "228 10% 15%",
      "--muted-foreground": "215 15% 55%",
      "--accent": "228 20% 18%",
      "--accent-foreground": "210 20% 90%",
      "--border": "228 10% 18%",
      "--input": "228 10% 18%",
      "--glass-bg": "228 14% 12% / 0.8",
      "--glass-border": "228 10% 20% / 0.5",
      "--glass-blur": "20px",
      "--glass-saturate": "150%",
      "--sidebar-background": "228 14% 9%",
      "--sidebar-foreground": "210 15% 70%",
      "--sidebar-accent": "228 20% 15%",
      "--sidebar-accent-foreground": "210 20% 90%",
      "--sidebar-border": "228 10% 15%",
      "--radius": "0.75rem",
    },
  },
  {
    id: "warm-clay",
    name: "Warm Clay",
    description: "Tons quentes e terrosos — acolhedor e premium",
    preview: { bg: "#faf8f5", card: "#ffffff", primary: "#c2410c", accent: "#ea580c" },
    variables: {
      "--background": "36 33% 97%",
      "--card": "0 0% 100%",
      "--muted": "36 20% 94%",
      "--muted-foreground": "25 10% 42%",
      "--border": "36 15% 88%",
      "--input": "36 15% 88%",
      "--accent": "24 80% 96%",
      "--accent-foreground": "24 80% 30%",
      "--glass-bg": "36 33% 99% / 0.75",
      "--glass-border": "36 20% 92% / 0.5",
      "--glass-blur": "20px",
      "--glass-saturate": "120%",
      "--sidebar-background": "36 20% 98%",
      "--sidebar-foreground": "25 15% 25%",
      "--sidebar-accent": "24 80% 96%",
      "--sidebar-accent-foreground": "24 80% 30%",
      "--sidebar-border": "36 15% 90%",
      "--radius": "0.875rem",
    },
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Azul oceano calmo — clean e profissional",
    preview: { bg: "#f0f7ff", card: "#ffffff", primary: "#0369a1", accent: "#0284c7" },
    variables: {
      "--background": "210 60% 97%",
      "--card": "0 0% 100%",
      "--muted": "210 30% 94%",
      "--muted-foreground": "210 15% 42%",
      "--border": "210 20% 88%",
      "--input": "210 20% 88%",
      "--accent": "199 80% 95%",
      "--accent-foreground": "199 80% 30%",
      "--glass-bg": "210 60% 99% / 0.75",
      "--glass-border": "210 30% 92% / 0.5",
      "--glass-blur": "22px",
      "--glass-saturate": "160%",
      "--sidebar-background": "210 40% 98%",
      "--sidebar-foreground": "210 20% 25%",
      "--sidebar-accent": "199 80% 95%",
      "--sidebar-accent-foreground": "199 80% 30%",
      "--sidebar-border": "210 20% 90%",
      "--radius": "1rem",
    },
  },
  {
    id: "forest-green",
    name: "Forest Green",
    description: "Verde natureza — sustentável e orgânico",
    preview: { bg: "#f2f7f2", card: "#ffffff", primary: "#16a34a", accent: "#15803d" },
    variables: {
      "--background": "120 20% 96%",
      "--card": "0 0% 100%",
      "--muted": "120 12% 93%",
      "--muted-foreground": "120 8% 42%",
      "--border": "120 10% 88%",
      "--input": "120 10% 88%",
      "--accent": "142 50% 94%",
      "--accent-foreground": "142 50% 25%",
      "--glass-bg": "120 20% 99% / 0.75",
      "--glass-border": "120 12% 92% / 0.5",
      "--glass-blur": "20px",
      "--glass-saturate": "140%",
      "--sidebar-background": "120 15% 98%",
      "--sidebar-foreground": "120 10% 25%",
      "--sidebar-accent": "142 50% 94%",
      "--sidebar-accent-foreground": "142 50% 25%",
      "--sidebar-border": "120 10% 90%",
      "--radius": "0.75rem",
    },
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    description: "Roxo elegante — premium e criativo",
    preview: { bg: "#f8f5ff", card: "#ffffff", primary: "#7c3aed", accent: "#8b5cf6" },
    variables: {
      "--background": "263 60% 97%",
      "--card": "0 0% 100%",
      "--muted": "263 20% 94%",
      "--muted-foreground": "263 10% 42%",
      "--border": "263 15% 88%",
      "--input": "263 15% 88%",
      "--accent": "263 80% 96%",
      "--accent-foreground": "263 60% 35%",
      "--glass-bg": "263 60% 99% / 0.75",
      "--glass-border": "263 20% 92% / 0.5",
      "--glass-blur": "22px",
      "--glass-saturate": "170%",
      "--sidebar-background": "263 30% 98%",
      "--sidebar-foreground": "263 15% 25%",
      "--sidebar-accent": "263 80% 96%",
      "--sidebar-accent-foreground": "263 60% 35%",
      "--sidebar-border": "263 15% 90%",
      "--radius": "1rem",
    },
  },
  {
    id: "flat-minimal",
    name: "Flat Minimal",
    description: "Design plano sem blur — minimalista e rápido",
    preview: { bg: "#ffffff", card: "#f9fafb", primary: "#111827", accent: "#374151" },
    variables: {
      "--background": "0 0% 100%",
      "--card": "210 10% 98%",
      "--muted": "210 10% 96%",
      "--muted-foreground": "215 10% 45%",
      "--border": "210 10% 90%",
      "--input": "210 10% 90%",
      "--accent": "210 10% 95%",
      "--accent-foreground": "215 20% 20%",
      "--glass-bg": "0 0% 98% / 1",
      "--glass-border": "210 10% 90% / 1",
      "--glass-blur": "0px",
      "--glass-saturate": "100%",
      "--sidebar-background": "210 10% 98%",
      "--sidebar-foreground": "215 15% 25%",
      "--sidebar-accent": "210 10% 95%",
      "--sidebar-accent-foreground": "215 20% 20%",
      "--sidebar-border": "210 10% 90%",
      "--radius": "0.5rem",
    },
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    description: "Tema dark neon — gaming e tech futurista",
    preview: { bg: "#0a0a0f", card: "#13131f", primary: "#06b6d4", accent: "#22d3ee" },
    variables: {
      "--background": "240 20% 4%",
      "--foreground": "180 20% 95%",
      "--card": "240 18% 9%",
      "--card-foreground": "180 20% 95%",
      "--popover": "240 18% 9%",
      "--popover-foreground": "180 20% 95%",
      "--muted": "240 15% 13%",
      "--muted-foreground": "180 10% 50%",
      "--border": "240 12% 16%",
      "--input": "240 12% 16%",
      "--accent": "192 80% 15%",
      "--accent-foreground": "192 80% 80%",
      "--glass-bg": "240 18% 10% / 0.85",
      "--glass-border": "240 12% 18% / 0.6",
      "--glass-blur": "16px",
      "--glass-saturate": "200%",
      "--sidebar-background": "240 18% 6%",
      "--sidebar-foreground": "180 15% 65%",
      "--sidebar-accent": "192 80% 12%",
      "--sidebar-accent-foreground": "192 80% 80%",
      "--sidebar-border": "240 12% 12%",
      "--radius": "0.75rem",
    },
  },
];

export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(t => t.id === id);
}

/**
 * Convert hex color to HSL string for CSS variables
 */
export function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
