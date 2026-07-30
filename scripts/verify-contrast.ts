import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../src/styles/global.css', import.meta.url));
const HEX = /--(color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
const ALIAS = /--(t-[a-z-]+):\s*var\(--(color-[a-z0-9-]+)\)\s*;/g;

type Palette = Record<string, string>;

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readPalette(css: string): Palette {
  const palette: Palette = { white: '#ffffff' };
  for (const match of css.matchAll(HEX)) palette[match[1]!] = match[2]!.toLowerCase();
  return palette;
}

function readAliases(source: string, palette: Palette): Palette {
  const resolved: Palette = {};
  for (const match of source.matchAll(ALIAS)) {
    const hex = palette[match[2]!];
    if (hex) resolved[match[1]!] = hex;
  }
  for (const match of source.matchAll(/--(t-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    resolved[match[1]!] = match[2]!.toLowerCase();
  }
  return resolved;
}

interface Pair {
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
  readonly note: string;
}

const PAIRS: readonly Pair[] = [
  { foreground: 't-text', background: 't-surface', minimum: 4.5, note: 'body text on page' },
  { foreground: 't-text', background: 't-surface-raised', minimum: 4.5, note: 'body text on card' },
  { foreground: 't-text', background: 't-surface-sunken', minimum: 4.5, note: 'body text on sunken band' },
  { foreground: 't-text', background: 't-surface-tint', minimum: 4.5, note: 'body text on tinted band' },
  { foreground: 't-heading', background: 't-surface', minimum: 4.5, note: 'heading on page' },
  { foreground: 't-heading', background: 't-surface-raised', minimum: 4.5, note: 'heading on card' },
  { foreground: 't-text-muted', background: 't-surface', minimum: 4.5, note: 'muted text on page' },
  { foreground: 't-text-muted', background: 't-surface-raised', minimum: 4.5, note: 'muted text on card' },
  { foreground: 't-text-inverse', background: 't-surface-inverse', minimum: 4.5, note: 'text on inverted band' },
  { foreground: 't-on-primary', background: 't-primary', minimum: 4.5, note: 'primary button label' },
  { foreground: 't-on-primary', background: 't-primary-hover', minimum: 4.5, note: 'primary button label, hover' },
  { foreground: 't-on-accent', background: 't-accent', minimum: 4.5, note: 'accent CTA label' },
  { foreground: 't-on-accent', background: 't-accent-hover', minimum: 4.5, note: 'accent CTA label, hover' },
  { foreground: 't-accent', background: 't-surface', minimum: 4.5, note: 'inline link on page' },
  { foreground: 't-accent', background: 't-surface-raised', minimum: 4.5, note: 'inline link on card' },
  { foreground: 't-primary', background: 't-surface', minimum: 4.5, note: 'primary text on page' },
  { foreground: 't-danger', background: 't-surface', minimum: 4.5, note: 'error text on page' },
  { foreground: 't-danger', background: 't-surface-raised', minimum: 4.5, note: 'error text on card' },
  { foreground: 't-danger', background: 't-danger-surface', minimum: 4.5, note: 'error text on error panel' },
  { foreground: 't-ok', background: 't-surface', minimum: 4.5, note: 'success text on page' },
  { foreground: 't-ok', background: 't-surface-raised', minimum: 4.5, note: 'success text on card' },
  { foreground: 't-border-strong', background: 't-surface', minimum: 3, note: 'input border on page' },
  { foreground: 't-border-strong', background: 't-surface-raised', minimum: 3, note: 'input border on card' },
  { foreground: 't-ring', background: 't-surface', minimum: 3, note: 'focus ring on page' },
  { foreground: 't-ring', background: 't-surface-raised', minimum: 3, note: 'focus ring on card' },
];

function check(themeName: string, tokens: Palette): string[] {
  const failures: string[] = [];
  for (const pair of PAIRS) {
    const foreground = tokens[pair.foreground];
    const background = tokens[pair.background];
    if (!foreground || !background) {
      failures.push(`${themeName}: unresolved token in "${pair.note}" (${pair.foreground} on ${pair.background})`);
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    const verdict = ratio >= pair.minimum ? 'ok  ' : 'FAIL';
    const line = `  ${verdict} ${ratio.toFixed(2).padStart(5)} : ${pair.note} (${pair.foreground} on ${pair.background})`;
    if (ratio >= pair.minimum) {
      console.log(line);
    } else {
      console.log(`${line}  needs ${pair.minimum}`);
      failures.push(`${themeName}: ${pair.note} is ${ratio.toFixed(2)}:1, needs ${pair.minimum}:1`);
    }
  }
  return failures;
}

const css = readFileSync(CSS_PATH, 'utf8');
const palette = readPalette(css);

const rootStart = css.indexOf(':root {');
const rootBlock = css.slice(rootStart, css.indexOf('}', css.indexOf('--t-ring', rootStart)));

const failures = check('light', readAliases(rootBlock, palette));

if (failures.length > 0) {
  console.error(`\n${failures.length} contrast violation(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\n${PAIRS.length} pairs pass WCAG AA.\n`);
