/* global chrome, self */

(() => {
  // Page globals are only visible from the main world, so they are named up front
  // rather than enumerated. Everything else is readable from the isolated world.
  const PAGE_GLOBALS = [
    "React", "ReactDOM", "__NEXT_DATA__", "next", "__NUXT__", "$nuxt", "Vue", "__VUE__",
    "ng", "angular", "getAllAngularRootElements", "Alpine", "htmx", "Turbo", "Stimulus",
    "__remixContext", "__sveltekit", "__gatsby", "___gatsby", "jQuery", "Backbone",
    "Shopify", "Drupal", "wp", "Squarespace", "webflow", "Wix",
    "dataLayer", "google_tag_manager", "ga", "gtag", "fbq", "_hsq", "analytics",
    "Intercom", "zE", "Tawk_API", "hj", "clarity", "mixpanel", "posthog", "amplitude",
    "Stripe", "paypal", "Sentry", "__SENTRY__", "Cookiebot", "OneTrust", "Klaviyo",
    "bootstrap", "Swiper", "gsap", "THREE", "mapboxgl", "Chart"
  ];

  const SIGNATURES = [
    // Frameworks
    { name: "Next.js", category: "Framework", globals: ["__NEXT_DATA__", "next"], selectors: ["#__next"], urls: [/\/_next\//] },
    { name: "Nuxt", category: "Framework", globals: ["__NUXT__", "$nuxt"], selectors: ["#__nuxt"], urls: [/\/_nuxt\//] },
    { name: "React", category: "Framework", globals: ["React", "ReactDOM"], selectors: ["[data-reactroot]", "[data-reactid]"] },
    { name: "Vue.js", category: "Framework", globals: ["Vue", "__VUE__"], selectors: ["[data-v-app]", "[data-server-rendered]"] },
    { name: "Angular", category: "Framework", globals: ["ng", "getAllAngularRootElements"], selectors: ["[ng-version]", "app-root"] },
    { name: "AngularJS", category: "Framework", globals: ["angular"], selectors: ["[ng-app]", "[ng-controller]"] },
    { name: "Svelte", category: "Framework", globals: ["__sveltekit"], selectors: ["[data-svelte-h]"], urls: [/\/_app\/immutable\//] },
    { name: "Astro", category: "Framework", selectors: ["astro-island", "[astro-icon]"], urls: [/\/_astro\//] },
    { name: "Remix", category: "Framework", globals: ["__remixContext"] },
    { name: "Gatsby", category: "Framework", globals: ["__gatsby", "___gatsby"], selectors: ["#___gatsby"], meta: /gatsby/i },
    { name: "SolidJS", category: "Framework", selectors: ["[data-hk]"] },
    { name: "Alpine.js", category: "Framework", globals: ["Alpine"], selectors: ["[x-data]"] },
    { name: "htmx", category: "Framework", globals: ["htmx"], selectors: ["[hx-get]", "[hx-post]"] },
    { name: "Hotwire Turbo", category: "Framework", globals: ["Turbo", "Stimulus"], selectors: ["turbo-frame"] },
    { name: "Livewire", category: "Framework", selectors: ["[wire\\:id]"] },
    { name: "Ember.js", category: "Framework", selectors: [".ember-application", "#ember-basic-dropdown-wormhole"] },

    // Content management and site builders
    { name: "WordPress", category: "CMS", globals: ["wp"], meta: /^WordPress/i, urls: [/\/wp-content\//, /\/wp-includes\//] },
    { name: "Drupal", category: "CMS", globals: ["Drupal"], meta: /^Drupal/i, urls: [/\/sites\/default\/files\//] },
    { name: "Joomla", category: "CMS", meta: /^Joomla/i, urls: [/\/media\/jui\//] },
    { name: "Ghost", category: "CMS", meta: /^Ghost/i, urls: [/\/ghost\/api\//] },
    { name: "Contentful", category: "CMS", urls: [/images\.ctfassets\.net/, /cdn\.contentful\.com/] },
    { name: "Sanity", category: "CMS", urls: [/cdn\.sanity\.io/] },
    { name: "Squarespace", category: "Site builder", globals: ["Squarespace"], meta: /squarespace/i, urls: [/static1\.squarespace\.com/] },
    { name: "Wix", category: "Site builder", globals: ["Wix"], meta: /^Wix/i, urls: [/static\.parastorage\.com/] },
    { name: "Webflow", category: "Site builder", globals: ["webflow"], meta: /^Webflow/i, selectors: ["[data-wf-page]"] },
    { name: "Framer", category: "Site builder", meta: /^Framer/i, urls: [/framerusercontent\.com/] },
    { name: "Hugo", category: "Static site generator", meta: /^Hugo/i },
    { name: "Jekyll", category: "Static site generator", meta: /^Jekyll/i },
    { name: "Docusaurus", category: "Static site generator", meta: /^Docusaurus/i, selectors: ["#__docusaurus"] },

    // Commerce
    { name: "Shopify", category: "Ecommerce", globals: ["Shopify"], urls: [/cdn\.shopify\.com/], headers: { "x-shopid": /.+/, "powered-by": /shopify/i } },
    { name: "WooCommerce", category: "Ecommerce", urls: [/\/plugins\/woocommerce\//], selectors: [".woocommerce"] },
    { name: "BigCommerce", category: "Ecommerce", urls: [/cdn\d*\.bigcommerce\.com/] },
    { name: "Magento", category: "Ecommerce", urls: [/\/static\/version\d+\/frontend\//], selectors: ["[data-role='main-css-loader']"] },
    { name: "Stripe", category: "Payments", globals: ["Stripe"], urls: [/js\.stripe\.com/] },
    { name: "PayPal", category: "Payments", globals: ["paypal"], urls: [/www\.paypal(objects)?\.com/] },
    { name: "Klaviyo", category: "Marketing", globals: ["Klaviyo"], urls: [/static\.klaviyo\.com/] },

    // Analytics and tags
    { name: "Google Tag Manager", category: "Tag manager", globals: ["dataLayer", "google_tag_manager"], urls: [/googletagmanager\.com\/gtm\.js/] },
    { name: "Google Analytics", category: "Analytics", globals: ["ga", "gtag"], urls: [/google-analytics\.com/, /googletagmanager\.com\/gtag\/js/] },
    { name: "Meta Pixel", category: "Analytics", globals: ["fbq"], urls: [/connect\.facebook\.net/] },
    { name: "HubSpot", category: "Marketing", globals: ["_hsq"], urls: [/js\.hs-scripts\.com/, /js\.hsforms\.net/] },
    { name: "Segment", category: "Analytics", globals: ["analytics"], urls: [/cdn\.segment\.com/] },
    { name: "Hotjar", category: "Analytics", globals: ["hj"], urls: [/static\.hotjar\.com/] },
    { name: "Microsoft Clarity", category: "Analytics", globals: ["clarity"], urls: [/clarity\.ms/] },
    { name: "Mixpanel", category: "Analytics", globals: ["mixpanel"], urls: [/cdn\.mxpnl\.com/] },
    { name: "PostHog", category: "Analytics", globals: ["posthog"], urls: [/posthog\.com\/static/, /i\.posthog\.com/] },
    { name: "Amplitude", category: "Analytics", globals: ["amplitude"], urls: [/cdn\.amplitude\.com/] },
    { name: "Plausible", category: "Analytics", urls: [/plausible\.io\/js/] },
    { name: "Sentry", category: "Monitoring", globals: ["Sentry", "__SENTRY__"], urls: [/browser\.sentry-cdn\.com/] },

    // Support and consent
    { name: "Intercom", category: "Support", globals: ["Intercom"], urls: [/widget\.intercom\.io/] },
    { name: "Zendesk", category: "Support", globals: ["zE"], urls: [/static\.zdassets\.com/] },
    { name: "Tawk.to", category: "Support", globals: ["Tawk_API"], urls: [/embed\.tawk\.to/] },
    { name: "OneTrust", category: "Consent", globals: ["OneTrust"], urls: [/cdn\.cookielaw\.org/] },
    { name: "Cookiebot", category: "Consent", globals: ["Cookiebot"], urls: [/consent\.cookiebot\.com/] },

    // UI and libraries
    { name: "Tailwind CSS", category: "UI", selectors: ["[class*='md:']", "[class*='lg:']", "[class*='hover:']"], urls: [/tailwind/i] },
    { name: "Bootstrap", category: "UI", globals: ["bootstrap"], selectors: ["[data-bs-toggle]", ".container-fluid"], urls: [/bootstrap(\.min)?\.(css|js)/] },
    { name: "Material UI", category: "UI", selectors: ["[class^='Mui']", "[class*=' Mui']"] },
    { name: "jQuery", category: "Library", globals: ["jQuery"], urls: [/jquery[.-][\d.]*(min\.)?js/i] },
    { name: "GSAP", category: "Library", globals: ["gsap"], urls: [/gsap/i] },
    { name: "Swiper", category: "Library", globals: ["Swiper"], selectors: [".swiper-wrapper"] },
    { name: "Three.js", category: "Library", globals: ["THREE"] },
    { name: "Chart.js", category: "Library", globals: ["Chart"], urls: [/chart\.js/i] },
    { name: "Leaflet", category: "Maps", selectors: [".leaflet-container", ".leaflet-tile-pane"] },
    { name: "Mapbox", category: "Maps", globals: ["mapboxgl"], urls: [/api\.mapbox\.com/] },
    { name: "Google Fonts", category: "Fonts", urls: [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/] },

    // Delivery and hosting, mostly from response headers
    { name: "Cloudflare", category: "CDN", headers: { "cf-ray": /.+/, server: /cloudflare/i } },
    { name: "Amazon CloudFront", category: "CDN", headers: { "x-amz-cf-id": /.+/, via: /cloudfront/i } },
    { name: "Fastly", category: "CDN", headers: { "x-served-by": /cache-/i, "x-fastly-request-id": /.+/ } },
    { name: "Akamai", category: "CDN", headers: { "x-akamai-transformed": /.+/, server: /akamai/i } },
    { name: "Vercel", category: "Hosting", headers: { "x-vercel-id": /.+/, server: /vercel/i } },
    { name: "Netlify", category: "Hosting", headers: { server: /netlify/i, "x-nf-request-id": /.+/ } },
    { name: "GitHub Pages", category: "Hosting", headers: { server: /github\.com/i } },
    { name: "Nginx", category: "Server", headers: { server: /nginx/i } },
    { name: "Apache", category: "Server", headers: { server: /apache/i } },
    { name: "Express", category: "Server", headers: { "x-powered-by": /express/i } },
    { name: "PHP", category: "Language", headers: { "x-powered-by": /php\/?([\d.]+)?/i } },
    { name: "ASP.NET", category: "Server", headers: { "x-powered-by": /asp\.net/i, "x-aspnet-version": /.+/ } }
  ];

  // Versions are only claimed where the page states them outright.
  const VERSION_READERS = {
    jQuery: (signals) => signals.versions.jQuery,
    Angular: (signals) => signals.versions.angular,
    "Vue.js": (signals) => signals.versions.vue,
    React: (signals) => signals.versions.react,
    "Next.js": (signals) => signals.versions.next,
    WordPress: (signals) => /^WordPress\s+([\d.]+)/i.exec(signals.generator)?.[1],
    Drupal: (signals) => /^Drupal\s+([\d.]+)/i.exec(signals.generator)?.[1],
    Joomla: (signals) => /^Joomla!?\s*([\d.]+)/i.exec(signals.generator)?.[1],
    Hugo: (signals) => /^Hugo\s+([\d.]+)/i.exec(signals.generator)?.[1],
    PHP: (signals) => /php\/([\d.]+)/i.exec(signals.headers["x-powered-by"] || "")?.[1]
  };

  function collectSignals(globalNames) {
    const urls = [];
    for (const element of document.querySelectorAll("script[src], link[href]")) {
      urls.push(element.src || element.href);
    }

    const present = new Set();
    const versions = {};
    // Only reachable when this runs in the main world; the isolated world sees its own window.
    if (typeof window !== "undefined") {
      for (const name of globalNames) {
        try {
          if (typeof window[name] !== "undefined" && window[name] !== null) present.add(name);
        } catch (_) {
          // Some globals throw on access behind a getter.
        }
      }
      try {
        versions.jQuery = window.jQuery?.fn?.jquery;
        versions.vue = window.Vue?.version;
        versions.react = window.React?.version;
        versions.next = window.next?.version;
      } catch (_) {
        // Version probing is best effort.
      }
    }

    return {
      globals: [...present],
      versions,
      urls: urls.slice(0, 400),
      generator: document.querySelector('meta[name="generator" i]')?.getAttribute("content") || "",
      angularVersion: document.querySelector("[ng-version]")?.getAttribute("ng-version") || ""
    };
  }

  function collectMarkers(selectors) {
    const found = [];
    for (const selector of selectors) {
      try {
        if (document.querySelector(selector)) found.push(selector);
      } catch (_) {
        // An invalid selector simply matches nothing.
      }
    }
    return found;
  }

  // Confidence rises with the number of independent signal kinds that agree.
  function identify(signals) {
    const detected = [];
    const globals = new Set(signals.globals || []);
    const markers = new Set(signals.markers || []);
    const urls = signals.urls || [];
    const headers = signals.headers || {};
    const generator = signals.generator || "";

    for (const signature of SIGNATURES) {
      const evidence = [];

      for (const name of signature.globals || []) {
        if (globals.has(name)) evidence.push(`window.${name}`);
      }
      for (const selector of signature.selectors || []) {
        if (markers.has(selector)) evidence.push(`selector ${selector}`);
      }
      for (const pattern of signature.urls || []) {
        const match = urls.find((url) => pattern.test(url));
        if (match) {
          evidence.push(`resource ${match.slice(0, 120)}`);
          break;
        }
      }
      if (signature.meta && signature.meta.test(generator)) evidence.push(`generator "${generator}"`);
      for (const [header, pattern] of Object.entries(signature.headers || {})) {
        if (headers[header] && pattern.test(headers[header])) evidence.push(`header ${header}: ${headers[header].slice(0, 80)}`);
      }

      if (!evidence.length) continue;
      const version = VERSION_READERS[signature.name]?.({ ...signals, versions: signals.versions || {} })
        || (signature.name === "Angular" ? signals.angularVersion : "")
        || "";

      detected.push({
        name: signature.name,
        category: signature.category,
        version: version || "",
        confidence: evidence.length >= 2 ? "high" : "likely",
        evidence: evidence.slice(0, 4)
      });
    }

    detected.sort((first, second) =>
      first.category.localeCompare(second.category) || first.name.localeCompare(second.name));
    return detected;
  }

  function groupByCategory(detected) {
    const groups = new Map();
    for (const entry of detected) {
      if (!groups.has(entry.category)) groups.set(entry.category, []);
      groups.get(entry.category).push(entry);
    }
    return [...groups.entries()].map(([category, items]) => ({ category, items }));
  }

  async function detect(tabId) {
    const selectors = [...new Set(SIGNATURES.flatMap((signature) => signature.selectors || []))];

    // The main world holds the page's own globals; if the page's CSP blocks that
    // injection, everything except global-name signals still works.
    const [mainWorld] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [PAGE_GLOBALS],
      func: collectSignals
    }).catch(() => [{ result: null }]);

    const [isolated] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [PAGE_GLOBALS],
      func: collectSignals
    });

    const [markers] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [selectors],
      func: collectMarkers
    });

    const base = mainWorld?.result || isolated.result;
    const signals = {
      ...base,
      globals: mainWorld?.result?.globals || [],
      urls: isolated.result.urls,
      markers: markers.result,
      headers: await readHeaders(tabId),
      globalsAvailable: Boolean(mainWorld?.result)
    };

    return { detected: identify(signals), globalsAvailable: signals.globalsAvailable };
  }

  async function readHeaders(tabId) {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          // Same-origin, so the response headers are readable without host permissions.
          const response = await fetch(location.href, { method: "HEAD", credentials: "omit" });
          const headers = {};
          for (const [name, value] of response.headers.entries()) headers[name.toLowerCase()] = value;
          return headers;
        } catch (_) {
          return {};
        }
      }
    }).catch(() => [{ result: {} }]);
    return injection?.result || {};
  }

  self.BrowserSnapsTech = { PAGE_GLOBALS, SIGNATURES, detect, groupByCategory, identify };
})();
