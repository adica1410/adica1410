
const fs = require("node:fs");

const username = process.env.GITHUB_USERNAME || "adica1410";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("Missing GITHUB_TOKEN");
}

const to = new Date();
const from = new Date(to);
from.setUTCFullYear(from.getUTCFullYear() - 1);

const query = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
        }
      }
    }
  }
`;

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[character]);
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "ada-github-profile-stats",
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function main() {
  // 1. Get public repository count
  const profile = await githubRequest(
    `https://api.github.com/users/${encodeURIComponent(username)}`
  );

  if (profile.login.toLowerCase() !== username.toLowerCase()) {
    throw new Error("GitHub username mismatch");
  }

  const publicRepos = profile.public_repos;

  if (!Number.isInteger(publicRepos)) {
    throw new Error("Invalid public repository count");
  }

  // 2. Get contribution statistics
  const result = await githubRequest(
    "https://api.github.com/graphql",
    {
      method: "POST",
      body: JSON.stringify({
        query,
        variables: {
          login: username,
          from: from.toISOString(),
          to: to.toISOString()
        }
      })
    }
  );

  if (result.errors?.length) {
    throw new Error(JSON.stringify(result.errors));
  }

  const contributions =
    result.data?.user?.contributionsCollection
      ?.contributionCalendar?.totalContributions;

  if (!Number.isInteger(contributions)) {
    throw new Error("Invalid contribution count");
  }

  // 3. Generate SVG card
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="800" height="240"
     viewBox="0 0 800 240">

  <defs>
    <linearGradient id="background"
      x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#1B2A40"/>
    </linearGradient>
  </defs>

  <rect width="800" height="240" rx="18"
        fill="url(#background)"/>

  <text x="40" y="55"
        fill="#F0F6FC"
        font-size="25"
        font-weight="bold"
        font-family="Arial, sans-serif">
    GitHub Activity
  </text>

  <text x="40" y="83"
        fill="#91A6C2"
        font-size="14"
        font-family="Arial, sans-serif">
    ${escapeXml(username)} | Automatically updated
  </text>

  <line x1="400" y1="112" x2="400" y2="200"
        stroke="#334155"/>

  <text x="145" y="157"
        text-anchor="middle"
        fill="#7EE0C4"
        font-size="48"
        font-weight="bold"
        font-family="Arial, sans-serif">
    ${contributions}
  </text>

  <text x="145" y="188"
        text-anchor="middle"
        fill="#CBD5E1"
        font-size="17"
        font-family="Arial, sans-serif">
    Contributions (last 12 months)
  </text>

  <text x="600" y="157"
        text-anchor="middle"
        fill="#93B4FF"
        font-size="48"
        font-weight="bold"
        font-family="Arial, sans-serif">
    ${publicRepos}
  </text>

  <text x="600" y="188"
        text-anchor="middle"
        fill="#CBD5E1"
        font-size="17"
        font-family="Arial, sans-serif">
    Public Repositories
  </text>
</svg>`;

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync(
    "assets/github-stats.svg",
    svg.trim() + "\n"
  );

  console.log(`Public repositories: ${publicRepos}`);
  console.log(`Contributions: ${contributions}`);
  console.log("Generated assets/github-stats.svg");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
