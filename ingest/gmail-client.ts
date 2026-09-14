const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageSummary = {
  id: string;
};

export type GmailMessage = {
  id: string;
  from: string;
  bodyText: string;
};

type GmailHeader = { name: string; value: string };

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

type GmailMessageResponse = {
  id: string;
  payload?: {
    headers?: GmailHeader[];
  } & GmailMessagePart;
};

export async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID?.replace(/\s+/g, "");
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.replace(/\s+/g, "");
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.replace(/\s+/g, "");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN が設定されていません。"
    );
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Gmailアクセストークンの取得に失敗しました: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function listMessageIds(accessToken: string, query: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GMAIL_API_BASE}/messages`);
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Gmailメッセージ一覧の取得に失敗しました: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      messages?: GmailMessageSummary[];
      nextPageToken?: string;
    };
    for (const message of data.messages ?? []) {
      ids.push(message.id);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractPlainTextBody(part: GmailMessagePart | undefined): string {
  if (!part) return "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  for (const child of part.parts ?? []) {
    const found = extractPlainTextBody(child);
    if (found) return found;
  }

  // text/plainが見つからない場合は最上位のbodyだけでも試す
  if (part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  return "";
}

export async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${messageId}`);
  url.searchParams.set("format", "full");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Gmailメッセージの取得に失敗しました (${messageId}): ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as GmailMessageResponse;
  const from = findHeader(data.payload?.headers, "From");
  const bodyText = extractPlainTextBody(data.payload);

  return { id: data.id, from, bodyText };
}
