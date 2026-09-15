const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageSummary = {
  id: string;
};

export type EmbeddedEmailAttachment = {
  attachmentId: string;
  filename: string;
};

export type GmailMessage = {
  id: string;
  /** メール自体が持つMessage-IDヘッダー。転送・添付されても値が変わらないため、
   *  直接届いたメールと.eml添付経由のメールを同じ取引として重複排除できる */
  messageId: string;
  from: string;
  bodyText: string;
  /** 転送メールに.emlとして添付された、別のメール本体（message/rfc822パート） */
  embeddedEmailAttachments: EmbeddedEmailAttachment[];
};

type GmailHeader = { name: string; value: string };

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string };
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
  return decodeBase64UrlToBuffer(data).toString("utf-8");
}

function decodeBase64UrlToBuffer(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
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

function findEmbeddedEmailAttachments(part: GmailMessagePart | undefined): EmbeddedEmailAttachment[] {
  if (!part) return [];

  const found: EmbeddedEmailAttachment[] = [];
  if (part.mimeType === "message/rfc822" && part.body?.attachmentId) {
    found.push({ attachmentId: part.body.attachmentId, filename: part.filename ?? "attachment.eml" });
  }
  for (const child of part.parts ?? []) {
    found.push(...findEmbeddedEmailAttachments(child));
  }
  return found;
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
  const embeddedEmailAttachments = findEmbeddedEmailAttachments(data.payload);
  // 大半のメールにMessage-IDヘッダーがあるはずだが、万が一無ければGmailのIDで代用する
  const emailMessageId = findHeader(data.payload?.headers, "Message-ID") || data.id;

  return { id: data.id, messageId: emailMessageId, from, bodyText, embeddedEmailAttachments };
}

/** message/rfc822として添付された、転送メール内の別メールの生データ(.eml形式)を取得する */
export async function getAttachmentRaw(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const url = `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`添付ファイルの取得に失敗しました (${messageId}/${attachmentId}): ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { data?: string };
  if (!data.data) throw new Error(`添付ファイルのデータが空です (${messageId}/${attachmentId})`);

  return decodeBase64UrlToBuffer(data.data);
}
