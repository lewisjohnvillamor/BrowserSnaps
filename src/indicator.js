/* global chrome, self */

(() => {
  function paint(state) {
    const HOST_ID = "browsersnaps-indicator";
    let host = document.getElementById(HOST_ID);

    if (state.remove) {
      if (host) host.remove();
      return true;
    }

    if (state.visible === false) {
      if (host) host.style.setProperty("visibility", "hidden", "important");
      return true;
    }

    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      const hostStyles = {
        all: "initial",
        position: "fixed",
        top: "auto",
        left: "auto",
        right: "16px",
        bottom: "16px",
        display: "block",
        margin: "0",
        padding: "0",
        border: "0",
        width: "auto",
        height: "auto",
        "max-width": "min(360px, calc(100vw - 32px))",
        opacity: "1",
        transform: "none",
        filter: "none",
        "clip-path": "none",
        "pointer-events": "auto",
        "z-index": "2147483647"
      };
      for (const [property, value] of Object.entries(hostStyles)) {
        host.style.setProperty(property, value, "important");
      }

      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }
        .card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 250px;
          padding: 11px 11px 11px 12px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 12px;
          background: #0f172a;
          color: #e2e8f0;
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.45);
          font: 400 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          text-align: left;
        }
        .mark {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          margin-top: 1px;
          border-radius: 50%;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
        }
        .card[data-phase="running"] .mark {
          border: 2px solid rgba(148, 163, 184, 0.3);
          border-top-color: #60a5fa;
          animation: bs-spin 0.8s linear infinite;
        }
        .card[data-phase="done"] .mark { background: #16a34a; color: #f0fdf4; }
        .card[data-phase="error"] .mark { background: #dc2626; color: #fef2f2; }
        .card[data-phase="cancelled"] .mark { background: #475569; color: #e2e8f0; }
        @keyframes bs-spin { to { transform: rotate(360deg); } }
        .copy { flex: 1 1 auto; min-width: 0; }
        .headline { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .title { font-size: 12px; font-weight: 700; color: #f8fafc; }
        .count { flex: 0 0 auto; font-size: 11px; color: #94a3b8; font-variant-numeric: tabular-nums; }
        .message { display: block; margin-top: 2px; color: #cbd5f5; overflow-wrap: anywhere; }
        .track {
          display: block;
          height: 3px;
          margin-top: 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.25);
          overflow: hidden;
        }
        .bar {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: #60a5fa;
          transition: width 0.25s ease;
        }
        .card[data-phase="done"] .bar { background: #4ade80; }
        .actions { display: flex; gap: 6px; margin-top: 9px; }
        button {
          font: inherit;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 9px;
          border: 1px solid rgba(148, 163, 184, 0.32);
          border-radius: 7px;
          background: transparent;
          color: #cbd5f5;
          cursor: pointer;
        }
        button:hover { background: rgba(148, 163, 184, 0.16); }
        button:disabled { opacity: 0.55; cursor: default; }
        .view { border-color: #2563eb; background: #2563eb; color: #ffffff; }
        .view:hover { background: #1d4ed8; }
        .close {
          flex: 0 0 auto;
          margin: -3px -3px 0 0;
          padding: 2px 5px;
          border: 0;
          font-size: 15px;
          line-height: 1;
          color: #94a3b8;
        }
      `;

      // Built element by element so pages enforcing Trusted Types cannot reject the indicator.
      const build = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
      };

      const card = build("div", "card");
      card.setAttribute("role", "status");
      card.setAttribute("aria-live", "polite");

      const mark = build("span", "mark");
      mark.setAttribute("aria-hidden", "true");

      const headline = build("span", "headline");
      headline.append(build("span", "title", "BrowserSnaps"), build("span", "count"));

      const track = build("span", "track");
      track.append(build("span", "bar"));

      const view = build("button", "view", "View results");
      const cancel = build("button", "cancel", "Cancel");
      view.type = "button";
      cancel.type = "button";
      const actions = build("span", "actions");
      actions.append(view, cancel);

      const copy = build("div", "copy");
      copy.append(headline, build("span", "message"), track, actions);

      const close = build("button", "close", "\u00d7");
      close.type = "button";
      close.setAttribute("aria-label", "Hide BrowserSnaps indicator");

      card.append(mark, copy, close);
      shadow.append(style, card);

      const send = (message) => {
        try {
          chrome.runtime.sendMessage(message);
        } catch (_) {
          // The extension was reloaded while the indicator was on screen.
        }
      };

      view.addEventListener("click", () => {
        send({ type: "OPEN_RESULTS", sessionId: host.__browserSnaps?.sessionId });
        host.remove();
      });
      cancel.addEventListener("click", () => {
        cancel.disabled = true;
        send({ type: "CANCEL_CAPTURE", tabId: host.__browserSnaps?.tabId });
      });
      close.addEventListener("click", () => host.remove());

      document.documentElement.appendChild(host);
    }

    host.__browserSnaps = state;
    host.style.setProperty("visibility", "visible", "important");

    const shadow = host.shadowRoot;
    const phase = state.phase || "running";
    const running = phase === "running";
    const total = state.total || 0;
    const completed = Math.min(state.completed || 0, total);
    const percent = running
      ? (total ? Math.max(4, Math.round((completed / total) * 100)) : 4)
      : 100;

    shadow.querySelector(".card").dataset.phase = phase;
    shadow.querySelector(".mark").textContent = { done: "✓", error: "!", cancelled: "–" }[phase] || "";
    shadow.querySelector(".count").textContent = running && total ? `${completed}/${total}` : "";
    shadow.querySelector(".message").textContent = state.message || "Capturing…";
    shadow.querySelector(".track").hidden = !running && phase !== "done";
    shadow.querySelector(".bar").style.width = `${percent}%`;
    shadow.querySelector(".view").hidden = !state.sessionId;
    shadow.querySelector(".cancel").hidden = !running;
    shadow.querySelector(".actions").hidden = !running && !state.sessionId;

    return true;
  }

  async function render(tabId, state) {
    if (!Number.isInteger(tabId)) return false;
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [state],
        func: paint
      });
      return injection?.result === true;
    } catch (_) {
      // Restricted pages, closed tabs, and revoked host access have no indicator.
      return false;
    }
  }

  self.BrowserSnapsIndicator = {
    hide: (tabId) => render(tabId, { visible: false }),
    remove: (tabId) => render(tabId, { remove: true }),
    show: (tabId, state) => render(tabId, { ...state, tabId, visible: true })
  };
})();
