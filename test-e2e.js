const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ORIGIN = "http://localhost:4000";
// Node's native fetch, unlike a real browser's window.fetch, cannot
// resolve relative URLs against a page's origin - it requires an
// absolute URL. app.js correctly calls fetch("/api/...") the way any
// browser-targeted code should; we just need to teach our test's fetch
// stand-in to do the same resolution a browser would do for free.
function browserLikeFetch(url, opts) {
  const absolute = typeof url === "string" && url.startsWith("/") ? ORIGIN + url : url;
  return fetch(absolute, opts);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
const log = (label, ok, extra) => console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${extra ? " — " + extra : ""}`);

(async () => {
  // Load the page WITHOUT executing its scripts yet, so we can inject
  // fetch first and only then run app.js ourselves - this avoids a race
  // where app.js's boot IIFE calls fetch() before we've attached it.
  const dom = await JSDOM.fromURL(ORIGIN + "/", { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true });
  const { window: win } = dom;
  win.fetch = browserLikeFetch;

  // app.js already executed once during page load (and threw inside
  // its boot IIFE since fetch wasn't resolvable yet) - re-run it now
  // that a working fetch exists, so we get a clean boot sequence.
  const appJsSource = await (await fetch(ORIGIN + "/app.js")).text();
  win.eval(appJsSource);

  const doc = win.document;
  await wait(800); // let the re-run boot IIFE finish (health check + session resume + initial render)

  log("Client loaded and shows login screen", doc.getElementById("auth-root").innerHTML.includes("Sign in"));
  log("Backend kind indicator shows local JSON file", doc.getElementById("backend-kind").textContent.includes("local JSON"));

  // --- login as rajat (PSIPL member) ---
  doc.getElementById("login-id").value = "rajat";
  doc.getElementById("login-pass").value = "rajat";
  doc.getElementById("login-submit").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await wait(300);
  log("Login as rajat succeeds, shows app", doc.getElementById("app-root").style.display === "");

  // --- dashboard shows only PSIPL ---
  await wait(200);
  const wsCards = [...doc.querySelectorAll(".workspace-card h3")].map(h => h.textContent);
  log("Rajat's dashboard shows only PSIPL", JSON.stringify(wsCards) === JSON.stringify(["PSIPL"]), JSON.stringify(wsCards));

  // --- open PSIPL, see Kanban board ---
  doc.querySelector(".workspace-card").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await wait(300);
  const columns = doc.querySelectorAll(".kanban-column");
  log("PSIPL Kanban board renders 4 columns", columns.length === 4, `count=${columns.length}`);
  log("Page title set to PSIPL", doc.getElementById("topbar-title").textContent === "PSIPL");

  // --- font is monospace --- (jsdom's getComputedStyle doesn't always
  // resolve var() in font-family, so check the custom property itself)
  const fontVar = win.getComputedStyle(doc.documentElement).getPropertyValue("--font");
  log("Root --font token is a monospace stack", fontVar.toLowerCase().includes("mono"), fontVar);

  // --- create a new task via modal ---
  const newTaskBtn = doc.getElementById("btn-new-task");
  newTaskBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  await wait(300);
  const nameInput = doc.getElementById("t-name");
  log("New task modal opens with name field", !!nameInput);
  if (nameInput) {
    nameInput.value = "E2E test task";
    const assigneeCb = doc.querySelector('[data-assignee="amit"]');
    if (assigneeCb) { assigneeCb.checked = true; assigneeCb.dispatchEvent(new win.Event("change", { bubbles: true })); }
    doc.getElementById("save-task-btn").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await wait(400);
    const boardHtml = doc.getElementById("page-content").innerHTML;
    log("New task appears on the board after creation", boardHtml.includes("E2E test task"));
  }

  // --- drag the new task to Done ---
  const newCard = [...doc.querySelectorAll(".kanban-card")].find(c => c.textContent.includes("E2E test task"));
  if (newCard) {
    class FakeDataTransfer { constructor() { this.data = {}; } setData(t, v) { this.data[t] = v; } getData(t) { return this.data[t]; } }
    const dt = new FakeDataTransfer();
    const dragStart = new win.Event("dragstart", { bubbles: true }); dragStart.dataTransfer = dt;
    newCard.dispatchEvent(dragStart);
    const doneZone = doc.querySelector('.kanban-column-body[data-dropzone="Done"]');
    const dropEvent = new win.Event("drop", { bubbles: true, cancelable: true }); dropEvent.dataTransfer = dt;
    doneZone.dispatchEvent(dropEvent);
    await wait(400);
    const doneCol = [...doc.querySelectorAll(".kanban-column")].find(c => c.dataset.stage === "Done");
    log("Dragged task moved into Done column via real API call", doneCol.textContent.includes("E2E test task"));
  } else {
    log("Could not find newly created card to drag", false);
  }

  // --- poke amit on WhatsApp ---
  const cardForPoke = [...doc.querySelectorAll(".kanban-card")].find(c => c.textContent.includes("E2E test task"));
  if (cardForPoke) {
    cardForPoke.querySelector('[data-action="menu"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await wait(200);
    const cardAfterMenu = [...doc.querySelectorAll(".kanban-card")].find(c => c.textContent.includes("E2E test task"));
    const pokeBtn = cardAfterMenu.querySelector('[data-action="whatsapp"]');
    pokeBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await wait(300);
    const modalHtml = doc.getElementById("modal-root").innerHTML;
    log("WhatsApp poke modal opens with message preview", modalHtml.includes("wa-preview") && modalHtml.includes("Amit"));
  } else {
    log("Could not find card to test WhatsApp poke", false);
  }

  console.log("\nEnd-to-end client test complete.");
})().catch(e => { console.error("E2E TEST THREW:", e.stack); process.exit(1); });
