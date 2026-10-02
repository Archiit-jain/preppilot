# Themes

PrepPilot has one built-in look, **Classic**. Every other look is a
**downloadable theme**: the app fetches it from the server only when a student
chooses it in **Settings → Themes**. Nothing about themes is bundled into the
APK, so the app download stays the same size (D106).

| Theme       | Look                                                                         | Download |
| ----------- | ---------------------------------------------------------------------------- | -------: |
| Classic     | The original dark/light design. Built in, the default                        |        — |
| Notebook    | Ruled paper, taped sticky-note subjects, highlighter titles; chalkboard dark |   770 KB |
| Flight deck | Cockpit instruments: amber on navy, tick-marked bars, monospaced readouts    |   565 KB |
| Bold bento  | Thick ink outlines, hard offset edges, loud flat colours; neon edges dark    |   340 KB |

## How it works

```
Settings → Themes
  └─ GET  …/storage/v1/object/public/themes/catalog.json      the list, with sizes
Download
  ├─ GET  …/themes/packs/<id>.json                             colours, shapes, font names
  └─ GET  …/themes/fonts/<Family>.ttf  (each font the pack names)
       saved to <documents>/themes/<id>/   then applied
Launch
  └─ <documents>/themes/active.txt → load that theme's fonts → first frame
```

- **Hosting.** The public `themes` bucket in the project's Supabase Storage
  (migration `20261002000001_theme_packs_bucket.sql`). Reads need no account or
  key. There are no write policies, so only the service role can change files.
- **On the phone.** Everything is kept in the app's documents folder rather than
  the cache, which the OS may empty. `installed.json` is written last, so an
  interrupted download is not mistaken for an installed theme. The web build
  keeps records in `localStorage` and loads fonts from their URLs.
- **At launch.** `useRestoredTheme` loads the chosen theme's fonts before the
  first frame, so the app doesn't open in Classic and then jump. It waits at most
  2.5 s, then opens in Classic.
- **Offline.** A downloaded theme keeps working, and Settings still lists it when
  the catalog can't be fetched.

## What a theme can change

A pack is JSON validated by `parseThemePack` (`packages/shared/src/theme/theme-pack.ts`).
Because it comes from the network, nothing in it is trusted. Colours must be
`#RRGGBB`, numbers must sit within fixed ranges, font paths must match
`fonts/<Name>.ttf`, and every font family the pack uses must be one it ships.
Any failure rejects the whole pack.

| Section      | Controls                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors`     | The full light and dark colour schemes, the same keys as Classic's                                                                                                              |
| `ornament`   | Highlighter, page rules, margin line, card edge, and icon colour on subject colours                                                                                             |
| `radius`     | Corner sizes                                                                                                                                                                    |
| `fonts`      | Body face per weight, an optional heading face (scaled), an optional mono face                                                                                                  |
| `components` | Card edges, how a subject's colour shows (sticky, tint, strip), button shape, bar and ring styles, checkbox, play button, text field, page background, title highlight, tab bar |

Components read these through `theme.look`. **When `theme.look` is null
(Classic), every component takes exactly the code path it had before themes
existed.** That is how themes leave the app unchanged for anyone who never uses
them. The Classic tests (unchanged since then) are the check.

Figures (timer, percentages) never use a handwritten heading face. Its digits
vary in width, so a running clock would jitter.

## Adding or changing a theme

1. Edit or add `supabase/themes/packs/<id>.json`. Bump `version` when you change
   an existing pack, so phones that have it are offered **Update**.
2. `pnpm --filter @preppilot/shared test` checks every pack against the
   validator, including WCAG contrast for text, accents and icons, in both modes.
3. Build: `node supabase/themes/build-themes.mjs`. It fetches the fonts with
   `npm pack` from the `@expo-google-fonts` packages (SIL Open Font License) and
   writes `supabase/themes/dist/`. A new font family needs its package added to
   `FONT_PACKAGES` in the script.
4. Upload from `supabase/themes/dist`. `storage cp` will not overwrite an
   existing file, so remove a changed file before copying it again:

```bash
npx supabase storage rm ss:///themes/catalog.json --linked --experimental --workdir ../../.. --yes
```

```bash
npx supabase storage cp catalog.json ss:///themes/catalog.json --linked --experimental --workdir ../../..
```

```bash
npx supabase storage cp -r packs ss:///themes --linked --experimental --workdir ../../..
```

```bash
npx supabase storage cp -r fonts ss:///themes --linked --experimental --workdir ../../..
```

No app build is needed: phones pick up the new catalog the next time Settings
opens.

## Limits

- A theme restyles shared components and colours. Screens that hard-code a
  layout keep that layout under every theme.
- Fonts are downloaded once per theme. Two themes that share a face (Flight deck
  and Bold bento both use Space Grotesk) each keep their own copy, so removing
  one never breaks the other.
- The pack format is versioned (`format: 1`). A pack with a newer format is
  refused with "needs a newer version of PrepPilot" rather than half-rendered.
