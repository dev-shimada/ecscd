// GitHub REST API の最小スタブ (依存パッケージなし)。
// ecscd が使う 2 エンドポイントのみ実装する:
//   GET /repos/{owner}/{repo}/commits            -> [{ sha }]
//   GET /repos/{owner}/{repo}/contents/{path}    -> { content: base64(DATA_DIR/{path}) }
// DATA_DIR 配下のファイルを編集するとタスク定義の「Git 側の望ましい状態」を変更できる。
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 8080);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  console.log(`${req.method} ${url.pathname}${url.search}`);

  if (req.method !== "GET") {
    return send(res, 405, { message: "Method Not Allowed" });
  }

  // listCommits: 固定 SHA を 1 件返す (ecscd は先頭コミットの SHA しか見ない)
  if (/^\/repos\/[^/]+\/[^/]+\/commits\/?$/.test(url.pathname)) {
    return send(res, 200, [
      { sha: "stub0000000000000000000000000000000000ca" },
    ]);
  }

  // getContent: DATA_DIR 配下のファイルを base64 で返す
  const contents = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/);
  if (contents) {
    const rel = decodeURIComponent(contents[1]);
    const resolved = path.resolve(dataDir, rel);
    if (!resolved.startsWith(dataDir + path.sep) && resolved !== dataDir) {
      return send(res, 404, { message: "Not Found" });
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return send(res, 404, { message: "Not Found" });
    }
    const raw = fs.readFileSync(resolved);
    return send(res, 200, {
      type: "file",
      name: path.basename(rel),
      path: rel,
      sha: "stubfile0000000000000000000000000000000",
      size: raw.length,
      encoding: "base64",
      content: raw.toString("base64"),
    });
  }

  send(res, 404, { message: "Not Found" });
});

server.listen(port, () => {
  console.log(`github-stub listening on :${port} (data: ${dataDir})`);
});
