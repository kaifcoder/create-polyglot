## Summary
Explain the change in 1–3 sentences. Reference any related issues (e.g. Closes #123).

## Type of Change
- [ ] Feature
- [ ] Bug fix
- [ ] Chore / Refactor
- [ ] Docs
- [ ] Tests
- [ ] CI / Build
- [ ] Other

## Motivation / Context
Why is this change needed? What problem does it solve or what capability does it add?

## Approach
Briefly describe how you implemented the change. Note any notable design decisions, trade-offs, or alternatives considered.

## CLI Impact
If this alters user-facing CLI behavior:
- Added / changed flags? Describe.
- Backward compatible? If breaking, explain migration path.
- Sample invocation before vs after:
```
# before
# after
```

## Generated Output Impact
List any new / modified scaffold files or structural differences (e.g. new template folder, changed Dockerfile pattern, compose changes, new preset behaviors).

## Tests
Describe test coverage:
- [ ] Added new test(s)
- [ ] Updated existing test(s)
- [ ] Manually smoke-tested locally
- [ ] No tests needed (explain why)

If you ran the smoke scaffold locally, paste the command & confirm success:
```
node bin/index.js demo --services node --no-install --yes
```
Result: ✅ / ❌

## Screenshots / Logs (Optional)
Add any helpful output (chalk-styled CLI messages, error reproduction, etc.).

## Docs
- [ ] Updated `README.md` if needed
- [ ] Updated `.github/copilot-instructions.md` if internal conventions changed
- [ ] Not applicable

## Checklist
- [ ] Code follows existing style (chalk usage, emoji prefixes, exit codes)
- [ ] No accidental large asset additions outside `templates/`
- [ ] Default ports preserved / conflicts handled
- [ ] New service templates added to: choices array, defaultPorts, Dockerfile switch, compose mapping
- [ ] Git history clean (no stray debug commits)
- [ ] Dependency additions are minimal & justified

## Open Questions / Follow-ups
List any TODOs or future enhancements not in this PR.

---
Thanks for contributing! 🎉