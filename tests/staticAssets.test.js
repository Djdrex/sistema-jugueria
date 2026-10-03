const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const path = require("node:path");

test("Express serves the page, responsive CSS, and new module scripts from public", async t => {
  const app = express();
  app.use(express.static(path.join(__dirname, "..", "public")));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const asset of ["/", "/css/styles.css", "/js/gastos.js", "/js/pagosPersonal.js"]) {
    const response = await fetch(`${origin}${asset}`);
    assert.equal(response.status, 200, `${asset} should be served`);
    assert.ok((await response.text()).length > 0, `${asset} should not be empty`);
  }
});
