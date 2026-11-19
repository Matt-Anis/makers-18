# Issue-driven development

## Hackathon pace

Choose the simplest implementation that reliably delivers the issue’s outcome. Verify the main flow and cover likely failures that could break the demo, lose data, or block a teammate. Defer optional polish, extra abstractions, and unlikely edge cases. Open a follow-up issue if the team needs to revisit a shortcut.

## Issues

Open or pick an issue before starting a feature, fix, or other repository change.

- Use the same format for issue titles and commit messages. Write `type: short summary` or add an optional scope with `type(scope): short summary`.
  - `feat: add a clear button to search`
  - `fix: show results when search is empty`
  - `chore: update dependencies`
  - `docs: add setup instructions`
- Keep the description to a sentence or two about what the change should do. Add a constraint only if it affects the expected outcome.

For the clear button, the issue description could be “Let users clear their search and see all results again with one click.”

## Agent workflow

1. **Propose the issues.** If the user brings a task, check for an existing issue first. Suggest the fewest issues that give each change a clear, reviewable outcome. Keep related work together. Split the work when parts can be delivered independently or the combined change would be hard to review. Give each proposed issue a title and a brief description.
2. **Set up the branch.** Once the scope is agreed, use the existing issue or open a new one when the user has authorized it. Create and check out one branch per issue from the default branch, or switch to the issue’s existing branch. A name like `feat/42-clear-search` makes the issue easy to find.
3. **Propose the plan before editing.** Divide the work into short phases. Give each phase small tasks that each fit in one commit, and say how you’ll verify the result. One phase is enough for a small issue.
4. **Work through the plan.** Verify each task as you finish it. When committing, use Conventional Commits and keep each commit focused on one change. If new work would expand the agreed scope, bring it up as a potential follow-up issue.

For example, `test(search): verify the clear button` describes a commit that adds a check for clearing a search.

### Example plan for issue #42

**Phase 1 — Clear the search**

- [ ] Add a button that clears the search box and restores all results.
- [ ] Add a test that searches for a term, clicks Clear, and checks that all results return.
