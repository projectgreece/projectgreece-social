const API = "https://api.buffer.com";

function token() {
  if (!process.env.BUFFER_API_KEY) throw new Error("Missing environment variable: BUFFER_API_KEY");
  return process.env.BUFFER_API_KEY;
}

async function gql(query, variables = {}) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    throw new Error(`Buffer API error: ${JSON.stringify(json.errors || json)}`);
  }
  return json.data;
}

export async function getBufferContext() {
  const account = await gql(`query { account { organizations { id name ownerEmail } } }`);
  const orgs = account.account?.organizations || [];
  if (!orgs.length) throw new Error("No Buffer organizations found");

  const all = [];
  for (const org of orgs) {
    const data = await gql(`query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name displayName service isQueuePaused } }`);
    for (const channel of data.channels || []) {
      all.push({ ...channel, organizationId: org.id, organizationName: org.name });
    }
  }

  const wanted = ["facebook", "instagram", "tiktok"];
  const channels = {};
  for (const service of wanted) {
    const candidates = all.filter((c) => String(c.service).toLowerCase() === service);
    const preferred = candidates.find((c) => /project\s*greece|projectgreeceglobal/i.test(`${c.name || ""} ${c.displayName || ""}`)) || candidates[0];
    if (!preferred) throw new Error(`No connected Buffer channel found for ${service}`);
    channels[service] = preferred;
  }
  return { organizations: orgs, channels };
}

export async function getScheduledPosts(organizationId) {
  const data = await gql(`query { posts(input: { organizationId: ${JSON.stringify(organizationId)}, filter: { status: [scheduled] }, sort: [{ field: dueAt, direction: asc }] }) { edges { node { id text dueAt channelId } } pageInfo { hasNextPage endCursor } } }`);
  return (data.posts?.edges || []).map((e) => e.node);
}

export async function createImagePost({ channel, text, dueAt, imageUrl, platform, title }) {
  const metadata = platform === "facebook"
    ? { facebook: { type: "post" } }
    : platform === "instagram"
      ? { instagram: { type: "post", shouldShareToFeed: true, isAiGenerated: true } }
      : { tiktok: { title: title || "Project Greece" } };

  const input = {
    text,
    channelId: channel.id,
    schedulingType: "automatic",
    mode: "customScheduled",
    dueAt: dueAt.toUTC().toISO(),
    aiAssisted: false,
    assets: [{ image: { url: imageUrl } }],
    metadata,
  };

  const data = await gql(`mutation Create($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id text dueAt channelId assets { id mimeType } } } ... on MutationError { message } } }`, { input });
  const result = data.createPost;
  if (!result?.post) throw new Error(`Buffer createPost failed: ${result?.message || JSON.stringify(result)}`);
  return result.post;
}
