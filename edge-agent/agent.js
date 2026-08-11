#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// الوسيط — يربط أجهزة الحضور في النادي بمنصة URGYM
//
// يعمل داخل شبكة النادي: يقرأ من الجهاز محلياً ويرسل الحضور
// للمنصة عبر الإنترنت. لا يحتاج الجهاز أي اتصال خارجي.
//
//   node agent.js
//
// الإعداد من ملف config.json أو متغيرات البيئة.
// ═══════════════════════════════════════════════════════════

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { ADAPTERS } from "./adapters.js";

const CONFIG_PATH = process.env.AGENT_CONFIG ?? "./config.json";

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  }
  return {
    apiUrl: process.env.API_URL,
    apiKey: process.env.API_KEY,
    devices: [
      {
        adapter: process.env.ADAPTER ?? "generic",
        host: process.env.DEVICE_HOST,
        port: process.env.DEVICE_PORT ? Number(process.env.DEVICE_PORT) : undefined,
        username: process.env.DEVICE_USER,
        password: process.env.DEVICE_PASS,
        source: process.env.SOURCE ?? "fingerprint",
      },
    ],
  };
}

const config = loadConfig();

if (!config.apiUrl || !config.apiKey) {
  console.error("ينقص apiUrl أو apiKey — راجع config.json");
  process.exit(1);
}

// طابور محلي: إن انقطع الإنترنت لا نفقد أي حضور
const queue = [];
let sending = false;

function log(line) {
  const stamp = new Date().toISOString();
  console.log(`${stamp} ${line}`);
  try {
    appendFileSync("./agent.log", `${stamp} ${line}\n`);
  } catch {
    // تعذّر الكتابة — نكتفي بالطباعة
  }
}

async function flush() {
  if (sending || queue.length === 0) return;
  sending = true;

  while (queue.length > 0) {
    const item = queue[0];
    try {
      const res = await fetch(`${config.apiUrl.replace(/\/$/, "")}/api/v1/checkin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: item.code, source: item.source, at: item.at }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        log(`✓ ${item.code} — ${body?.member?.name ?? "تم"} (${item.source})`);
        queue.shift();
      } else if (res.status === 401 || res.status === 403) {
        log(`✗ مفتاح API مرفوض — أوقف الإرسال حتى تصحيح المفتاح`);
        sending = false;
        return;
      } else if (res.status >= 500) {
        // خطأ في الخادم — نعيد المحاولة لاحقاً بلا فقد
        log(`… الخادم غير متاح (${res.status}) — إعادة المحاولة`);
        break;
      } else {
        // رفض منطقي (اشتراك منتهٍ مثلاً) — نسجّله ولا نكرره
        log(`✗ ${item.code} — ${body?.error?.message ?? "مرفوض"}`);
        queue.shift();
      }
    } catch (e) {
      log(`… لا اتصال بالإنترنت (${e.message}) — الحضور محفوظ محلياً`);
      break;
    }
  }

  sending = false;
}

setInterval(flush, 3000);

// تشغيل كل جهاز مُعرَّف
for (const device of config.devices ?? []) {
  const factory = ADAPTERS[device.adapter];
  if (!factory) {
    log(`✗ محوّل غير معروف: ${device.adapter}`);
    continue;
  }

  const adapter = factory(device);
  log(`▶ تشغيل ${adapter.name} (${device.host ?? "محلي"})`);

  adapter.start((event) => {
    queue.push({ ...event, source: device.source ?? "fingerprint" });
    log(`↑ قراءة ${event.code} من ${adapter.name}`);
    flush();
  });
}

log(`الوسيط يعمل — المنصة: ${config.apiUrl}`);

process.on("SIGINT", () => {
  log(`إيقاف — ${queue.length} حدث في الطابور`);
  process.exit(0);
});
