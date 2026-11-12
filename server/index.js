import { createServer } from "node:http";
import { Readable } from "node:stream";
import { handleApiRequest } from "./handler.js";

const port = Number(process.env.PORT || 3001);

const server = createServer(async (request, response) => {
  try {
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const apiRequest = new Request(new URL(request.url, `http://127.0.0.1:${port}`), {
      method: request.method,
      headers: request.headers,
      ...(hasBody ? { body: Readable.toWeb(request), duplex: "half" } : {}),
    });
    const result = await handleApiRequest(apiRequest);
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    response.writeHead(500, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "Could not process the recipe request. Please try again." }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pantryplot recipe API: http://127.0.0.1:${port}`);
});
