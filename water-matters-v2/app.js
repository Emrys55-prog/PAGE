/* =========================================================
   WATER MATTERS - all the site logic lives in this file.
   There is no server: data is saved in the browser (localStorage).
   ========================================================= */

/* ---------- SETTINGS ---------- */

// People who sign up as water providers must type this code.
// Change it to your own. (Anyone who reads this file can see it.)
const PROVIDER_CODE = "THARAKA-WATER";

// The highest price per litre a provider is allowed to set (KSh)
const MAX_RATE = 1000;

// The names shown on the site for each account type
const ROLE_LABELS = {
  client: "Client",
  provider: "Water provider (admin)",
};

// Sizes shown on a provider's price board
const PRICE_SIZES = [
  { label: "20 L jerrycan", litres: 20 },
  { label: "200 L drum", litres: 200 },
  { label: "3,000 L bowser", litres: 3000 },
];

/* ---------- STORAGE HELPERS ---------- */

function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (error) {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("wm_session"));
  } catch (error) {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem("wm_session", JSON.stringify({ id: user.id, name: user.name }));
}

function clearSession() {
  localStorage.removeItem("wm_session");
}

// The logged-in user, read fresh from the saved accounts every time.
// The role always comes from the account record, never from anything
// else, so it cannot be changed by editing the session.
function currentUser() {
  const session = getSession();
  if (!session) return null;
  return readList("wm_users").find((u) => u.id === session.id) || null;
}

/* ---------- SMALL HELPERS ---------- */

// Stops user-typed text from being treated as HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Scrambles a password so the real one is never stored
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- MONEY ---------- */

function money(amount) {
  return (
    "KSh " +
    Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  );
}

// Price = litres x price per litre, rounded to 2 decimal places
function priceFor(litres, ratePerLitre) {
  return Math.round(litres * ratePerLitre * 100) / 100;
}

/* ---------- MESSAGES ---------- */

function showMessage(text, type) {
  const box = document.getElementById("messages");
  box.innerHTML = "";
  const div = document.createElement("div");
  div.className = "flash " + type;
  div.textContent = text;
  box.appendChild(div);
}

// A message that survives moving to another page
function setFlash(text, type) {
  sessionStorage.setItem("wm_flash", JSON.stringify({ text: text, type: type }));
}

function showFlash() {
  const raw = sessionStorage.getItem("wm_flash");
  if (!raw) return;
  sessionStorage.removeItem("wm_flash");
  const flash = JSON.parse(raw);
  showMessage(flash.text, flash.type);
}

/* ---------- NAVIGATION BAR ---------- */

function renderNav() {
  const session = getSession();
  const nav = document.getElementById("nav");

  const links = session
    ? `<a href="dashboard.html">Dashboard</a>
       <a href="#" id="logout-link">Log out (${escapeHtml(session.name)})</a>`
    : `<a href="login.html">Log in</a>
       <a href="register.html">Sign up</a>`;

  nav.innerHTML = `<div class="wrap nav-inner">
      <a class="brand" href="index.html">Water Matters</a>
      <div class="links">${links}</div>
    </div>`;

  const logout = document.getElementById("logout-link");
  if (logout) {
    logout.addEventListener("click", function (event) {
      event.preventDefault();
      clearSession();
      setFlash("You have been logged out.", "success");
      window.location.href = "index.html";
    });
  }
}

/* ---------- PRICE BOARD (list of providers and their prices) ---------- */

function ratesBoardHtml() {
  const providers = readList("wm_users")
    .filter((u) => u.role === "provider" && u.ratePerLitre > 0)
    .sort((a, b) => a.ratePerLitre - b.ratePerLitre);

  let body;
  if (providers.length === 0) {
    body = `<p>No provider has set a price yet. Providers: sign up, then set your price per litre.</p>`;
  } else {
    const rows = providers
      .map(
        (p) => `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td class="price">${money(p.ratePerLitre)}</td>
          <td class="price">${money(priceFor(20, p.ratePerLitre))}</td>
        </tr>`
      )
      .join("");
    body = `<div class="table-wrap"><table class="board-table">
        <tr><th>Provider</th><th>Per litre</th><th>20 L jerrycan</th></tr>
        ${rows}
      </table></div>`;
  }

  return `<div class="board">
      <h2>Providers and their prices</h2>
      <p>Every provider sets their own price per litre. Cheapest first.</p>
      ${body}
    </div>`;
}

// What common amounts cost at a given price per litre
function ratePreviewHtml(rate) {
  if (!(rate > 0)) {
    return `<div class="board"><p>Type a price per litre to see what common amounts will cost.</p></div>`;
  }
  const rows = PRICE_SIZES.map(
    (s) => `<tr><td>${s.label}</td><td class="price">${money(priceFor(s.litres, rate))}</td></tr>`
  ).join("");
  return `<div class="board"><table class="board-table">${rows}</table></div>`;
}

