## What changed

<!-- Short summary of the change -->

## Type of change
- [ ] Fix
- [ ] Update / feature
- [ ] Docs / chore

## QA checklist (reviewer confirms before approving)
- [ ] CI is green (lint, migrations, tests, seed-data smoke check)
- [ ] Ran `docker compose up -d db redis && docker compose run --rm --entrypoint alembic app upgrade head` locally and it applied cleanly
- [ ] Manually exercised the affected CLI command(s) against local Postgres/Redis
- [ ] No `.env`, secrets, or credentials included in the diff
- [ ] Commit messages follow `Fix:` / `Update:` / `Add:` convention

## Linked ticket
<!-- ClickUp ticket link -->
