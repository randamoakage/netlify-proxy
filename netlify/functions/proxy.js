
// Netlify Function: simple path-forwarding proxy that strips frame-blocking headers
exports.handler = async function(event, context) {
  // target base site (change if you want this function to proxy a different site)
  const TARGET_BASE = "https://retroachievements.org";

  // event.path will be like "/.netlify/functions/proxy/..." when called from the site
  // remove the function prefix to get the path to forward
  const prefix = "/.netlify/functions/proxy";
  let subpath = event.path.startsWith(prefix) ? event.path.slice(prefix.length) : "/";
  if (!subpath) subpath = "/";

  // Rebuild query string if present
  const qs = event.rawQuery || event.rawQueryString || (event.queryStringParameters && Object.keys(event.queryStringParameters).length ? "?" + new URLSearchParams(event.queryStringParameters).toString() : "");
  const targetUrl = TARGET_BASE.replace(/\/$/, "") + subpath + (qs || "");

  try {
    // Build safe headers
    const incoming = event.headers || {};
    const safeHeaders = {};
    for (const [k, v] of Object.entries(incoming)) {
      const lk = k.toLowerCase();
      if (!["host", "x-forwarded-for", "x-real-ip", "cf-connecting-ip"].includes(lk)) {
        safeHeaders[k] = v;
      }
    }
    // present as a normal browser
    safeHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36";
    safeHeaders["accept"] = incoming["accept"] || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

    const resp = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: safeHeaders,
      // body: functions receive body as a string. For binary handling you'd need base64 decode if necessary.
      body: ["GET","HEAD"].includes(event.httpMethod) ? undefined : event.body
    });

    // Read response bytes
    const ab = await resp.arrayBuffer();
    const body64 = Buffer.from(ab).toString("base64");

    // Copy headers but remove frame-blocking headers
    const outHeaders = {};
    resp.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (!["content-encoding","transfer-encoding","x-frame-options","content-security-policy","content-security-policy-report-only","frame-options"].includes(lk)) {
        outHeaders[k] = v;
      }
    });

    // Ensure content-type present
    outHeaders["content-type"] = resp.headers.get("content-type") || "application/octet-stream";

    return {
      statusCode: resp.status,
      headers: outHeaders,
      body: body64,
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 502,
      headers: { "content-type": "text/plain" },
      body: "Proxy Error: " + err.message
    };
  }
};
