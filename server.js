import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = "claude-opus-5-5";
const MAX_HISTORY = 30; // messages kept per request
const MAX_MESSAGE_CHARS = 2000;

const restaurantInfo = fs.readFileSync(path.join(here, "restaurant-info.md"), "utf8");

const SYSTEM_PROMPT = `You are the friendly online assistant for Remezzo, a pizza and modern Italian restaurant at 568 North Rd, Ormond VIC 3204, Australia. You chat with guests on the restaurant's website.

Answer questions about Remezzo: the menu, dietary options, bookings, ordering, location, hours, amenities, prices and the dining experience. Use only the facts in the restaurant information below. When a guest asks something those facts don't cover (a dish's price, exact ingredients, allergens, today's specials, opening hours for a particular day, whether a table is free), say you don't have that detail and point them to the phone number (03) 9578 8576 or the online ordering site. Never guess prices, hours, ingredients or availability. For allergies or medical dietary needs, always recommend calling the restaurant to confirm with staff.

You can't make bookings or take orders yourself. To book, guests call (03) 9578 8576; to order takeaway, they use order.platform.hungryhungry.com.

If a question has nothing to do with Remezzo or dining there, politely say you can only help with questions about Remezzo and offer something you can help with.

Keep replies short, warm and conversational: usually two to four sentences, or a brief list when listing dishes. Use Australian English spelling.

<restaurant_information>
${restaurantInfo}
</restaurant_information>`;

const client = new Anthropic();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Accept only well-formed alternating user/assistant text turns that end with the user.
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const messages = raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== "",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) return null;
  }
  return messages;
}

async function handleChat(req, res) {
  let messages;
  try {
    messages = cleanHistory(JSON.parse(await readBody(req)).messages);
  } catch {
    messages = null;
  }
  if (!messages) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid conversation" }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      // If a safety classifier declines, the API retries on a recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    });
    req.on("close", () => stream.abort());

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send("delta", { text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      send("error", {
        message: "Sorry, I can't help with that one. For anything about Remezzo, give us a call on (03) 9578 8576.",
      });
    }
    send("done", {});
  } catch (error) {
    if (error instanceof Anthropic.APIUserAbortError) return;
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic authentication failed - check ANTHROPIC_API_KEY");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("Rate limited by the Anthropic API");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
    } else {
      console.error(error);
    }
    send("error", {
      message: "Sorry, I'm having trouble right now. Please try again, or call us on (03) 9578 8576.",
    });
  }
  res.end();
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const publicDir = path.join(here, "public");
  const filePath = path.join(publicDir, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(publicDir + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") {
      handleChat(req, res);
    } else if (req.method === "GET") {
      serveStatic(req, res);
    } else {
      res.writeHead(405).end();
    }
  })
  .listen(PORT, () => {
    console.log(`Remezzo chatbot running at http://localhost:${PORT}`);
  });
