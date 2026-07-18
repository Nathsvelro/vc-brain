import { db } from "../db";
import { tavilySearch } from "../tavily";
import { listEvidence, type FounderRow, type OpportunityRow } from "../model";

interface GitHubUser {
  login: string;
  name?: string;
  bio?: string;
  followers?: number;
  public_repos?: number;
  html_url?: string;
}
interface GitHubRepo {
  name: string;
  description?: string;
  stargazers_count?: number;
  language?: string;
  pushed_at?: string;
  html_url?: string;
}

function githubUsername(urls: string[]): string | null {
  for (const u of urls) {
    const m = u.match(/github\.com\/([A-Za-z0-9-]+)\/?$/);
    if (m && !["orgs", "topics", "search", "features"].includes(m[1])) return m[1];
  }
  return null;
}

/**
 * Collect an evidence pool: 3-4 Tavily searches + GitHub REST if a profile
 * surfaces. One pool per opportunity; verification judges all claims against it.
 */
export async function enrich(opp: OpportunityRow, founder: FounderRow): Promise<number> {
  const existing = new Set(listEvidence(opp.id).map((e) => e.source_ref));
  const queries = [
    `"${founder.name}" "${opp.company_name}"`,
    `"${opp.company_name}" funding OR revenue OR traction OR customers`,
    `"${opp.company_name}" competitors alternative`,
    `"${founder.name}" github`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => tavilySearch(q, 4)));
  const insert = db.prepare(
    "INSERT INTO evidence (opportunity_id, founder_id, source_type, source_ref, title, snippet, synthetic) VALUES (?, ?, 'web', ?, ?, ?, 0)",
  );

  let added = 0;
  const seenUrls: string[] = [];
  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    for (const hit of res.value) {
      if (!hit.url || existing.has(hit.url)) continue;
      existing.add(hit.url);
      seenUrls.push(hit.url);
      insert.run(opp.id, founder.id, hit.url, hit.title, hit.content);
      added++;
    }
  }

  // Free, real signal: GitHub REST (unauthenticated) when a profile is visible.
  const links: string[] = JSON.parse(founder.links_json);
  const username = githubUsername([...links, ...seenUrls]);
  if (username) {
    try {
      const ghInsert = db.prepare(
        "INSERT INTO evidence (opportunity_id, founder_id, source_type, source_ref, title, snippet, synthetic) VALUES (?, ?, 'github', ?, ?, ?, 0)",
      );
      const userRes = await fetch(`https://api.github.com/users/${username}`);
      if (userRes.ok) {
        const user = (await userRes.json()) as GitHubUser;
        ghInsert.run(
          opp.id,
          founder.id,
          user.html_url ?? `https://github.com/${username}`,
          `GitHub profile: ${user.login}`,
          `${user.name ?? user.login} — ${user.bio ?? "no bio"} · ${user.followers ?? 0} followers · ${user.public_repos ?? 0} public repos`,
        );
        added++;
      }
      const repoRes = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&per_page=5`);
      if (repoRes.ok) {
        const repos = (await repoRes.json()) as GitHubRepo[];
        for (const r of repos.slice(0, 5)) {
          ghInsert.run(
            opp.id,
            founder.id,
            r.html_url ?? "",
            `GitHub repo: ${r.name}`,
            `${r.description ?? "no description"} · ★${r.stargazers_count ?? 0} · ${r.language ?? "?"} · last push ${r.pushed_at ?? "?"}`,
          );
          added++;
        }
      }
    } catch (err) {
      console.warn("GitHub enrichment skipped:", String(err));
    }
  }

  return added;
}
