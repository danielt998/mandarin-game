#!/usr/bin/env python3
"""Generate reviewable Nuance Lab candidates; never writes the live card file."""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
TOPICS_PATH = ROOT / "data" / "nuance-topics.json"
OUTPUT_PATH = ROOT / "data" / "nuance-cards.generated.json"
API_URL = "https://api.openai.com/v1/chat/completions"

CARD_KEYS = {"id", "level", "tag", "sentenceA", "sentenceB", "question", "choices", "answerIndex", "explanation"}
CARD_SHAPE = """{
  "id": "lowercase-kebab-case",
  "level": "core, advanced, or expert",
  "tag": "short English concept",
  "sentenceA": "Chinese sentence",
  "sentenceB": "Chinese sentence differing in the target nuance",
  "question": "one precise English comprehension question",
  "choices": ["four concise English choices"],
  "answerIndex": 0,
  "explanation": "one accurate, qualified English explanation"
}"""

GENERATOR_INSTRUCTIONS = f"""You create carefully scoped advanced Mandarin learning cards.
Return one JSON object only, with exactly this shape:
{CARD_SHAPE}

Requirements:
- Use simplified Chinese and natural, idiomatic Mandarin.
- Make the two sentences minimally different while demonstrating the requested nuance.
- Give exactly four plausible choices, exactly one correct answer, and a zero-based answerIndex.
- The question must be answerable from the sentences alone. Do not require an unstated story.
- Explain tendencies rather than claiming grammar rules have no exceptions.
- Do not use real-person claims, copyrighted text, or citations.
"""

REVIEWER_INSTRUCTIONS = f"""You are a meticulous editor of advanced Mandarin teaching materials.
Review the candidate below for grammatical accuracy, naturalness, a real contrast, one unambiguously correct answer,
and an explanation that does not overstate the rule. Return JSON only:
{{
  "approved": true,
  "issues": ["brief issue, if any"],
  "card": {CARD_SHAPE}
}}

Set approved false if the distinction is inaccurate, unnatural, ambiguous, or unsuitable for advanced learners.
If it can be repaired confidently, return the complete repaired card; otherwise return the original card.
"""


def request_completion(api_key, model, system, prompt):
    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    }
    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            body = json.load(response)
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API returned HTTP {error.code}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach the OpenAI API: {error.reason}") from error
    try:
        return json.loads(body["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise RuntimeError(f"API response did not contain valid JSON content: {body}") from error


def validate_card(card):
    if not isinstance(card, dict) or set(card) != CARD_KEYS:
        return False
    if not all(isinstance(card[key], str) and card[key].strip() for key in CARD_KEYS - {"choices", "answerIndex"}):
        return False
    return (
        card["level"] in {"core", "advanced", "expert"}
        and
        isinstance(card["choices"], list)
        and len(card["choices"]) == 4
        and len(set(card["choices"])) == 4
        and all(isinstance(choice, str) and choice.strip() for choice in card["choices"])
        and isinstance(card["answerIndex"], int)
        and 0 <= card["answerIndex"] < 4
        and any("\u4e00" <= character <= "\u9fff" for character in card["sentenceA"] + card["sentenceB"])
    )


def main():
    parser = argparse.ArgumentParser(description="Generate reviewed Nuance Lab candidate cards.")
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL", "gpt-5.6-luna"))
    parser.add_argument("--limit", type=int, help="Generate only the first N topics.")
    parser.add_argument("--overwrite", action="store_true", help="Replace an existing candidate output file.")
    args = parser.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("Set OPENAI_API_KEY before running this script.")
    if OUTPUT_PATH.exists() and not args.overwrite:
        raise SystemExit(f"{OUTPUT_PATH} already exists. Review it, or rerun with --overwrite.")

    topics = json.loads(TOPICS_PATH.read_text(encoding="utf-8"))
    if not isinstance(topics, list) or not all(isinstance(topic, dict) and {"level", "tag", "focus"} <= set(topic) and topic["level"] in {"core", "advanced", "expert"} for topic in topics):
        raise SystemExit(f"{TOPICS_PATH} must be a list of core, advanced, or expert topic objects.")
    if args.limit is not None:
        if args.limit < 1:
            raise SystemExit("--limit must be at least 1.")
        topics = topics[:args.limit]

    approved_cards, rejected = [], []
    for index, topic in enumerate(topics, start=1):
        print(f"Generating {index}/{len(topics)}: {topic['tag']}", file=sys.stderr)
        candidate = request_completion(api_key, args.model, GENERATOR_INSTRUCTIONS, json.dumps(topic))
        if not validate_card(candidate):
            rejected.append({"topic": topic, "reason": "Generator returned an invalid card shape."})
            continue
        review = request_completion(api_key, args.model, REVIEWER_INSTRUCTIONS, json.dumps(candidate, ensure_ascii=False))
        card = review.get("card") if isinstance(review, dict) else None
        if isinstance(review, dict) and review.get("approved") is True and validate_card(card):
            approved_cards.append(card)
        else:
            issues = review.get("issues", ["Reviewer rejected the card."]) if isinstance(review, dict) else ["Reviewer returned invalid JSON."]
            rejected.append({"topic": topic, "reason": issues})
        time.sleep(0.2)

    result = {"generatedWith": args.model, "cards": approved_cards, "rejected": rejected}
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(approved_cards)} approved candidates and {len(rejected)} rejected candidates to {OUTPUT_PATH}.", file=sys.stderr)
    print("Review every approved candidate before copying its cards into data/nuance-cards.json.", file=sys.stderr)


if __name__ == "__main__":
    main()
