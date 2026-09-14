/**
 * Gmail refresh token を1回だけローカルで取得するためのスクリプト。
 *
 * 使い方:
 *   1. Google Cloud ConsoleでOAuthクライアント（種類: デスクトップアプリ）を作成し、
 *      クライアントIDとクライアントシークレットを控える。
 *   2. ターミナルで `npm run mint-token` を実行する
 *      （クライアントID・シークレットは実行時に1つずつ貼り付けて入力する。
 *        シェルのクオート内に直接貼り付けると改行が混入して失敗しやすいため、
 *        あえて対話入力にしている）
 *   3. 表示されたURLをブラウザで開き、自分のGoogleアカウントで許可する
 *   4. ターミナルに表示された refresh_token をコピーし、GitHub Actions Secrets の
 *      GMAIL_REFRESH_TOKEN に登録する
 *
 * このスクリプトはCIでは実行しない。refresh_tokenはファイルに保存されず、標準出力に一度表示されるのみ。
 */
import http from "node:http";
import { URL } from "node:url";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const REDIRECT_URI = "http://localhost:3456/oauth2callback";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// コピペ時に紛れ込みがちな改行・前後の空白を除去しておく（クライアントIDが途中で
// 改行されるとGoogle側で「invalid_client」エラーになるため）
function clean(value: string): string {
  return value.replace(/\s+/g, "");
}

async function promptFor(label: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`${label}: `);
  rl.close();
  return clean(answer);
}

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID ? clean(process.env.GMAIL_CLIENT_ID) : await promptFor("クライアントID");
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
    ? clean(process.env.GMAIL_CLIENT_SECRET)
    : await promptFor("クライアントシークレット");

  if (!clientId || !clientSecret) {
    console.error("クライアントIDとクライアントシークレットの両方が必要です。");
    process.exit(1);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  // prompt=consent を付けないと、2回目以降の認可でGoogleがrefresh_tokenを返さないことがある
  authUrl.searchParams.set("prompt", "consent");

  console.log("\n以下のURLをブラウザで開き、Googleアカウントで許可してください:\n");
  console.log(authUrl.toString());
  console.log("\n許可後、自動的にこのターミナルにrefresh_tokenが表示されます...\n");

  const code = await waitForAuthorizationCode();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = (await tokenResponse.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenData.refresh_token) {
    console.error("refresh_tokenの取得に失敗しました:", tokenData.error, tokenData.error_description);
    process.exit(1);
  }

  console.log("取得成功! 以下の値を GitHub Actions Secrets の GMAIL_REFRESH_TOKEN に登録してください:\n");
  console.log(tokenData.refresh_token);
  console.log("");
}

function waitForAuthorizationCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("認可がキャンセルされました。ターミナルを確認してください。");
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("認可が完了しました。このタブは閉じてターミナルに戻ってください。");
        server.close();
        resolve(code);
      }
    });

    server.listen(3456);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
