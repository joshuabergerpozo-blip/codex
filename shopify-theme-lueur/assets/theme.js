/* Lueur — interactions du thème. Aucun framework, aucune dépendance. */
(() => {
  document.documentElement.classList.add("js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* En-tête : ombre au défilement */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Menu mobile */
  const mobileNav = document.getElementById("mobile-nav");
  document.querySelectorAll("[data-menu-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = !mobileNav.classList.contains("is-open");
      mobileNav.classList.toggle("is-open", open);
      document.querySelectorAll("[data-menu-toggle]").forEach((b) => b.setAttribute("aria-expanded", String(open)));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) mobileNav.querySelector("a")?.focus();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileNav?.classList.contains("is-open")) document.querySelector("[data-menu-toggle]")?.click();
  });

  /* Apparitions douces */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* Vidéo motion design : lecture quand visible, pause sinon, bouton accessible */
  document.querySelectorAll("[data-motion]").forEach((frame) => {
    const video = frame.querySelector("video");
    const toggle = frame.querySelector(".motion__toggle");
    if (!video) return;
    let userPaused = reduceMotion;
    const sync = () => {
      frame.classList.toggle("is-paused", video.paused);
      toggle?.setAttribute("aria-label", video.paused ? toggle.dataset.labelPlay : toggle.dataset.labelPause);
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    // Son : coupé par défaut (les navigateurs n'autorisent l'autoplay que muet)
    const sound = frame.querySelector(".motion__sound");
    sound?.addEventListener("click", () => {
      video.muted = !video.muted;
      if (!video.muted) {
        video.volume = 0.8;
        if (video.paused) { userPaused = false; video.play().catch(() => {}); }
      }
      sound.setAttribute("aria-pressed", String(!video.muted));
      sound.querySelector(".motion__sound-label").textContent = video.muted ? sound.dataset.labelOn : sound.dataset.labelOff;
    });
    toggle?.addEventListener("click", () => {
      if (video.paused) { userPaused = false; video.play(); } else { userPaused = true; video.pause(); }
    });
    if (reduceMotion) video.removeAttribute("autoplay");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      }, { threshold: 0.35 }).observe(frame);
    }
    sync();
  });
  document.querySelectorAll("[data-scroll-to-video]").forEach((link) => {
    link.addEventListener("click", () => {
      const frame = document.querySelector("[data-motion]");
      const video = frame?.querySelector("video");
      if (!video) return;
      video.currentTime = 0;
      // Clic volontaire : on peut lancer le film avec le son
      if (video.muted) frame.querySelector(".motion__sound")?.click();
      video.play().catch(() => {});
    });
  });

  /* Sélecteur de quantité */
  document.querySelectorAll(".qty").forEach((qty) => {
    const input = qty.querySelector("input");
    qty.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = Number(btn.dataset.step);
        input.value = Math.max(Number(input.min || 1), Number(input.value || 1) + step);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });

  /* Fiche produit : galerie, variantes, ajout au panier */
  document.querySelectorAll("[data-product]").forEach((root) => {
    const main = root.querySelector(".product__main img");
    root.querySelectorAll(".product__thumbs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll(".product__thumbs button").forEach((b) => b.setAttribute("aria-current", "false"));
        btn.setAttribute("aria-current", "true");
        main.style.opacity = 0;
        setTimeout(() => {
          main.src = btn.dataset.src;
          main.srcset = btn.dataset.srcset || "";
          main.alt = btn.querySelector("img").alt;
          main.style.opacity = 1;
        }, 180);
      });
    });

    const dataEl = root.querySelector("[data-variants]");
    const variants = dataEl ? JSON.parse(dataEl.textContent) : [];
    const form = root.querySelector("form[data-product-form]");
    const idInput = form?.querySelector("input[name=id]");
    const submit = form?.querySelector("[type=submit]");
    const priceEl = root.querySelector("[data-price]");
    const compareEl = root.querySelector("[data-compare-price]");
    const formatMoney = (cents) => new Intl.NumberFormat(document.documentElement.lang || "fr", { style: "currency", currency: window.Lueur?.currency || "EUR" }).format(cents / 100);

    root.querySelectorAll(".variant-picker input").forEach((input) => {
      input.addEventListener("change", () => {
        const selected = [...root.querySelectorAll(".variant-picker")].map((fs) => fs.querySelector("input:checked")?.value);
        const variant = variants.find((v) => v.options.every((o, i) => o === selected[i]));
        if (!variant || !idInput) return;
        idInput.value = variant.id;
        if (priceEl) priceEl.textContent = formatMoney(variant.price);
        if (compareEl) {
          compareEl.hidden = !(variant.compare_at_price > variant.price);
          compareEl.textContent = formatMoney(variant.compare_at_price || 0);
        }
        submit.disabled = !variant.available;
        submit.querySelector("span").textContent = variant.available ? submit.dataset.labelAdd : submit.dataset.labelSoldOut;
        const url = new URL(window.location.href);
        url.searchParams.set("variant", variant.id);
        window.history.replaceState({}, "", url);
      });
    });

    form?.addEventListener("submit", async (e) => {
      if (!window.fetch || !idInput?.value) return;
      e.preventDefault();
      submit.disabled = true;
      const label = submit.querySelector("span");
      const initial = label.textContent;
      label.textContent = submit.dataset.labelAdding;
      try {
        const res = await fetch(`${window.Shopify?.routes?.root || "/"}cart/add.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: [{ id: Number(idInput.value), quantity: Number(form.querySelector("[name=quantity]")?.value || 1) }] }),
        });
        if (!res.ok) throw new Error((await res.json()).description);
        window.location.href = `${window.Shopify?.routes?.root || "/"}cart`;
      } catch (err) {
        label.textContent = initial;
        submit.disabled = false;
        const msg = root.querySelector("[data-form-error]");
        if (msg) { msg.hidden = false; msg.textContent = err.message || msg.dataset.fallback; }
      }
    });

    /* Barre d'achat collante (mobile) */
    const sticky = document.querySelector(".sticky-atc");
    if (sticky && submit && "IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        sticky.classList.toggle("is-visible", !entry.isIntersecting && entry.boundingClientRect.top < 0);
      }).observe(submit);
      sticky.querySelector("button")?.addEventListener("click", () => submit.click());
    }
  });

  /* Panier : mise à jour automatique des quantités */
  document.querySelectorAll("form[data-cart-form] .qty input").forEach((input) => {
    input.addEventListener("change", () => input.form.submit());
  });
})();