/* ---------- HOME PAGE ---------- */

function initHome() {
  const box = document.getElementById("home-buttons");
  if (getSession()) {
    box.innerHTML = '<a class="button" href="dashboard.html">Go to dashboard</a>';
  } else {
    box.innerHTML =
      '<a class="button" href="register.html">Create an account</a>' +
      '<a class="button outline" href="login.html">Log in</a>';
  }
  document.getElementById("rates-board").innerHTML = ratesBoardHtml();
}

/* ---------- SIGN UP ---------- */

function initRegister() {
  const form = document.getElementById("register-form");
  const codeBox = document.getElementById("code-box");

  // Only providers need to type the provider code
  form.addEventListener("change", function (event) {
    if (event.target.name === "role") {
      codeBox.classList.toggle("hidden", event.target.value !== "provider");
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(form);

    const name = data.get("name").trim();
    const email = data.get("email").trim().toLowerCase();
    const phone = data.get("phone").trim();
    const role = data.get("role");
    const password = data.get("password");
    const confirm = data.get("confirm");
    const code = data.get("code").trim();

    if (!name || !email || !phone || !password) {
      return showMessage("Please fill in every field.", "error");
    }
    if (role !== "client" && role !== "provider") {
      return showMessage("Please choose an account type.", "error");
    }
    if (role === "provider" && code !== PROVIDER_CODE) {
      return showMessage("That provider code is not correct.", "error");
    }
    if (password.length < 6) {
      return showMessage("Password must be at least 6 characters.", "error");
    }
    if (password !== confirm) {
      return showMessage("Passwords do not match.", "error");
    }

    const users = readList("wm_users");
    if (users.some((u) => u.email === email)) {
      return showMessage("That email is already registered.", "error");
    }

    // The role is saved here, ONCE. Nothing else in this site ever changes it.
    users.push({
      id: newId(),
      name: name,
      email: email,
      phone: phone,
      role: role,
      ratePerLitre: null, // providers set this later on their dashboard
      passwordHash: await hashPassword(password),
    });
    saveList("wm_users", users);

    setFlash("Account created. You can log in now.", "success");
    window.location.href = "login.html";
  });
}

/* ---------- LOG IN ---------- */

function initLogin() {
  const form = document.getElementById("login-form");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(form);
    const email = data.get("email").trim().toLowerCase();
    const passwordHash = await hashPassword(data.get("password"));

    const user = readList("wm_users").find(
      (u) => u.email === email && u.passwordHash === passwordHash
    );

    if (!user) {
      return showMessage("Wrong email or password.", "error");
    }

    setSession(user);
    window.location.href = "dashboard.html";
  });
}

/* ---------- DASHBOARD ---------- */

