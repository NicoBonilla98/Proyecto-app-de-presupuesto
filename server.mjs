import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 4173);
const root = resolve(".");
const dataDir = resolve("data");
const stateFile = join(dataDir, "budget-state.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function safePath(urlPath) {
  const cleanUrl = decodeURIComponent(urlPath.split("?")[0]);
  const requested = normalize(cleanUrl === "/" ? "/index.html" : cleanUrl);
  const fullPath = resolve(join(root, requested));
  return fullPath.startsWith(root) ? fullPath : null;
}

createServer((request, response) => {
  if (request.url?.startsWith("/api/state")) {
    handleStateApi(request, response);
    return;
  }

  const filePath = safePath(request.url || "/");

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Archivo no encontrado");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Presupuesto Hogar disponible en http://localhost:${port}`);
});

function handleStateApi(request, response) {
  if (request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(readState());
    return;
  }

  if (request.method === "PUT") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        JSON.parse(body);
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(stateFile, body, "utf8");
        response.writeHead(204);
        response.end();
      } catch {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Estado invalido" }));
      }
    });
    return;
  }

  response.writeHead(405, { "Allow": "GET, PUT" });
  response.end();
}

function readState() {
  if (!existsSync(stateFile)) return "{}";
  return readFileSync(stateFile, "utf8");
}
