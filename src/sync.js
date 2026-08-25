/* global chrome, self */

(() => {
  // Never read, broadcast, or apply a value from a field matching any of these.
  const SENSITIVE_AUTOCOMPLETE = /one-time-code|current-password|new-password|cc-number|cc-csc|cc-exp|cc-name/i;
  const SENSITIVE_NAME = /\b(password|passwd|pwd|otp|otc|totp|2fa|mfa|cvv|cvc)\b|one[-_ ]?time|security[-_ ]?code|card[-_ ]?number/i;

  const MATCH_WEIGHTS = { testId: 100, id: 90, name: 80, href: 70, text: 50, partialText: 40, placeholder: 25, type: 10, path: 8 };
  const MIN_PREFIX = 4;
  const MIN_MATCH_SCORE = 40;
  const VISIBLE_BONUS = 25;
  const CANDIDATES = "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [role='tab'], [onclick]";
  const SCROLL_INTERVAL = 120;
  const LOCATION_INTERVAL = 400;

  function isSensitiveField(field) {
    if (!field) return false;
    if (String(field.type || "").toLowerCase() === "password") return true;
    if (SENSITIVE_AUTOCOMPLETE.test(String(field.autocomplete || ""))) return true;
    // Underscores and hyphens are word characters, so user_password would slip past
    // a \b anchor unless the separators are flattened first.
    const labels = [field.name, field.id, field.ariaLabel, field.placeholder]
      .filter(Boolean).join(" ").replace(/[_\-.]+/g, " ");
    return SENSITIVE_NAME.test(labels);
  }

  function roleOf(tag, type, explicit) {
    if (explicit) return explicit;
    if (tag === "a") return "link";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "select") return "select";
    if (tag === "textarea") return "textbox";
    if (tag !== "input") return "generic";
    const kind = String(type || "text").toLowerCase();
    if (kind === "checkbox" || kind === "radio") return kind;
    return ["submit", "button", "image", "reset"].includes(kind) ? "button" : "textbox";
  }

  // Scores one candidate against the descriptor the originating tab sent.
  // Same role is required: a link and a text field are never the same control.
  function score(candidate, target) {
    if (!candidate || !target || candidate.role !== target.role) return 0;
    let total = 0;
    for (const field of ["testId", "id", "name", "href", "placeholder"]) {
      if (target[field] && candidate[field] === target[field]) total += MATCH_WEIGHTS[field];
    }
    if (target.text && candidate.text === target.text) total += MATCH_WEIGHTS.text;
    // A button labelled "Add to cart" on one size and "Add to cart — $40" on another is
    // still the same control, but only trust the prefix once it is long enough to mean something.
    else if (target.text?.length >= MIN_PREFIX && candidate.text && candidate.text.startsWith(target.text)) {
      total += MATCH_WEIGHTS.partialText;
    }
    if (target.type && candidate.type === target.type) total += MATCH_WEIGHTS.type;
    if (target.path && candidate.path === target.path) total += MATCH_WEIGHTS.path;
    return total;
  }

  // A control hidden inside a collapsed menu should lose to a visible twin, but a
  // confident hidden match still beats guessing at a weak visible one.
  function bestMatch(candidates, target, minScore = MIN_MATCH_SCORE) {
    let best = null;
    candidates.forEach((candidate, index) => {
      const raw = score(candidate.descriptor, target);
      if (raw < minScore) return;
      const ranked = raw + (candidate.visible ? VISIBLE_BONUS : 0);
      if (!best || ranked > best.ranked) best = { index, score: raw, ranked, visible: Boolean(candidate.visible) };
    });
    return best;
  }

  function scrollRatio(position, scrollSize, viewportSize) {
    const travel = scrollSize - viewportSize;
    if (travel <= 0) return 0;
    return Math.min(1, Math.max(0, position / travel));
  }

  function scrollTarget(ratio, scrollSize, viewportSize) {
    return Math.round(Math.max(0, scrollSize - viewportSize) * Math.min(1, Math.max(0, ratio)));
  }

  self.BrowserSnapsSync = { bestMatch, isSensitiveField, roleOf, score, scrollRatio, scrollTarget };

  // Everything below only runs inside a real page as a content script.
  if (typeof chrome === "undefined" || !chrome.runtime?.id || typeof document === "undefined") return;

  let session = null;
  let applying = 0;
  let lastLocation = location.href;
  let lastScrollSent = 0;

  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);

  function pathOf(element) {
    const steps = [];
    let node = element;
    while (node && node.nodeType === 1 && node !== document.body && steps.length < 6) {
      const parent = node.parentElement;
      if (!parent) break;
      const siblings = [...parent.children].filter((child) => child.tagName === node.tagName);
      steps.unshift(`${node.tagName.toLowerCase()}:${siblings.indexOf(node)}`);
      node = parent;
    }
    return steps.join(">");
  }

  function accessibleName(element) {
    const explicit = element.getAttribute("aria-label")
      || element.getAttribute("title")
      || element.getAttribute("alt");
    if (explicit) return clean(explicit);
    if (element.tagName === "INPUT" && ["submit", "button", "reset"].includes(element.type)) return clean(element.value);
    return clean(element.textContent);
  }

  function describeElement(element) {
    const tag = element.tagName.toLowerCase();
    const type = tag === "input" ? String(element.type || "text").toLowerCase() : "";
    return {
      tag,
      role: roleOf(tag, type, element.getAttribute("role")),
      id: element.id && !/^[a-z]*[0-9a-f]{8,}$/i.test(element.id) ? element.id : "",
      name: element.getAttribute("name") || "",
      testId: element.dataset?.testid || element.dataset?.test || element.dataset?.qa || element.dataset?.cy || "",
      href: tag === "a" && element.href ? element.href.split("#")[0] : "",
      text: accessibleName(element).toLowerCase(),
      type,
      placeholder: element.getAttribute("placeholder") || "",
      path: pathOf(element)
    };
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) !== 0;
  }

  function resolve(target) {
    const elements = [...document.querySelectorAll(CANDIDATES)].slice(0, 1_500);
    const candidates = elements.map((element) => ({ descriptor: describeElement(element), visible: isVisible(element) }));
    const match = bestMatch(candidates, target);
    return match ? { element: elements[match.index], ...match } : null;
  }

  function send(action) {
    if (!session || applying > 0) return;
    chrome.runtime.sendMessage({ type: "SYNC_ACTION", sessionId: session.id, action }).catch(() => {});
  }

  function withSuppression(work) {
    applying += 1;
    try {
      work();
    } finally {
      setTimeout(() => { applying = Math.max(0, applying - 1); }, 60);
    }
  }

  // Frameworks track their own value state, so the native setter has to be used
  // before the input event or React will overwrite what was typed.
  function setFieldValue(element, value) {
    const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function apply(action) {
    if (action.kind === "navigate") {
      if (location.href.split("#")[0] !== action.url) location.assign(action.url);
      return { applied: true };
    }

    if (action.kind === "scroll") {
      withSuppression(() => window.scrollTo({
        top: scrollTarget(action.ratio, document.documentElement.scrollHeight, window.innerHeight),
        behavior: "auto"
      }));
      return { applied: true };
    }

    const match = resolve(action.target);
    if (!match) return { applied: false, reason: "no matching control on this screen size" };

    withSuppression(() => {
      const element = match.element;
      if (action.kind === "click") {
        element.scrollIntoView({ block: "center", behavior: "auto" });
        element.click();
        return;
      }
      if (action.kind === "input") setFieldValue(element, action.value);
      if (action.kind === "toggle") {
        element.checked = action.checked;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (action.kind === "select") setFieldValue(element, action.value);
    });
    return { applied: true, visible: match.visible };
  }

  function label(profileLabel) {
    const host = document.createElement("div");
    host.id = "browsersnaps-sync-label";
    // Bottom-left keeps the pill off site navigation, which usually sits top-left,
    // and clear of the capture indicator in the opposite corner.
    for (const [property, value] of Object.entries({
      all: "initial", position: "fixed", top: "auto", right: "auto", bottom: "12px", left: "12px",
      "z-index": "2147483646", display: "block"
    })) host.style.setProperty(property, value, "important");

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .pill { display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 10px; border-radius: 99px;
        background: rgba(15, 23, 42, 0.92); color: #e2e8f0; box-shadow: 0 6px 18px rgba(2, 6, 23, 0.4);
        font: 600 11px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
      button { font: inherit; padding: 3px 8px; border: 1px solid rgba(148,163,184,.35); border-radius: 99px;
        background: transparent; color: #cbd5f5; cursor: pointer; }
      button:hover { background: rgba(148,163,184,.16); }
    `;
    const pill = document.createElement("div");
    pill.className = "pill";
    const dot = document.createElement("span");
    dot.className = "dot";
    const name = document.createElement("span");
    name.textContent = `Synced · ${profileLabel}`;
    const stop = document.createElement("button");
    stop.type = "button";
    stop.textContent = "Stop";
    stop.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "STOP_SYNC", sessionId: session?.id }).catch(() => {});
    });
    pill.append(dot, name, stop);
    shadow.append(style, pill);
    document.documentElement.appendChild(host);
  }

  document.addEventListener("click", (event) => {
    if (!session || applying > 0 || !event.isTrusted) return;
    const element = event.target.closest?.(CANDIDATES);
    if (!element) return;
    const descriptor = describeElement(element);
    // A same-origin link is far more reliably synced as a navigation than as a click.
    if (descriptor.href && new URL(descriptor.href).origin === location.origin) {
      send({ kind: "navigate", url: descriptor.href });
      return;
    }
    send({ kind: "click", target: descriptor });
  }, true);

  document.addEventListener("input", (event) => {
    if (!session || applying > 0 || !event.isTrusted) return;
    const element = event.target;
    if (!element.matches?.("input, textarea")) return;
    if (isSensitiveField(element)) {
      send({ kind: "skipped", reason: "sensitive field" });
      return;
    }
    if (element.type === "checkbox" || element.type === "radio") return;
    send({ kind: "input", target: describeElement(element), value: element.value });
  }, true);

  document.addEventListener("change", (event) => {
    if (!session || applying > 0 || !event.isTrusted) return;
    const element = event.target;
    if (element.matches?.("input[type='checkbox'], input[type='radio']")) {
      send({ kind: "toggle", target: describeElement(element), checked: element.checked });
      return;
    }
    if (element.matches?.("select")) send({ kind: "select", target: describeElement(element), value: element.value });
  }, true);

  window.addEventListener("scroll", () => {
    if (!session || applying > 0) return;
    const now = Date.now();
    if (now - lastScrollSent < SCROLL_INTERVAL) return;
    lastScrollSent = now;
    send({ kind: "scroll", ratio: scrollRatio(window.scrollY, document.documentElement.scrollHeight, window.innerHeight) });
  }, { passive: true });

  // Content scripts cannot see the page's own history calls, so the URL is polled.
  setInterval(() => {
    if (!session || applying > 0) return;
    const current = location.href.split("#")[0];
    if (current === lastLocation.split("#")[0]) return;
    lastLocation = location.href;
    send({ kind: "navigate", url: current });
  }, LOCATION_INTERVAL);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SYNC_APPLY") {
      sendResponse(session ? apply(message.action) : { applied: false, reason: "not in a session" });
      return;
    }
    if (message.type === "SYNC_END") {
      session = null;
      document.getElementById("browsersnaps-sync-label")?.remove();
      sendResponse({ ok: true });
    }
  });

  chrome.runtime.sendMessage({ type: "SYNC_HELLO" }).then((reply) => {
    if (!reply?.sessionId) return;
    session = { id: reply.sessionId };
    label(reply.profileLabel || "Synced");
  }).catch(() => {});
})();
