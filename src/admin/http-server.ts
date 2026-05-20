import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join, normalize } from "node:path";
import { type AdminHttpApi, type AdminHttpRequest } from "./http-api.js";

export interface InjectRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface InjectResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface ServerAdapter {
  inject(request: InjectRequest): Promise<InjectResponse>;
  listen(port: number, hostname?: string): Promise<Server>;
}

export function createServerAdapter(api: AdminHttpApi): ServerAdapter {
  return {
    async inject(request) {
      const staticResponse = await tryStaticAdminAsset(request.path);
      if (staticResponse) {
        return staticResponse;
      }

      const response = await api.handle({
        method: request.method,
        path: request.path,
        body: request.body
      });

      return {
        status: response.status,
        headers: { "content-type": "application/json" },
        body: response.body
      };
    },

    async listen(port, hostname = "127.0.0.1") {
      const server = createServer((req, res) => {
        void handleNodeRequest(api, req, res);
      });

      await new Promise<void>((resolve) => server.listen(port, hostname, resolve));
      return server;
    }
  };
}

async function handleNodeRequest(
  api: AdminHttpApi,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const request = await toAdminRequest(req);
  const staticResponse = await tryStaticAdminAsset(request.path);
  if (staticResponse) {
    const body = typeof staticResponse.body === "string"
      ? staticResponse.body
      : stringifyJson(staticResponse.body);
    res.writeHead(staticResponse.status, {
      ...staticResponse.headers,
      "content-length": Buffer.byteLength(body)
    });
    res.end(body);
    return;
  }

  const response = await api.handle(request);
  const body = stringifyJson(response.body);

  res.writeHead(response.status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function toAdminRequest(req: IncomingMessage): Promise<AdminHttpRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return {
    method: req.method ?? "GET",
    path: req.url ?? "/",
    body: rawBody.length > 0 ? JSON.parse(rawBody) : undefined
  };
}

async function tryStaticAdminAsset(path: string): Promise<InjectResponse | undefined> {
  if (!path.startsWith("/admin")) {
    return undefined;
  }

  const relativePath = path === "/admin" || path === "/admin/"
    ? "index.html"
    : path.replace(/^\/admin\/?/, "");
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(process.cwd(), "admin-panel", safePath);

  try {
    const body = await readFile(filePath, "utf8");
    return {
      status: 200,
      headers: { "content-type": contentType(filePath) },
      body
    };
  } catch {
    return {
      status: 404,
      headers: { "content-type": "application/json" },
      body: { error: "Not found" }
    };
  }
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry
  );
}
