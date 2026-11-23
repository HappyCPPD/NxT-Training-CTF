(() => {
  const challenges = window.NXT_CHALLENGES;
  const SOLVED_KEY = "nxt2.solved";
  const REPEAT_KEY = "nxt2.repeat";
  const $ = (id) => document.getElementById(id);
  const dialog = $("challenge");
  let current = null;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* progress lasts until the tab closes */ }
  };
  let solved = new Set(read(SOLVED_KEY, []));

  function parseFlag(input) {
    const match = input.match(/^\s*(nxt\s*[{\[(]\s*)?([\s\S]*?)(\s*[}\])])?\s*[!.]*\s*$/i);
    return { inner: match[2].trim().toLowerCase().replace(/ /g, "_"), wrapped: Boolean(match[1] && match[3]) };
  }

  async function sha256(text) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function isCorrect(challenge, input) {
    const { inner, wrapped } = parseFlag(input);
    if (challenge.slug === "repeat") {
      const state = read(REPEAT_KEY, null);
      return Boolean(wrapped && state && inner === state.flag.slice(4, -1).toLowerCase());
    }
    if (challenge.wrapped && !wrapped) return false;
    return challenge.hashes.includes(await sha256(`nxt2:${challenge.slug}:${inner}`));
  }

  function renderBoard() {
    const categories = [...new Set(challenges.map((c) => c.category))];
    $("categories").replaceChildren(...categories.map((category) => {
      const section = document.createElement("section");
      section.className = "category";
      const heading = document.createElement("h2");
      heading.textContent = category;
      const grid = document.createElement("div");
      grid.className = "grid";
      challenges.filter((c) => c.category === category).forEach((c) => {
        const card = document.createElement("button");
        card.className = "card" + (solved.has(c.slug) ? " done" : "");
        card.type = "button";
        const name = document.createElement("b");
        name.textContent = c.name;
        const value = document.createElement("span");
        value.textContent = solved.has(c.slug) ? `${c.value} pts · solved` : `${c.value} pts`;
        card.append(name, value);
        card.addEventListener("click", () => { location.hash = c.slug; });
        grid.append(card);
      });
      section.append(heading, grid);
      return section;
    }));
    $("points").textContent = challenges.filter((c) => solved.has(c.slug)).reduce((sum, c) => sum + c.value, 0);
    $("solved").textContent = `${challenges.filter((c) => solved.has(c.slug)).length}/${challenges.length}`;
  }

  function openChallenge(challenge) {
    current = challenge;
    $("c-meta").textContent = `${challenge.category} · ${challenge.value} pts`;
    $("c-name").textContent = challenge.name;
    $("c-desc").innerHTML = challenge.description;
    $("c-files").replaceChildren(...challenge.files.map((file) => {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.name;
      link.textContent = `Download ${file.name}`;
      return link;
    }));
    $("c-hints").replaceChildren(...challenge.hints.map((hint, i) => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `Hint ${i + 1}`;
      const body = document.createElement("div");
      body.innerHTML = hint;
      details.append(summary, body);
      return details;
    }));
    $("flag").value = "";
    $("result").textContent = solved.has(challenge.slug) ? "Already solved." : "";
    $("result").className = solved.has(challenge.slug) ? "ok" : "";
    $("c-writeup").href = `writeups/${challenge.slug}.html`;
    if (!dialog.open) dialog.showModal();
  }

  function syncToHash() {
    const challenge = challenges.find((c) => c.slug === location.hash.slice(1));
    if (challenge) openChallenge(challenge);
    else if (dialog.open) dialog.close();
  }

  $("flag-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const challenge = current;
    const correct = await isCorrect(challenge, $("flag").value);
    if (correct) {
      solved.add(challenge.slug);
      write(SOLVED_KEY, [...solved]);
      renderBoard();
    }
    $("result").textContent = correct ? "Correct." : challenge.slug === "repeat" && !read(REPEAT_KEY, null)
      ? "Open the challenge first so this browser has a key." : "Not that one.";
    $("result").className = correct ? "ok" : "bad";
  });

  $("close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    current = null;
  });
  $("reset").addEventListener("click", () => {
    if (!confirm("Clear your solved challenges in this browser?")) return;
    solved = new Set();
    write(SOLVED_KEY, []);
    renderBoard();
  });
  addEventListener("hashchange", syncToHash);
  renderBoard();
  syncToHash();
})();
