# Product

## Register

product

## Users
Curious listeners, hobbyist producers, students, and focus/relaxation seekers who want a soundtrack for *how they feel right now*. They open the app — often with headphones — pick a mood, tweak a couple of dials, and want to hear something with character in seconds, then optionally export the MIDI.

## Product Purpose
**Mood** is a browser-based generative music dashboard. The user chooses a **mood** (Chill, Melancholic, Happy, Focused, Sleepy, or Surprise me), shapes it with energy, tempo, instrument, and duration, and the app composes a deterministic two-voice piece (melody + bass) that plays in-browser and exports as MIDI. Success: the chosen mood reliably *sounds* like that mood, while each generation feels fresh.

## Brand Personality
Dreamy, premium, a little nocturnal — a calm cyber-dream music studio. Confident and legible like a well-built product (Spotify Wrapped / Calm / Headspace energy), with delight carried by neon glow, smooth motion, and the music itself rather than by loud copy.

## Anti-references
- Generic SaaS dashboard with a hero-metric and gridlocked cards.
- Childish "music app" with cartoon notes and candy gradients-as-text.
- Flat, all-black developer-tool darkness with no depth or color.

## Design Principles
- **Mood is the headline.** The interface makes the chosen feeling visible (color, glow) and audible.
- **The dashboard reacts.** Selecting controls, generating, and playing all give immediate tactile feedback.
- **Real, not mocked.** Generate actually composes; Play actually plays; Download exports a valid MIDI file.
- **Deterministic, never random-feeling.** Same inputs → same piece; variety comes from mood + settings + seed, on purpose.
- **Calm and spacious.** Glassmorphism and breathing room over density; the tool should feel restful.

## Accessibility & Inclusion
- Body/control text meets contrast on the dark surface; neon colors are accents, not text.
- Full keyboard operability (mood selector is an arrow-navigable radiogroup); visible focus rings.
- `prefers-reduced-motion`: drop decorative orb/glow/waveform motion, keep functional state changes.
- Don't rely on color alone — moods carry emoji + text labels; states carry text/toasts.
