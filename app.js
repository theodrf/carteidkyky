(async () => {
  "use strict";

  // Données de l'identité directement intégrées
  const identity = {
    givenNames: "Kylian",
    surname: "PONS",
    birthDate: "18 avril 2008",
    reference: "843500"
  };
  const fullName = `${identity.givenNames} ${identity.surname}`;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const byId = (id) => document.getElementById(id);
  const cardView = byId("card-view");
  const homeView = byId("home-view");
  const flipper = byId("card-flipper");
  const frontFace = byId("front-face");
  const backFace = byId("back-face");
  const cardStage = byId("card-stage");
  const sheet = byId("sheet-dialog");
  const sheetTitle = byId("sheet-title");
  const sheetContent = byId("sheet-content");
  const toast = byId("toast");

  let currentSide = "front";
  let sheetOpener = null;
  let toastTimer;
  let pointerStart = null;
  let installPrompt = null;

  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  const row = (action, symbol, title, subtitle = "") =>
      `<button class="sheet-row" type="button" data-action="${action}"><span class="sheet-icon">${icon(symbol)}</span><span class="sheet-row-text"><span class="sheet-row-title">${escapeHTML(title)}</span>${subtitle ? `<span class="sheet-row-subtitle">${escapeHTML(subtitle)}</span>` : ""}</span><span class="sheet-chevron">${icon("chevron-right")}</span></button>`;

  const done = (label = "Fermer") => `<button class="sheet-primary" type="button" data-action="close-sheet">${escapeHTML(label)}</button>`;

  function announce(message) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3500);
  }

  function isVisible(element) {
    return element instanceof HTMLElement && element.isConnected && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
  }

  function closeSheet() {
    if (sheet?.open) sheet.close();
  }

  function showSheet(title, content) {
    if (!sheet || !sheetTitle || !sheetContent) return;
    if (!sheet.open) sheetOpener = document.activeElement;
    sheetTitle.textContent = title;
    sheetContent.innerHTML = content;
    sheetTitle.tabIndex = -1;
    if (!sheet.open) sheet.showModal();
    sheet.scrollTop = 0;
    sheetTitle.focus({ preventScroll: true });
  }

  function textSheet(title, symbol, htmlContent) {
    showSheet(title, `<div class="sheet-copy">${symbol ? `<span class="sheet-icon">${icon(symbol)}</span>` : ""}${htmlContent}</div>` + done());
  }

  function simulated(title, copy, symbol = "info") {
    showSheet(title,
        `<div class="sheet-copy"><span class="sheet-icon">${icon(symbol)}</span><h3>Fonctionnalité non configurée</h3><p>${escapeHTML(copy)}</p></div>` + done());
  }

  function showView(name) {
    closeSheet();
    const showCard = name === "card";
    if (cardView) {
      cardView.hidden = !showCard;
      cardView.setAttribute("aria-hidden", String(!showCard));
    }
    if (homeView) {
      homeView.hidden = showCard;
      homeView.setAttribute("aria-hidden", String(showCard));
    }
    document.title = showCard ? "Carte d'identité" : "France Identité";
    const view = showCard ? cardView : homeView;
    const heading = view?.querySelector("h1, h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    view?.scrollTo?.({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function setSide(side, speak = true) {
    currentSide = side === "back" ? "back" : "front";
    const back = currentSide === "back";
    flipper?.classList.toggle("is-flipped", back);
    if (frontFace) {
      frontFace.setAttribute("aria-hidden", String(back));
      frontFace.inert = back;
    }
    if (backFace) {
      backFace.setAttribute("aria-hidden", String(!back));
      backFace.inert = !back;
    }
    if (byId("side-label")) byId("side-label").textContent = back ? "Verso" : "Recto";
    document.querySelectorAll("[data-side]").forEach((button) => {
      const selected = button.dataset.side === currentSide;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll('[data-action="flip"]').forEach((button) => {
      button.setAttribute("aria-label", back ? "Afficher le recto de la carte" : "Afficher le verso de la carte");
    });
    if (speak) announce(`${back ? "Verso" : "Recto"} de la carte`);
  }

  function installationHelp() {
    textSheet("Installer l'application", "download", "<p>Ajoutez cette application sur votre écran d'accueil pour y accéder facilement depuis votre téléphone.</p>");
  }

  async function installDemo() {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      textSheet("Déjà installé", "check", "<p>L'application est déjà installée sur votre appareil.</p>");
      return;
    }
    if (!installPrompt) {
      installationHelp();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        closeSheet();
        announce("Installation en cours...");
      } else {
        installationHelp();
      }
    } catch {
      installationHelp();
    }
  }

  const actions = {
    home: () => showView("home"),
    present: () => showView("card"),
    flip: () => setSide(currentSide === "front" ? "back" : "front"),
    "close-sheet": closeSheet,
    details: () => {
      const fields = [
        ["Nom", identity.surname],
        ["Prénoms", identity.givenNames],
        ["Date de naissance", identity.birthDate],
        ["Numéro du document", identity.reference],
        ["Nature", "Document officiel"]
      ];
      showSheet("Informations",
          `<div class="sheet-copy">${fields.map(([label, value]) => `<p><strong>${escapeHTML(label)}</strong><br>${escapeHTML(value)}</p>`).join("")}</div>` + done());
    },
    actions: () => showSheet("Actions",
        row("proof", "shield", "Partager ses données", "Générer un justificatif") +
        row("certificate", "file", "Attestation", "Générer une attestation") + done()),
    more: () => showSheet("Options",
        row("details", "info", "Informations sur la carte") +
        row("home", "home", "Retour à l'accueil") +
        row("install", "download", "Installer l'application") + done()),
    proof: () => simulated("Justificatif", "La génération de justificatif n'est pas disponible.", "shield"),
    certificate: () => simulated("Attestation", "La génération d'attestation n'est pas disponible.", "file"),
    share: () => simulated("Partager", "Le partage de document n'est pas disponible.", "share"),
    settings: () => showSheet("Paramètres",
        row("details", "user", "Identité", fullName) +
        row("install", "download", "Installer l'application", "Ajouter à l'écran d'accueil") +
        row("about", "info", "À propos", "Version 1.0") + done()),
    about: () => textSheet("À propos", "info", "<p>Application France Identité.</p>"),
    history: () => textSheet("Mes justificatifs", "file", "<p>Aucun justificatif n'a été généré pour le moment.</p>"),
    notifications: () => textSheet("Notifications", "bell", "<p>Vous n'avez aucune notification.</p>"),
    refresh: () => announce("Cartes actualisées avec succès."),
    scan: () => simulated("Scanner", "Le lecteur de QR code n'est pas activé.", "qr"),
    add: () => showSheet("Ajouter un document",
        row("driving", "car", "Permis de conduire", "Importer ce document") +
        row("registration", "file", "Certificat d'immatriculation", "Importer ce document") + done()),
    reorder: () => simulated("Réorganiser", "La réorganisation des cartes n'est pas disponible.", "arrow-up-down"),
    driving: () => simulated("Permis de conduire", "La consultation du permis de conduire n'est pas disponible.", "car"),
    registration: () => simulated("Immatriculation", "La consultation de l'immatriculation n'est pas disponible.", "file"),
    install: installDemo,
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const sideButton = target?.closest("[data-side]");
    if (sideButton) {
      setSide(sideButton.dataset.side);
      return;
    }
    const button = target?.closest("[data-action]");
    if (button && !button.disabled && actions[button.dataset.action]) {
      actions[button.dataset.action]();
    }
  });

  cardStage?.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  window.addEventListener("pointerup", (event) => {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setSide(currentSide === "front" ? "back" : "front");
    }
  });
  window.addEventListener("pointercancel", () => { pointerStart = null; });
  cardStage?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setSide(event.key === "ArrowRight" ? "back" : "front");
    }
  });

  sheet?.addEventListener("click", (event) => {
    if (event.target !== sheet) return;
    const bounds = sheet.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSheet();
  });
  sheet?.addEventListener("close", () => {
    if (isVisible(sheetOpener)) sheetOpener.focus({ preventScroll: true });
    sheetOpener = null;
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    announce("Application installée avec succès.");
  });

  setSide("front", false);
  if ("serviceWorker" in navigator && window.isSecureContext) {
    const registerWorker = () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    };
    if (document.readyState === "complete") registerWorker();
    else window.addEventListener("load", registerWorker, { once: true });
  }
})();