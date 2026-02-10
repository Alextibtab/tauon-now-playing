import { NowPlayingData } from "./types.ts";
import { generateNowPlayingSvg } from "./svg.ts";

const API_KEY = Deno.env.get("API_KEY");
if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

const KV_KEY = ["now-playing"];

/**
 * Validate Bearer token from Authorization header
 */
function validateAuth(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;
  return parts[1] === API_KEY;
}

/**
 * Store now playing data in KV
 */
async function storeNowPlaying(
  kv: Deno.Kv,
  data: NowPlayingData,
): Promise<void> {
  await kv.set(KV_KEY, data);
}

/**
 * Get now playing data from KV
 */
async function getNowPlaying(kv: Deno.Kv): Promise<NowPlayingData | null> {
  const result = await kv.get<NowPlayingData>(KV_KEY);
  return result.value;
}

/**
 * Handle POST /api/now-playing - receive data from poller
 */
async function handlePostNowPlaying(
  req: Request,
  kv: Deno.Kv,
): Promise<Response> {
  if (!validateAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await req.json() as NowPlayingData;
    await storeNowPlaying(kv, data);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Handle GET /now-playing.svg - serve SVG widget
 */
async function handleGetSvg(kv: Deno.Kv): Promise<Response> {
  const data = await getNowPlaying(kv);
  const svg = generateNowPlayingSvg(data);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "s-maxage=1",
    },
  });
}

/**
 * Handle GET /api/now-playing - JSON API for debugging
 */
async function handleGetNowPlaying(kv: Deno.Kv): Promise<Response> {
  const data = await getNowPlaying(kv);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * Handle GET /preview - HTML preview with lorem ipsum and embedded SVG
 */
async function handleGetPreview(kv: Deno.Kv): Promise<Response> {
  const data = await getNowPlaying(kv);
  const svg = generateNowPlayingSvg(data);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Now Playing Preview</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #0b0c0f;
        color: #e5e7eb;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
      }
      .card {
        background: #0f1115;
        border: 1px solid #1f2430;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
      }
      .widget {
        margin-top: 24px;
        width: 100%;
        display: flex;
        justify-content: center;
      }
      .widget svg {
        display: block;
        width: 480px;
        height: auto;
      }
      p {
        line-height: 1.7;
        color: #cbd5f5;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer sed
          tincidunt lorem. Donec semper, magna in pretium consequat, lorem orci
          pharetra neque, sed feugiat sapien mi sed urna. Mauris lacinia justo
          a mi consequat, a luctus lorem suscipit.
        </p>
        <p>
          Pellentesque habitant morbi tristique senectus et netus et malesuada
          fames ac turpis egestas. Nulla facilisi. Fusce at lectus erat. Sed
          posuere lorem eget nisl interdum, id condimentum felis tincidunt.
        </p>
        <div class="widget">${svg}</div>
      </div>
    </div>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * Main request handler
 */
async function handleRequest(req: Request, kv: Deno.Kv): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let response: Response;

    if (path === "/now-playing.svg" && req.method === "GET") {
      response = await handleGetSvg(kv);
    } else if (path === "/preview" && req.method === "GET") {
      response = await handleGetPreview(kv);
    } else if (path === "/api/now-playing" && req.method === "POST") {
      response = await handlePostNowPlaying(req, kv);
    } else if (path === "/api/now-playing" && req.method === "GET") {
      response = await handleGetNowPlaying(kv);
    } else if (path === "/") {
      response = new Response(
        JSON.stringify({
          endpoints: {
            widget: "/now-playing.svg",
            preview: "/preview",
            update: "POST /api/now-playing",
            debug: "/api/now-playing",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } else {
      response = new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Add CORS headers to all responses
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error("Request error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Initialize and start the server
 */
async function main(): Promise<void> {
  const kv = await Deno.openKv();
  console.log("KV connected");

  const port = parseInt(Deno.env.get("PORT") || "8000");

  Deno.serve({ port }, (req) => handleRequest(req, kv));
  console.log(`Server running on port ${port}`);
}

if (import.meta.main) {
  await main();
}
