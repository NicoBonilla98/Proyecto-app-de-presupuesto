import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";
import { mergeStateCopies } from "./src/state-sync.js";

const port = Number(process.env.PORT || 4173);
const root = resolve(".");
const dataDir = resolve("data");
const stateFile = join(dataDir, "budget-state.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
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
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Presupuesto Hogar disponible en http://localhost:${port}`);
});

function handleStateApi(request, response) {
  if (request.method === "GET") {
    try {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(readState());
    } catch {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "No se pudo leer el estado guardado" }));
    }
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
        const parsedState = JSON.parse(body);
        const currentState = readParsedState();
        const stateToSave = {
          ...mergeStateCopies(parsedState, currentState),
          serverSavedAt: new Date().toISOString()
        };
        writeState(stateToSave);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        });
        response.end(JSON.stringify(stateToSave));
      } catch {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "No se pudo guardar el estado" }));
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

function readParsedState() {
  try {
    return JSON.parse(readState());
  } catch {
    return {};
  }
}

function writeState(state) {
  mkdirSync(dataDir, { recursive: true });
  const tempFile = join(dataDir, `budget-state.${Date.now()}.tmp`);
  writeFileSync(tempFile, JSON.stringify(state), "utf8");
  renameSync(tempFile, stateFile);
}
