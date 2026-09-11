const WEB_DIR = new URL("./web/", import.meta.url);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

export async function serveWeb(path: string): Promise<Response | null> {
  let name = path === "/" ? "index.html" : path.replace(/^\//, "");
  if (name.startsWith("web/")) name = name.slice(4);
  if (name.includes("..") || name.includes("\\")) return null;
  const ext = name.slice(name.lastIndexOf("."));
  const mime = MIME[ext];
  if (!mime) return null;
  const url = new URL(name, WEB_DIR);
  if (!url.href.startsWith(WEB_DIR.href)) return null;
  try {
    const body = await Deno.readFile(url);
    return new Response(body, {
      headers: {
        "content-type": mime,
        "cache-control": "no-cache",
      },
    });
  } catch {
    return null;
  }
}
