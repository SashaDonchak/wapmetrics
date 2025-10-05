import { Octokit } from "@octokit/rest";

export async function upsertStickyComment(params: {
  token: string;
  owner: string;
  repo: string;
  pr: number;
  body: string;
  marker?: string;
}) {
  const marker = params.marker ?? "<!-- aiwf-sticky -->";
  const octokit = new Octokit({ auth: params.token });
  const comments = await octokit.issues.listComments({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.pr,
    per_page: 100,
  });
  const prev = comments.data.find((c) => c.body?.includes(marker));
  const body = `${marker}\n${params.body.trim()}`;
  if (prev) {
    await octokit.issues.updateComment({
      owner: params.owner,
      repo: params.repo,
      comment_id: prev.id,
      body,
    });
  } else {
    await octokit.issues.createComment({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.pr,
      body,
    });
  }
}

export async function setCheck(params: {
  token: string;
  owner: string;
  repo: string;
  sha: string;
  title: string;
  summary: string;
  success: boolean;
}) {
  const octokit = new Octokit({ auth: params.token });
  await octokit.checks.create({
    owner: params.owner,
    repo: params.repo,
    name: params.title,
    head_sha: params.sha,
    status: "completed",
    conclusion: params.success ? "success" : "failure",
    output: { title: params.title, summary: params.summary },
  });
}
