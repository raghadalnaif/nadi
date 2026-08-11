// ═══════════════════════════════════════════════════════════
// محوّلات أجهزة الحضور — كل ماركة ببروتوكولها
//
// كل محوّل يوفّر دالة start(onEvent) تستدعي onEvent عند كل
// قراءة من الجهاز بالشكل: { code, at, deviceId }
//
// ملاحظة صريحة: هذه المحوّلات مكتوبة وفق البروتوكولات المنشورة
// لكل ماركة، ولم تُختبر على جهاز فعلي. توقّع تعديلات بسيطة عند
// أول تشغيل حسب موديل جهازك وإصدار برمجيته.
// ═══════════════════════════════════════════════════════════

import net from "node:net";
import crypto from "node:crypto";

// ───────── ZKTeco ─────────
// الأشيع في السوق السعودي. يتحدث بروتوكولاً ثنائياً على المنفذ 4370.
// نستخدم وضع «الاتصال الحي» (Realtime) الذي يدفع كل بصمة فور قراءتها.
export function zkteco({ host, port = 4370, deviceId = "zk-1" }) {
  const CMD = {
    CONNECT: 1000,
    EXIT: 1001,
    ACK_OK: 2000,
    REG_EVENT: 500,
  };

  const checksum = (buf) => {
    let sum = 0;
    for (let i = 0; i < buf.length - 1; i += 2) sum += buf.readUInt16LE(i);
    if (buf.length % 2) sum += buf[buf.length - 1];
    while (sum > 0xffff) sum = (sum & 0xffff) + (sum >> 16);
    return ~sum & 0xffff;
  };

  const packet = (command, sessionId, replyId, data = Buffer.alloc(0)) => {
    const body = Buffer.alloc(8 + data.length);
    body.writeUInt16LE(command, 0);
    body.writeUInt16LE(0, 2);
    body.writeUInt16LE(sessionId, 4);
    body.writeUInt16LE(replyId, 6);
    data.copy(body, 8);
    body.writeUInt16LE(checksum(body), 2);

    // ترويسة TCP الخاصة بـ ZKTeco
    const head = Buffer.alloc(8);
    head.writeUInt32LE(0x5050827d, 0);
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
  };

  return {
    name: "ZKTeco",
    start(onEvent) {
      let sessionId = 0;
      let replyId = 0;

      const socket = net.createConnection({ host, port }, () => {
        console.log(`[ZKTeco] متصل بـ ${host}:${port}`);
        socket.write(packet(CMD.CONNECT, 0, replyId++));
      });

      socket.on("data", (chunk) => {
        if (chunk.length < 16) return;
        const command = chunk.readUInt16LE(8);
        const session = chunk.readUInt16LE(12);

        // أول رد يحمل معرّف الجلسة — نسجّل بعده للأحداث الحية
        if (command === CMD.ACK_OK && sessionId === 0) {
          sessionId = session;
          const flag = Buffer.alloc(4);
          flag.writeUInt32LE(0xffff, 0); // كل الأحداث
          socket.write(packet(CMD.REG_EVENT, sessionId, replyId++, flag));
          console.log("[ZKTeco] الاستماع للأحداث الحية بدأ");
          return;
        }

        // حدث حضور: أول 24 بايت بعد الترويسة تحمل رقم المستخدم
        if (command === 500 || command === 501) {
          const payload = chunk.subarray(16);
          const code = payload.toString("ascii", 0, 24).replace(/\0/g, "").trim();
          if (code) onEvent({ code, at: new Date().toISOString(), deviceId });
        }
      });

      socket.on("error", (e) => console.error("[ZKTeco] خطأ:", e.message));
      socket.on("close", () => {
        console.warn("[ZKTeco] انقطع الاتصال — إعادة المحاولة بعد ٥ ثوانٍ");
        sessionId = 0;
        setTimeout(() => this.start(onEvent), 5000);
      });

      return () => socket.destroy();
    },
  };
}