function initDashboard() {
  if (!currentUser()) {
    clearSession();
    setFlash("Please log in first.", "error");
    window.location.href = "login.html";
    return;
  }

  const main = document.getElementById("dashboard");

  // Draw the dashboard that matches the account's role
  function render() {
    const user = currentUser();
    main.innerHTML = user.role === "client" ? clientHtml(user) : providerHtml(user);
  }

  // One listener handles every button on the dashboard
  main.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const user = currentUser();
    const requests = readList("wm_requests");
    const request = requests.find((r) => r.id === button.dataset.id);
    if (!user || !request) return;

    const action = button.dataset.action;

    if (action === "cancel" && user.role === "client" && request.clientId === user.id && request.status === "open") {
      request.status = "cancelled";
      showMessage("Request cancelled.", "success");
    } else if (action === "accept" && user.role === "provider" && request.status === "open") {
      if (!(user.ratePerLitre > 0)) {
        return showMessage("Set your price per litre first.", "error");
      }
      if (request.maxRate && user.ratePerLitre > request.maxRate) {
        return showMessage("Your price is above this client's limit.", "error");
      }
      request.status = "accepted";
      request.providerId = user.id;
      request.ratePerLitre = user.ratePerLitre;
      request.total = priceFor(request.litres, user.ratePerLitre);
      showMessage("Accepted. Call the client to arrange delivery.", "success");
    } else if (action === "deliver" && request.providerId === user.id && request.status === "accepted") {
      request.status = "delivered";
      showMessage("Marked as delivered.", "success");
    } else if (action === "paid" && request.providerId === user.id && request.status === "delivered") {
      request.status = "paid";
      showMessage("Marked as paid.", "success");
    } else {
      return;
    }

    saveList("wm_requests", requests);
    render();
  });

  // Forms: request water (client) and set price (provider)
  main.addEventListener("submit", function (event) {
    const user = currentUser();
    if (!user) return;

    if (event.target.id === "request-form" && user.role === "client") {
      event.preventDefault();
      const data = new FormData(event.target);
      const location = data.get("location").trim();
      const litres = parseInt(data.get("litres"), 10);
      const maxRateText = data.get("max_rate").trim();
      const maxRate = maxRateText === "" ? null : parseFloat(maxRateText);

      if (!location || !(litres > 0)) {
        return showMessage("Enter a location and litres greater than zero.", "error");
      }
      if (maxRate !== null && !(maxRate > 0)) {
        return showMessage("Your price limit must be greater than zero, or leave it empty.", "error");
      }

      const requests = readList("wm_requests");
      requests.unshift({
        id: newId(),
        clientId: user.id,
        location: location,
        waterType: data.get("water_type"),
        litres: litres,
        maxRate: maxRate,
        note: data.get("note").trim(),
        status: "open",
        providerId: null,
        ratePerLitre: null,
        total: null,
        createdAt: new Date().toISOString(),
      });
      saveList("wm_requests", requests);

      showMessage("Your request was sent to water providers.", "success");
      render();
    }

    if (event.target.id === "rate-form" && user.role === "provider") {
      event.preventDefault();
      const rate = parseFloat(new FormData(event.target).get("rate"));

      if (!(rate > 0) || rate > MAX_RATE) {
        return showMessage("Enter a price per litre between 0.01 and " + MAX_RATE + ".", "error");
      }

      // Only the price changes. The role is never touched.
      const users = readList("wm_users");
      const me = users.find((u) => u.id === user.id);
      me.ratePerLitre = rate;
      saveList("wm_users", users);

      showMessage("Price saved: " + money(rate) + " per litre.", "success");
      render();
    }
  });

  // Live preview while a provider types their price
  main.addEventListener("input", function (event) {
    if (event.target.id === "rate-input") {
      document.getElementById("rate-preview").innerHTML = ratePreviewHtml(parseFloat(event.target.value));
    }
  });

  render();
}

/* ---------- CLIENT DASHBOARD ---------- */

function clientHtml(user) {
  const users = readList("wm_users");
  const mine = readList("wm_requests").filter((r) => r.clientId === user.id);

  const rows = mine
    .map((r) => {
      const provider = users.find((u) => u.id === r.providerId);
      const providerText = provider
        ? `${escapeHtml(provider.name)}<br>${escapeHtml(provider.phone)}`
        : "Waiting for a provider";
      const priceText = r.total
        ? `<strong>${money(r.total)}</strong><br><span class="small-text">${money(r.ratePerLitre)} per litre</span>`
        : r.maxRate
        ? `<span class="small-text">Limit ${money(r.maxRate)} per litre</span>`
        : "Any price";
      const cancel =
        r.status === "open"
          ? `<button class="small danger" data-action="cancel" data-id="${r.id}">Cancel</button>`
          : "";

      return `<tr>
        <td>${escapeHtml(r.location)}<br><span class="small-text">${escapeHtml(r.waterType)}</span></td>
        <td>${r.litres}</td>
        <td>${priceText}</td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td>${providerText}</td>
        <td>${cancel}</td>
      </tr>`;
    })
    .join("");

  const table = mine.length
    ? `<div class="table-wrap"><table class="data">
        <tr><th>Place</th><th>Litres</th><th>Price</th><th>Status</th><th>Provider</th><th></th></tr>
        ${rows}
      </table></div>`
    : "<p>You have no requests yet.</p>";

  return `
    <h1 class="page-title">Your water</h1>
    <p class="who">Signed in as ${escapeHtml(user.name)}, ${ROLE_LABELS[user.role].toLowerCase()}. Your account type cannot be changed.</p>

    <div class="two-col">
      <div>
        <h2>Request water</h2>
        <form id="request-form" class="panel">
          <label for="location">Where should it be delivered? (village, estate, landmark)</label>
          <input type="text" id="location" name="location" required>

          <label for="water_type">Type of water</label>
          <select id="water_type" name="water_type">
            <option value="drinking">Drinking water</option>
            <option value="farm">Farm or irrigation water</option>
            <option value="other">Other</option>
          </select>

          <label for="litres">Litres needed</label>
          <input type="number" id="litres" name="litres" min="1" required>

          <label for="max_rate">Highest price per litre you will pay, in KSh (optional)</label>
          <input type="number" id="max_rate" name="max_rate" min="0.01" step="0.01">

          <label for="note">Extra details (optional)</label>
          <textarea id="note" name="note" rows="2"></textarea>

          <button type="submit">Send request</button>
        </form>
      </div>
      <div>
        ${ratesBoardHtml()}
        <p class="small-text">The provider who accepts your request charges their price per litre.
        You pay them directly when the water arrives, in cash or by M-Pesa. Payments are not made on this site.</p>
      </div>
    </div>

    <h2>Your requests</h2>
    ${table}`;
}

