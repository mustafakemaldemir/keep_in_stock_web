(function () {
  const THEME_KEY = "keepinstock-theme";
  const LANG_KEY = "keepinstock-lang";
  const VALID_LANGS = new Set(["en", "tr"]);
  const SUPPORT_FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbwkfwPm7OAFw8aoDZpHEgEt65o4YoMv7yox6FEQ7YHWmgx9LcDf_eUmpPsczZ1yG-Ay/exec";

  function resolveKey(bundle, key) {
    return key.split(".").reduce(function (value, part) {
      if (!value || !Object.prototype.hasOwnProperty.call(value, part)) {
        return undefined;
      }
      return value[part];
    }, bundle);
  }

  function getInitialLang() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("lang");
    if (VALID_LANGS.has(fromQuery)) {
      return fromQuery;
    }

    const fromStorage = window.localStorage.getItem(LANG_KEY);
    if (VALID_LANGS.has(fromStorage)) {
      return fromStorage;
    }

    return (navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";
  }

  function applyTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = window.localStorage.getItem(THEME_KEY);
    const isDark = theme ? theme === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);

    const icon = document.getElementById("darkIcon");
    if (icon) {
      icon.textContent = isDark ? "light_mode" : "dark_mode";
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    window.localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

    const icon = document.getElementById("darkIcon");
    if (icon) {
      icon.textContent = isDark ? "light_mode" : "dark_mode";
    }
  }

  function setNodeValue(selector, bundle, setter) {
    document.querySelectorAll(selector).forEach(function (node) {
      const key = node.getAttribute(selector.slice(1, -1));
      const value = resolveKey(bundle, key);
      if (typeof value === "string") {
        setter(node, value);
      }
    });
  }

  function updateLanguageLinks(lang) {
    document.querySelectorAll("a[data-preserve-lang]").forEach(function (link) {
      const originalHref = link.dataset.originalHref || link.getAttribute("href");
      if (!originalHref) {
        return;
      }

      if (!link.dataset.originalHref) {
        link.dataset.originalHref = originalHref;
      }

      if (
        originalHref.startsWith("#") ||
        originalHref.startsWith("mailto:") ||
        originalHref.startsWith("tel:") ||
        originalHref.startsWith("http://") ||
        originalHref.startsWith("https://")
      ) {
        return;
      }

      const url = new URL(originalHref, window.location.href);
      if (!url.pathname.endsWith(".html")) {
        return;
      }

      url.searchParams.set("lang", lang);
      const relativeHref = url.pathname.split("/").pop() + url.search + url.hash;
      link.setAttribute("href", relativeHref);
    });
  }

  function syncLangState(lang) {
    window.localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
    document.body.dataset.lang = lang;

    document.querySelectorAll("[data-set-lang]").forEach(function (button) {
      const isActive = button.dataset.setLang === lang;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.history.replaceState({}, "", url.toString());
    updateLanguageLinks(lang);
  }

  function applyTranslations(lang) {
    const bundle = window.pageTranslations && window.pageTranslations[lang];
    if (!bundle) {
      return;
    }

    setNodeValue("[data-i18n]", bundle, function (node, value) {
      node.textContent = value;
    });

    setNodeValue("[data-i18n-html]", bundle, function (node, value) {
      node.innerHTML = value;
    });

    setNodeValue("[data-i18n-placeholder]", bundle, function (node, value) {
      node.setAttribute("placeholder", value);
    });

    setNodeValue("[data-i18n-alt]", bundle, function (node, value) {
      node.setAttribute("alt", value);
    });

    setNodeValue("[data-i18n-src]", bundle, function (node, value) {
      node.setAttribute("src", value);
    });

    setNodeValue("[data-i18n-href]", bundle, function (node, value) {
      node.setAttribute("href", value);
    });

    if (bundle.meta && bundle.meta.title) {
      document.title = bundle.meta.title;
    }

    if (bundle.meta && bundle.meta.description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", bundle.meta.description);
      }
    }
  }

  function setLanguage(lang) {
    applyTranslations(lang);
    syncLangState(lang);
  }

  function setupMobileMenu() {
    const button = document.querySelector("[data-menu-toggle]");
    const menu = document.querySelector("[data-mobile-menu]");

    if (!button || !menu) {
      return;
    }

    button.addEventListener("click", function () {
      menu.classList.toggle("hidden");
    });

    document.querySelectorAll("[data-mobile-menu] a").forEach(function (link) {
      link.addEventListener("click", function () {
        menu.classList.add("hidden");
      });
    });
  }

  function setupFaq() {
    document.querySelectorAll(".faq-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const content = button.nextElementSibling;
        const icon = button.querySelector(".faq-icon");
        const isOpen = content && !content.classList.contains("hidden");

        document.querySelectorAll(".faq-content").forEach(function (item) {
          item.classList.add("hidden");
        });

        document.querySelectorAll(".faq-icon").forEach(function (item) {
          item.style.transform = "";
        });

        if (!isOpen && content) {
          content.classList.remove("hidden");
          if (icon) {
            icon.style.transform = "rotate(180deg)";
          }
        }
      });
    });
  }

  function getActiveBundle() {
    const lang = document.documentElement.getAttribute("lang") || getInitialLang();
    return (window.pageTranslations && window.pageTranslations[lang]) || null;
  }

  function setupSupportForm() {
    const form = document.querySelector("[data-support-form]");
    if (!form) {
      return;
    }

    const submitButton = form.querySelector("[data-form-submit]");
    const statusNode = form.querySelector("[data-form-status]");
    const defaultSubmitLabel = submitButton ? submitButton.textContent : "";

    function updateStatus(kind, text) {
      if (!statusNode) {
        return;
      }

      statusNode.textContent = text;
      statusNode.classList.remove("hidden", "status-message--success", "status-message--error", "status-message--pending");
      statusNode.classList.add("status-message", "status-message--" + kind);
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const bundle = getActiveBundle();
      const formCopy = (bundle && bundle.contact && bundle.contact.form) || {};
      const payload = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        subject: form.elements.subject.value.trim(),
        message: form.elements.message.value.trim()
      };

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = formCopy.submitting || defaultSubmitLabel;
      }

      updateStatus("pending", formCopy.submitting || "Sending...");

      try {
        await fetch(SUPPORT_FORM_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        form.reset();
        updateStatus("success", formCopy.success || "Your message was sent.");
      } catch (error) {
        updateStatus("error", formCopy.error || "The form could not be sent right now.");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = defaultSubmitLabel;
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme();
    setupMobileMenu();
    setupFaq();
    setupSupportForm();

    const initialLang = getInitialLang();
    setLanguage(initialLang);

    const toggle = document.getElementById("darkToggle");
    if (toggle) {
      toggle.addEventListener("click", toggleTheme);
    }

    document.querySelectorAll("[data-set-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        setLanguage(button.dataset.setLang);
      });
    });
  });
})();
