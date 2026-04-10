import { logger } from "@aif/shared";
import { findProjectById } from "@aif/data";
import { runApiRuntimeOneShot } from "./runtime.js";

const log = logger("commit-generation");

const PROJECT_SCOPE_APPEND =
  "Project scope rule: work strictly inside the current working directory (project root). " +
  "Do not inspect or modify files in the orchestrator monorepo or in parent/sibling directories " +
  "unless the user explicitly asks for that path. Avoid broad discovery outside the current project root.";

/**
 * Non-interactive commit prompt that mirrors /aif-commit skill logic without
 * requiring user confirmation via AskUserQuestion. Used in fire-and-forget
 * context where no terminal is available (approve_done flow).
 *
 * Follows Conventional Commits spec — same logic as /aif-commit but automated:
 * analyze staged changes, determine type/scope, generate message, commit directly.
 */
const COMMIT_PROMPT =
  "Analyze staged git changes and create a conventional commit automatically without asking for confirmation. " +
  "Steps: " +
  "1. Run `git status` to check for staged files. If nothing is staged, run `git add -A` to stage all changes. " +
  "2. Run `git diff --cached` to analyze the staged diff. " +
  "3. Determine the commit type (feat/fix/docs/refactor/test/chore/build/ci/perf/style) and optional scope from file paths. " +
  "4. Generate a commit message following Conventional Commits spec: `<type>(<scope>): <subject>` — subject under 72 chars, imperative mood, no period. " +
  '5. Execute `git commit -m "<message>"` immediately — do NOT use AskUserQuestion or wait for confirmation. ' +
  "6. Do NOT push. Do NOT add Co-Authored-By or AI attribution lines.";

/**
 * Fire-and-forget: run non-interactive commit via shared runtime in the project root.
 * Logs errors but never throws — caller should not await or depend on success.
 */
export async function runCommitQuery(projectId: string): Promise<void> {
  const project = findProjectById(projectId);
  if (!project) {
    log.error({ projectId }, "Project not found for commit generation");
    return;
  }

  log.info(
    { projectId, projectRoot: project.rootPath },
    "Starting non-interactive commit via runtime adapter",
  );

  try {
    await runApiRuntimeOneShot({
      projectId,
      projectRoot: project.rootPath,
      prompt: COMMIT_PROMPT,
      workflowKind: "commit",
      systemPromptAppend: PROJECT_SCOPE_APPEND,
    });
    log.info({ projectId }, "Commit generation completed successfully");
  } catch (err) {
    log.error({ err, projectId }, "Commit generation runtime error");
  }
}
