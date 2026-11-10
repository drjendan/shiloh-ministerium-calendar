"use strict";

const fs = require("node:fs");
const path = require("node:path");

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseKey = (process.env.SUPABASE_ANON_KEY || "").trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
  console.error("Missing or invalid SUPABASE_URL. Set it in Netlify environment variables as https://your-project.supabase.co");
  process.exit(1);
}

if (!supabaseKey || /YOUR_|placeholder/i.test(supabaseKey)) {
  console.error("Missing SUPABASE_ANON_KEY. Set it to the Supabase publishable or legacy anon key in Netlify.");
  process.exit(1);
}

if (supabaseKey.startsWith("sb_secret_")) {
  console.error("A Supabase secret key must never be embedded in client-side code. Use the publishable key instead.");
  process.exit(1);
}

// The old JWT service_role key must NEVER be published either.
if (supabaseKey.split(".").length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(supabaseKey.split(".")[1], "base64url").toString());
    if (payload.role !== "anon") {
      console.error("Only an anon JWT (not service_role) is permitted in the browser.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Invalid Supabase legacy anon JWT.");
    process.exit(1);
  }
} else if (!supabaseKey.startsWith("sb_publishable_")) {
  console.error("Expected a Supabase publishable key (sb_publishable_...) or legacy anon JWT.");
  process.exit(1);
}

const outDir = path.join(__dirname, "dist");
fs.mkdirSync(outDir, {recursive:true});
for (const name of ["index.html", "admin.html", "admin.js", "styles.css", "app.js"]) {
  fs.copyFileSync(path.join(__dirname, name), path.join(outDir, name));
}
fs.writeFileSync(path.join(outDir, "config.js"),
  "// Generated during Netlify deployment. Browser-safe Supabase publishable configuration.\n" +
  "window.SHILOH_CONFIG = " + JSON.stringify({
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    supabaseAnonKey: supabaseKey
  }, null, 2) + ";\n"
);
console.log("Shiloh calendar build complete. Supabase browser configuration generated.");
