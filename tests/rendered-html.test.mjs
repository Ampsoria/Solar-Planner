import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("the production worker renders the Thai solar planner without browser or WebGL globals", async (t) => {
  // Import the actual built worker: this catches accidental server-side access to
  // window, localStorage or WebGLRenderer, including through the 3D component.
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  // Exclude RSC payloads so an assertion cannot pass on serialized content that
  // was never rendered into the initial document.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const text = (value) =>
    value
      .replace(/<!--[^]*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

  await t.test(
    "metadata identifies the Thai product and credits Ampsoria",
    () => {
      assert.match(markup, /<html\b[^>]*\blang="th"/i);
      assert.match(markup, /<title>[^<]*Ampsoria[^<]*<\/title>/i);
      assert.match(
        markup,
        /<meta\b(?=[^>]*name="description")(?=[^>]*content="[^"]*[\u0E00-\u0E7F])[^>]*>/i,
      );
      assert.doesNotMatch(
        markup,
        /Starter Project|Your site is taking shape|Building your site/,
      );
      assert.match(markup, /<footer\b[\s\S]*?Ampsoria[\s\S]*?<\/footer>/);
    },
  );

  await t.test("the initial bill is calculated and preserves its cents", () => {
    const bill = markup.match(
      /<div\b[^>]*class="bill-number"[^>]*>([\s\S]*?)<\/div>/,
    );
    assert.ok(bill, "the cost summary must be visible before hydration");
    // The default example uses 555.8 kWh, including 200 kWh for nightly EV
    // charging. Its independently checked Sep 2026 bill is 2,381.3165436 THB.
    assert.equal(text(bill[1]), "฿2,381.32");
    const consumption = markup.match(
      /<div\b[^>]*class="consumption-pill"[^>]*>([\s\S]*?)<\/div>/,
    );
    assert.ok(consumption);
    assert.match(text(consumption[1]), /555\.8\s*kWh/);
    assert.doesNotMatch(markup, /(?:NaN|Infinity)\s*(?:kWh|kWp|kW|%)/);
  });

  await t.test(
    "household controls, EV entry and all 24 chart hours are present",
    () => {
      assert.match(markup, /id="appliances"/);
      assert.match(markup, /id="solar"/);
      assert.match(markup, /role="tabpanel"[^>]*aria-labelledby="devices-tab"/);
      assert.match(markup, /id="ev-tab"[^>]*aria-controls="ev-panel"/);
      assert.match(markup, /aria-label="แก้ไขเวลาของ เครื่องปรับอากาศ"/);
      const hours = [
        ...markup.matchAll(/<button\b[^>]*class="hour-bar\b[^>]*>/g),
      ].map((match) => match[0]);
      assert.equal(hours.length, 24);
      assert.equal(
        hours.filter((hour) => /aria-pressed="true"/.test(hour)).length,
        1,
      );
      assert.ok(
        hours.some(
          (hour) =>
            /aria-label="12:00 ใช้ไฟ /.test(hour) &&
            /aria-pressed="true"/.test(hour),
        ),
      );
      assert.match(markup, /aria-label="แบบจำลองบ้านสามมิติ"/);
      assert.doesNotMatch(markup, /<canvas\b/);
    },
  );

  await t.test(
    "export earnings require opting in and their assumptions remain reviewable",
    () => {
      const exportToggle = markup.match(
        /<input\b(?=[^>]*aria-label="จำลองการขายไฟคืน")[^>]*>/,
      );
      assert.ok(exportToggle);
      assert.doesNotMatch(exportToggle[0], /\bchecked(?:[\s=>])/);
      assert.match(markup, /รายได้ขายไฟหลังปีที่ 10/);
      assert.match(markup, /24\.62 บาท\/เดือน/);
      assert.match(markup, /0\.1623 บาท\/หน่วย/);
      assert.match(markup, /href="https:\/\/erc\.or\.th\/th\/automatic\/"/);
      assert.match(
        markup,
        /href="https:\/\/www\.pea\.co\.th\/news\/corporate-news\/2114"/,
      );
    },
  );
});
