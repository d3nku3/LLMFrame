# Contributing to LLMFrame

Contributions are welcome — bug reports, documentation improvements, domain packs, and code fixes.

## How to contribute

1. **Open an issue first.** Describe what you want to change and why. This avoids duplicate work and gives a chance to align on approach before you invest time.
2. **Fork the repo and create a branch.** Use a descriptive branch name (`fix/plausibility-false-positive`, `docs/add-legal-domain-pack`).
3. **Keep changes focused.** One fix per PR. If you found three bugs, open three PRs.
4. **Test your changes.** Load the Console, run through at least one stage cycle, verify nothing breaks. If you changed plausibility rules or protocol fields, run `checkPlausibilityProtocolAlignment()` in the browser console.
5. **Submit a pull request.** Reference the issue number. Describe what changed and how you tested it.

## What's most useful right now

- **Domain packs.** If you've compiled a working domain pack for a non-coding field (legal, engineering, research, book publishing), that's immediately valuable. Include the 6 compiled prompts and a brief description of the domain.
- **Bug reports with reproduction steps.** "The Console broke" is hard to act on. "Stage 05 save produces a stale review warning when the implementation hasn't changed — here's my workspace state" is actionable.
- **Documentation fixes.** Typos, unclear explanations, broken links, missing context.

## What to avoid

- **Don't change frozen tokens or protocol field names** without coordinating first. These are consumed by multiple tools and changing them silently breaks things.
- **Don't add build tooling, package managers, or server dependencies.** Zero dependencies is a core design constraint, not a limitation to work around.
- **Don't add autonomous agent features.** The human-in-the-loop is the point.

## Code style

- All code, comments, and documentation in English.
- No build step. The Console is vanilla HTML + JS modules.
- Keep functions small and named descriptively.
- Comments explain *why*, not *what*.

## Response times

This is a personal project shared publicly. I review PRs and issues when I can. If something is urgent, say so in the issue — but understand that "urgent" and "solo maintainer" don't always align.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