/* ---------- PROVIDER (ADMIN) DASHBOARD ---------- */

function providerHtml(user) {
  const users = readList("wm_users");
  const all = readList("wm_requests");
  const open = all.filter((r) => r.status === "open");
  const jobs = all.filter((r) => r.providerId === user.id);

  const hasRate = user.ratePerLitre > 0;

  const openRows = open
    .map((r) => {
      const client = users.find((u) => u.id === r.clientId);
      let action;
      if (!hasRate) {
        action = '<span class="small-text">Set your price first</span>';
      } else if (r.maxRate && user.ratePerLitre > r.maxRate) {
        action = '<span class="small-text">Above client limit</span>';
      } else {
        action = `<button class="small" data-action="accept" data-id="${r.id}">Accept</button>`;
      }
      return `<tr>
        <td>${escapeHtml(client ? client.name : "Unknown")}</td>
        <td>${escapeHtml(r.location)}<br><span class="small-text">${escapeHtml(r.waterType)}</span></td>
        <td>${r.litres}</td>
        <td>${hasRate ? money(priceFor(r.litres, user.ratePerLitre)) : "-"}</td>
        <td>${r.maxRate ? money(r.maxRate) + " per litre" : "None"}</td>
        <td>${escapeHtml(r.note || "")}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join("");

  const jobRows = jobs
    .map((r) => {
      const client = users.find((u) => u.id === r.clientId);
      let action = "";
      if (r.status === "accepted") {
        action = `<button class="small" data-action="deliver" data-id="${r.id}">Mark delivered</button>`;
      } else if (r.status === "delivered") {
        action = `<button class="small" data-action="paid" data-id="${r.id}">Mark paid</button>`;
      }
      return `<tr>
        <td>${escapeHtml(client ? client.name : "Unknown")}<br>${escapeHtml(client ? client.phone : "")}</td>
        <td>${escapeHtml(r.location)}</td>
        <td>${r.litres}</td>
        <td>${money(r.total || 0)}<br><span class="small-text">${money(r.ratePerLitre || 0)} per litre</span></td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td>${action}</td>
      </tr>`;
    })
    .join("");

  // Money summary
  const owed = jobs.filter((r) => r.status === "delivered").reduce((sum, r) => sum + (r.total || 0), 0);
  const paid = jobs.filter((r) => r.status === "paid").reduce((sum, r) => sum + (r.total || 0), 0);

  const openTable = open.length
    ? `<div class="table-wrap"><table class="data">
        <tr><th>Client</th><th>Place</th><th>Litres</th><th>At your price</th><th>Client's limit</th><th>Note</th><th></th></tr>
        ${openRows}
      </table></div>`
    : "<p>No open requests right now.</p>";

  const jobTable = jobs.length
    ? `<div class="table-wrap"><table class="data">
        <tr><th>Client</th><th>Place</th><th>Litres</th><th>Total</th><th>Status</th><th></th></tr>
        ${jobRows}
      </table></div>`
    : "<p>You have not accepted any requests yet.</p>";

  return `
    <h1 class="page-title">Provider dashboard</h1>
    <p class="who">Signed in as ${escapeHtml(user.name)}, ${ROLE_LABELS[user.role].toLowerCase()}. Your account type cannot be changed.</p>

    <h2>Your price</h2>
    <div class="two-col">
      <form id="rate-form" class="panel">
        <label for="rate-input">Price per litre, in KSh</label>
        <input type="number" id="rate-input" name="rate" min="0.01" max="${MAX_RATE}" step="0.01"
               value="${hasRate ? user.ratePerLitre : ""}" required>
        <p class="small-text">KSh 1 per litre is KSh 20 for a 20-litre jerrycan. A new price applies to
        requests you accept from now on. Requests you already accepted keep their old price.</p>
        <button type="submit">Save price</button>
      </form>
      <div id="rate-preview">${ratePreviewHtml(user.ratePerLitre)}</div>
    </div>

    <h2>Open requests</h2>
    ${openTable}

    <h2>Your jobs</h2>
    <p class="ledger">Delivered, waiting for payment: <strong>${money(owed)}</strong>.
       Paid so far: <strong>${money(paid)}</strong>.</p>
    ${jobTable}`;
}

/* ---------- START WHEN THE PAGE LOADS ---------- */

function startPage() {
  renderNav();
  showFlash();

  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "register") initRegister();
  if (page === "login") initLogin();
  if (page === "dashboard") initDashboard();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPage);
} else {
  startPage();
}
