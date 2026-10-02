import { readFileSync } from 'fs';
import { join } from 'path';
import { parseThemePack, type ThemePack } from '@preppilot/shared';

/** The downloadable themes, read from the repository rather than the network. */
export const PACK_IDS = ['notebook', 'flight-deck', 'bold-bento'] as const;
export type PackId = (typeof PACK_IDS)[number];

const PACKS_DIR = join(__dirname, '..', '..', '..', '..', 'supabase', 'themes', 'packs');

export function rawPack(id: string): unknown {
  return JSON.parse(readFileSync(join(PACKS_DIR, `${id}.json`), 'utf8'));
}

export function loadPack(id: PackId): ThemePack {
  return parseThemePack(rawPack(id));
}
