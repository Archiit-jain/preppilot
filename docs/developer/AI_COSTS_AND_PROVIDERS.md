# AI costs, limits, and a plan for no outages

What the assistant costs, what the free tier allows, what the app does today
when the model is busy, and a staged plan for keeping it answering as usage
grows. Figures were checked on **24 September 2026**; Google changes them, so
re-check the linked pages before relying on a number.

## What Gemini costs

From Google's [Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing),
per million tokens, paid tier:

| Model                              | Input                               | Output (thinking included)          |
| ---------------------------------- | ----------------------------------- | ----------------------------------- |
| `gemini-3.6-flash` (main model)    | $0.75 until 31 Dec 2026, then $1.50 | $3.75 until 31 Dec 2026, then $7.50 |
| `gemini-3.5-flash-lite` (fallback) | $0.30                               | $2.50                               |
| `gemini-3.1-flash-lite`            | $0.25                               | $1.50                               |

- **Free tier:** both models are free of charge, but Google states that content
  sent on the free tier is used to improve its products. On the paid tier it is
  not. For a student's questions and photographed notes, that alone is a reason
  to move to the paid tier before real users arrive.
- The price of 3.6 Flash **doubles on 1 January 2027**.

## What the free tier allows

Google no longer publishes fixed numbers; the live limits for a project are in
[AI Studio → Rate limit](https://aistudio.google.com/rate-limit). Figures
reported for September 2026:

| Model                        | Requests per day (free tier) |
| ---------------------------- | ---------------------------: |
| Gemini 3.6 / 3.7 / 3.8 Flash |                          ~20 |
| Gemini 3.5 / 3.1 Flash-Lite  |                         ~500 |

There are also per-minute limits (requests and input tokens). Exceeding any
limit returns **429**; Google being overloaded returns **503**.

**These limits are per Google Cloud project — shared by every student using
PrepPilot**, not per student. Twenty questions a day covers one developer testing
the app. It is exhausted within the first hour of a class trying it, which is what
the "could not answer that" failures during testing were.

Tier upgrades, from Google's [rate-limit page](https://ai.google.dev/gemini-api/docs/rate-limits):

| Tier   | How to get it                                         | Spend cap per rolling 10 minutes |
| ------ | ----------------------------------------------------- | -------------------------------: |
| Free   | Default                                               |                                — |
| Tier 1 | Link an active billing account (takes effect at once) |                              $10 |
| Tier 2 | $100 spent and 3 days since first payment             |                              $50 |
| Tier 3 | $1,000 spent and 30 days since first payment          |                             $200 |

## What a student costs

Estimates, from what the app sends. The function does not yet log real token
counts (step 2 below adds that):

| Request                                     | Input tokens | Output tokens (incl. ≤512 thinking) | Cost on 3.6 Flash | Cost on 3.5 Flash-Lite |
| ------------------------------------------- | -----------: | ----------------------------------: | ----------------: | ---------------------: |
| A follow-up question (summary + 6 messages) |       ~2,500 |                                ~700 |           ~$0.005 |                ~$0.003 |
| A chat question                             |         ~400 |                                ~700 |           ~$0.003 |                ~$0.002 |
| A question with a photo (1600 px)           |      ~1,500+ |                                ~800 |           ~$0.004 |                ~$0.003 |
| A topic summary                             |         ~300 |                                ~500 |           ~$0.002 |               ~$0.0014 |
| A 15-question competitive quiz              |         ~350 |                              ~3,000 |            ~$0.01 |                ~$0.008 |

A busy student asking 20 questions and taking 2 quizzes a day costs roughly
**$0.08 a day, about $2.40 a month** on 3.6 Flash at 2026 prices, about half that
on Flash-Lite. A hundred such students is on the order of $240 a month; most
students use far less. The per-account limit in the function (20 requests an
hour) caps the worst case per student.

## What the app does today

Since 24 September 2026 (`supabase/functions/ask-gemini/index.ts`):

1. Ask **Gemini 3.6 Flash**.
2. If it answers **429 or 503**, wait about a second and ask it **once more**.
3. If it is still busy, ask **Gemini 3.5 Flash-Lite** (no thinking budget).
4. If that is busy, ask **Gemini 3.1 Flash-Lite**, which has its own free
   allowance.
5. If that is busy too, return **429 "busy"**; the app says _"The assistant is
   busy right now. Try again in a minute."_ Any other failure is a 502 and the
   generic message. Upstream error bodies are never forwarded.

The app reads the status from Supabase's `FunctionsHttpError` (`context.status`),
because its message never includes the code — which is why every busy answer
used to read "could not answer that".

This makes the free tier usable for a demonstration, since Flash-Lite's larger
free allowance absorbs most of the load. It does not make it suitable for real
students.

## A plan for no limits and no outages

"No limits" does not exist with any provider: every one has quotas and outages.
The achievable goal is that no student ever meets one: enough headroom, a second
route when the first fails, and answers that do not need a model at all where
possible. Each step stands on its own; do them in order.

### Step 1 — Turn on billing for the existing project (a day, ~no code)

- Link a billing account to the Google Cloud project behind the API key.
  Tier 1 applies at once: paid-tier rate limits, and students' content is no
  longer used for training.
- In Google Cloud Billing, set a **budget with alerts** at 50/90/100% of a
  monthly figure (for example $25 to start).
- Keep the function's per-account limit (20 requests an hour) and the anonymous
  demo's shared limit (60 an hour), which bound what one account can spend.
- Nothing in the app changes. This alone removes the day-to-day "busy" errors.

### Step 2 — Record usage, and give every account a daily allowance (2–3 days)

The per-account limit today lives in the function's memory: it resets when the
function restarts and is not shared between instances.

- Add a table `ai_usage (user_id, day, requests, input_tokens, output_tokens)`,
  written by the function from Gemini's `usageMetadata` after each call.
- Enforce a **daily allowance per account** from that table (for example 50
  questions and 5 quizzes a day), and show the student what is left ("12
  questions left today"). This is the "credits" model: predictable cost, and a
  clear message instead of an error.
- A dashboard query over the table gives real per-student cost, replacing the
  estimates above.

### Step 3 — Answer common requests from a cache (2 days)

Summaries and quizzes are built from a topic's name and place in the syllabus,
so every student asking to summarise "Ohm's law" under Physics → Electricity is
asking the same thing.

- Add `ai_cache (key, reply, created_at)`, keyed on a hash of mode, topic,
  chapter, subject and quiz settings.
- Serve a summary from the cache if one exists; for quizzes, keep several per key
  and hand them out in turn so students do not all see the same questions.
- For the bundled syllabi (22 templates, ~5,800 topics) this could be
  pre-generated once, making summaries free, instant and immune to outages.

### Step 4 — A second provider behind the first (3–5 days)

For outages on Google's side, add a provider that fails differently:

- **Vertex AI** runs the same Gemini models on Google Cloud with a separate
  quota pool and a paid SLA, and offers _provisioned throughput_ — reserved
  capacity bought ahead. The best fit, since the prompts and image handling stay
  identical. Check current prices on Google Cloud's Vertex AI pricing page.
- **OpenRouter** is one OpenAI-style API in front of many model providers, with
  automatic fallback between them and no fee on top of the provider's price.
  A good last resort for text questions. Pictures need a vision-capable model.
- In the function, put providers behind one `generate(request)` interface and
  try them in order: Gemini API → Vertex AI → OpenRouter. Keys stay as Supabase
  secrets, exactly as now.
- The app does not change: the function's response format stays the same.

### Step 5 — Watch it

- Alert when the fallback rate rises above a few per cent, or when any
  provider's error rate spikes. Both can be computed from the usage table in
  step 2.
- Revisit the model choice at the end of 2026, when 3.6 Flash doubles in price;
  3.5 Flash-Lite or a newer Flash may be the better main model by then.

## Recommendation

Do **step 1 before real students use the app**. It is cheap and quick, and it
fixes the limit and the privacy concern together. Do **steps 2 and 3 before a
wider launch**, because they make cost predictable and cut it sharply. Step 4 is
insurance, worth adding once the assistant is something students depend on.
