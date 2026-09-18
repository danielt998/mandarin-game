# Hanzi Hop

A fast, mobile-first Mandarin sentence matching game. Each round asks the player to match a Mandarin sentence to its English meaning, with optional pronunciation playback and translation reveal.

Choose **Beginner** for short, familiar sentences and pinyin; **Explorer** for longer everyday phrases; or **Challenge** for longer sentences with pinyin hidden. Correct answers earn 10, 15, and 20 XP respectively.

**Nuance Lab** is a separate mode for comparing close grammar and vocabulary contrasts. Choose **Core** for clear, high-value distinctions, **Advanced** for context-dependent grammar details, or **Expert** for subtle implication and speaker stance. Its 59 current cards are in `data/nuance-cards.json`.

## Run it

Serve this directory with any static web server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Data and privacy

The app attempts to load Mandarin/English sentence pairs from the [Tatoeba Project](https://tatoeba.org/) API on startup. A built-in starter set keeps the game playable when the API or network is unavailable. Scores, answers, missed sentences, and activity history are stored only in the browser's `localStorage`; no account or server is required.

Tatoeba content is provided under its applicable contributor licenses. See [Tatoeba's licensing information](https://tatoeba.org/en/terms_of_use) for details.

## Generating Nuance Lab candidates

`generate_nuance_data.py` reads the 60 defined curriculum topics from `data/nuance-topics.json`, generates one card per topic, and runs a separate API review pass. It writes the results to `data/nuance-cards.generated.json`, **never** directly to the live game data. `--limit N` processes only the first N topics for a low-cost trial run.

```sh
export OPENAI_API_KEY="your-key"
python3 generate_nuance_data.py --limit 3
```

The default model is `gpt-5.6-luna`; change it with `OPENAI_MODEL` or `--model`. Inspect every approved candidate for accuracy, naturalness, and appropriate nuance, then copy only reviewed cards into `data/nuance-cards.json`. Use `--overwrite` only when intentionally replacing a previous candidate run.
