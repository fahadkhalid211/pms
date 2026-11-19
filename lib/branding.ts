export interface BrandingSettings {
  tagline?: string;
  headerTextColor?: string;
  sidebarTheme?: "dark" | "light" | "brand";
  customCss?: string;
}

export interface OrganizationBranding {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  branding?: BrandingSettings;
}

export interface ColorPreset {
  name: string;
  primary: string;
  accent: string;
  description: string;
}

export const BRANDING_COLOR_PRESETS: ColorPreset[] = [
  {
    name: "Penthouse Monochrome",
    primary: "#000000",
    accent: "#ffffff",
    description: "Ultra-luxury high-contrast black and crisp pure white",
  },
  {
    name: "Obsidian Slate",
    primary: "#09090b",
    accent: "#f4f4f5",
    description: "Refined minimalist dark obsidian with crisp slate highlights",
  },
  {
    name: "Emerald Luxury",
    primary: "#065f46",
    accent: "#10b981",
    description: "Deep botanical green with crisp emerald accents",
  },
  {
    name: "Midnight Navy",
    primary: "#0f172a",
    accent: "#3b82f6",
    description: "Timeless navy blue with modern cobalt accents",
  },
  {
    name: "Amber & Gold",
    primary: "#78350f",
    accent: "#f59e0b",
    description: "Warm amber gold reminiscent of luxury private estates",
  },
  {
    name: "Burgundy Velvet",
    primary: "#881337",
    accent: "#f43f5e",
    description: "Opulent wine red with rose accents",
  },
  {
    name: "Slate Executive",
    primary: "#1e293b",
    accent: "#0ea5e9",
    description: "Modern architectural slate with sky accents",
  },
];

/**
 * Converts a 3 or 6 digit hex code into HSL string (e.g. "217 91% 60%")
 * and calculates high-contrast foreground color.
 */
export function hexToHsl(hex: string): { hsl: string; foreground: string; isLight: boolean } {
  let c = (hex || "#000000").replace("#", "").trim();
  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }
  if (c.length !== 6) {
    return { hsl: "0 0% 9%", foreground: "0 0% 100%", isLight: false };
  }

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  // Perceived brightness (YIQ equation)
  const yiq = (r * 255 * 299 + g * 255 * 587 + b * 255 * 114) / 1000;
  const isLight = yiq >= 150;
  const foreground = isLight ? "222 47% 11%" : "0 0% 100%";

  return {
    hsl: `${hDeg} ${sPct}% ${lPct}%`,
    foreground,
    isLight,
  };
}

/**
 * Builds CSS root variables for injection
 */
export function buildBrandingCss(primaryHex?: string | null, accentHex?: string | null): string {
  const p = hexToHsl(primaryHex || "#000000");
  const a = hexToHsl(accentHex || "#ffffff");

  return `
    :root {
      --primary: ${p.hsl};
      --primary-foreground: ${p.foreground};
      --ring: ${p.hsl};
      --brand-primary: ${primaryHex || "#000000"};
      --brand-accent: ${accentHex || "#ffffff"};
      --accent-hsl: ${a.hsl};
    }
  `.trim();
}
