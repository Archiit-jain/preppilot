# The AI assistant

Implements PRD §14 and §15. Secondary, online-only, and structurally incapable of
changing the tracker on its own.

## The key never reaches a client

```
app  →  Supabase Edge Function (ask-gemini)  →  Gemini
```

The Gemini key is a Supabase secret read at request time. Nothing in the app
knows it, and a key placed in client code would ship to every device that
installs the app — including as plain text in the web bundle.

The function also:

- **Never forwards an upstream error body.** A Gemini failure can carry key or
  quota detail; failures are replaced with a generic message.
- **Rate limits per user.** The proxy spends the project owner's quota, so an
  unlimited endpoint is a financial liability as much as a security one.

## Asking about a picture

A question can carry one picture: a textbook page, handwritten notes, a diagram,
a printed question. The composer's picture button offers **Take photo** or
**Choose from gallery**; the gallery goes through Android's system photo picker,
so only the camera asks for a permission.

```
pick → shrink to 1600 px, JPEG 70% (on the device) → base64 → ask-gemini → Gemini
```

Shrinking happens on the device (`attach-image.ts`, `expo-image-manipulator`).
A phone photo is several megabytes; at 1600 px printed text stays legible and
the upload is a few hundred kilobytes. A picture sent with no question is asked
about with a fixed prompt — explain what it shows and answer any question in it.

The function accepts JPEG, PNG, WebP and HEIC, refuses anything that is not
plain base64 (400) or larger than 5,000,000 base64 characters (413) before any
Gemini quota is spent, and places the picture ahead of the question in the
request so the model reads the question in its light. Summaries and quizzes
never take a picture.

## Replies are formatted, not shown raw

Gemini writes Markdown whether asked to or not. Shown raw, a reply is full of
`**`, `*`, `#` and LaTeX backslashes. `features/ai/markdown.ts` parses the
constructs a chat answer actually uses — bold, italics, strikethrough, inline
code, headings, bullets (nested), numbered steps, quotes, rules, fenced code and
tables — and `components/rich-reply.tsx` renders them with the app's own text
styles. Anything unrecognised passes through as plain text.

Maths gets the same treatment: `$x^2$`, `\(…\)`, `\[…\]` and `$$…$$` are
rewritten as plain Unicode — `\frac{a}{b}` as a/b, `x^{2}` as x², `\sqrt{x}` as
√x, Greek letters and relations as their symbols. A dollar sign counts as maths
only when it hugs its content, so "$5 and $10" is left alone. The system
instruction also tells the model not to use LaTeX; the parser is the safety net.

Written in-house rather than taken from a Markdown package: those bring a full
CommonMark parser and renderer for what is a few hundred lines.

## The composer stays above the keyboard

`KeyboardAvoidingView` computed the keyboard's overlap from the view's layout
relative to its _parent_. Inside a screen below the status bar and above the tab
bar that is not where the view is, so the text box rose by less than the
keyboard covered and stayed half hidden. `lib/use-keyboard-overlap.ts` measures
the view in window coordinates — the space the keyboard's position is reported
in — and pads the screen by exactly the part covered.

## The assistant cannot change anything

PRD §14 forbids the assistant marking topics complete, deleting topics, altering
the syllabus or imposing schedules. That is enforced by the data shape, not by
instructions in a prompt.

A reply is parsed into an inert **proposal**, and the proposal grammar has only
two verbs: `addChapters` and `addTopics`. There is no way to express deleting or
completing, so a model attempting it produces nothing parseable. A test asserts a
`deleteTopics` proposal parses to `null`.

```
reply → parse → proposal (inert) → student reviews → confirms → applied
```

Applying lists exactly what will be added first. A proposal over 200 topics is
refused outright: confirming hundreds of topics is a rubber stamp, not the review
§14 asks for.

## Unconfigured and offline are different

The assistant disables itself and says which it is, rather than accepting a
question and failing after the student has typed it:

- **No Supabase project** — "not set up yet"
- **Offline** — "needs an internet connection. Everything else keeps working
  offline."

## Deploying

```bash
supabase secrets set GEMINI_API_KEY=...
supabase functions deploy ask-gemini
```

Until then the assistant reports itself unavailable and nothing else is affected.