// ───────── Hikvision ─────────
// يستخدم واجهة ISAPI عبر HTTP مع مصادقة Digest، ويبث الأحداث
// بصيغة multipart مستمرة على المسار /ISAPI/Event/notification/alertStream
export function hikvision({ host, port = 80, username, password, deviceId = "hik-1" }) {
  // مصادقة Digest يدوية — الجهاز لا يقبل Basic افتراضياً
  const digestHeader = (challenge, method, uri) => {
    const parts = Object.fromEntries(
      [...challenge.matchAll(/(\w+)="?([^",]+)"?/g)].map((m) => [m[1], m[2]])
    );
    const nc = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");
    const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
    const ha1 = md5(`${username}:${parts.realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(`${ha1}:${parts.nonce}:${nc}:${cnonce}:${parts.qop}:${ha2}`);
    return `Digest username="${username}", realm="${parts.realm}", nonce="${parts.nonce}", uri="${uri}", qop=${parts.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  };

  return {
    name: "Hikvision",
    async start(onEvent) {
      const uri = "/ISAPI/Event/notification/alertStream";
      const url = `http://${host}:${port}${uri}`;

      const connect = async () => {
        try {
          // الطلب الأول يعيد تحدي المصادقة
          const probe = await fetch(url);
          const challenge = probe.headers.get("www-authenticate") ?? "";

          const res = await fetch(url, {
            headers: challenge ? { Authorization: digestHeader(challenge, "GET", uri) } : {},
          });

          if (!res.ok || !res.body) {
            throw new Error(`استجابة غير متوقعة: ${res.status}`);
          }
          console.log(`[Hikvision] متصل بـ ${host}`);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // كل حدث يأتي كمقطع XML — نلتقط رقم البطاقة أو المستخدم
            const match = buffer.match(/<(?:cardNo|employeeNoString|employeeNo)>([^<]+)</);
            if (match) {
              onEvent({ code: match[1].trim(), at: new Date().toISOString(), deviceId });
              buffer = "";
            }
            if (buffer.length > 65536) buffer = buffer.slice(-8192);
          }
        } catch (e) {
          console.error("[Hikvision] خطأ:", e.message);
        }
        console.warn("[Hikvision] إعادة الاتصال بعد ٥ ثوانٍ");
        setTimeout(connect, 5000);
      };

      connect();
      return () => {};
    },
  };
}

// ───────── Suprema BioStar 2 ─────────
// واجهة REST حديثة. نستعلم عن سجلات الأحداث دورياً لأن البث
// المباشر يتطلب اشتراكاً في خدمة الأحداث.
export function suprema({ host, port = 443, username, password, deviceId = "sup-1" }) {
  const base = `https://${host}:${port}/api`;
  let sessionToken = null;
  let since = new Date().toISOString();

  return {
    name: "Suprema BioStar 2",
    async start(onEvent) {
      const login = async () => {
        const res = await fetch(`${base}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ User: { login_id: username, password } }),
        });
        sessionToken = res.headers.get("bs-session-id");
        if (!sessionToken) throw new Error("فشل تسجيل الدخول للجهاز");
        console.log("[Suprema] تسجيل الدخول نجح");
      };

      const poll = async () => {
        try {
          if (!sessionToken) await login();

          const res = await fetch(`${base}/events/search`, {
            method: "POST",
            headers: { "bs-session-id": sessionToken, "Content-Type": "application/json" },
            body: JSON.stringify({
              Query: { limit: 50, conditions: [{ column: "datetime", operator: 4, values: [since] }] },
            }),
          });

          if (res.status === 401) {
            sessionToken = null;
            return;
          }

          const data = await res.json().catch(() => null);
          for (const ev of data?.EventCollection?.rows ?? []) {
            const code = ev?.user_id?.user_id ?? ev?.user_id;
            if (code) onEvent({ code: String(code), at: ev.datetime, deviceId });
          }
          since = new Date().toISOString();
        } catch (e) {
          console.error("[Suprema] خطأ:", e.message);
          sessionToken = null;
        }
      };

      const timer = setInterval(poll, 5000);
      poll();
      return () => clearInterval(timer);
    },
  };
}

// ───────── قارئ عام ─────────
// لأي جهاز يعمل كلوحة مفاتيح (قارئ باركود USB) أو يرسل عبر webhook.
// يفتح منفذاً محلياً يستقبل الرمز بطلب HTTP بسيط.
export function generic({ port = 9100, deviceId = "generic-1" }) {
  return {
    name: "قارئ عام",
    async start(onEvent) {
      const { createServer } = await import("node:http");
      const server = createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get("code");
        if (code) {
          onEvent({ code, at: new Date().toISOString(), deviceId });
          res.writeHead(200).end("OK");
        } else {
          res.writeHead(400).end("code مطلوب");
        }
      });
      server.listen(port, () => console.log(`[عام] يستمع على المنفذ ${port}`));
      return () => server.close();
    },
  };
}

export const ADAPTERS = { zkteco, hikvision, suprema, generic };
