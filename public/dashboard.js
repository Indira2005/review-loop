const $ = selector => document.querySelector(selector);
let active = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}
function show(id) {
  ["auth", "app", "create", "detail"].forEach(key => {
    const element = $("#" + key);
    if (element) element.classList.toggle("hidden", key !== id && !(id === "app" && key === "detail"));
  });
}
async function loadBusinesses() {
  const businesses = await api("/api/dashboard/businesses");
  const element = $("#business-list");
  element.innerHTML = businesses.length
    ? businesses.map(business =>
      `<div class="business" data-id="${escapeHtml(business.id)}"><b>${escapeHtml(business.name)}</b><br><span class="muted">/r/${escapeHtml(business.slug)}</span></div>`
    ).join("")
    : '<p class="muted">No businesses yet. Add your first one.</p>';
  element.onclick = event => {
    const row = event.target.closest("[data-id]");
    if (row) openBusiness(row.dataset.id);
  };
}
async function openBusiness(id) {
  active = await api("/api/dashboard/businesses/" + encodeURIComponent(id));
  $("#business-title").textContent = active.name;
  $("#edit-name").value = active.name;
  $("#edit-google").value = active.googleUrl;
  $("#saved").textContent = "";
  $("#edit-business-panel").classList.add("hidden");
  const customerUrl = location.origin + "/r/" + active.slug;
  $("#customer-link").href = customerUrl;
  $("#customer-link").textContent = customerUrl;
  const qr = "/api/dashboard/businesses/" + encodeURIComponent(id) + "/qr";
  $("#qr").src = qr;
  $("#qr-download").href = qr;
  $("#questions").innerHTML = Object.entries(active.questions).map(([key, value]) =>
    `<label>${escapeHtml(key[0].toUpperCase() + key.slice(1))}<textarea data-key="${escapeHtml(key)}">${escapeHtml(value)}</textarea></label>`
  ).join("");
  const stats = await api("/api/dashboard/businesses/" + encodeURIComponent(id) + "/stats");
  $("#metrics").innerHTML = Object.entries(stats.counts).map(([key, value]) =>
    `<div class="metric"><b>${Number(value)}</b><span>${escapeHtml(key.replaceAll("_", " "))}</span></div>`
  ).join("");
  $("#list").classList.add("hidden");
  $("#create").classList.add("hidden");
  $("#detail").classList.remove("hidden");
}
async function signedIn() {
  try {
    await api("/api/auth/me");
    $("#auth").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#logout").classList.remove("hidden");
    await loadBusinesses();
  } catch {
    show("auth");
  }
}
function showAuthError(message) {
  $("#auth-error").textContent = message;
  $("#auth-error").classList.remove("hidden");
}
$("#toggle-password").onclick = () => {
  const password = $("#password");
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  $("#toggle-password").textContent = visible ? "Hide" : "Show";
  $("#toggle-password").setAttribute("aria-label", visible ? "Hide password" : "Show password");
  $("#toggle-password").setAttribute("aria-pressed", String(visible));
};
$("#login").onclick = async () => {
  $("#auth-error").classList.add("hidden");
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: $("#email").value, password: $("#password").value })
    });
    await signedIn();
  } catch (error) { showAuthError(error.message); }
};
$("#register").onclick = async () => {
  $("#auth-error").classList.add("hidden");
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: $("#email").value, password: $("#password").value })
    });
    await signedIn();
  } catch (error) { showAuthError(error.message); }
};
$("#logout").onclick = async () => {
  try { await api("/api/auth/logout", { method: "POST" }); location.reload(); }
  catch (error) { alert(error.message); }
};
$("#new-business").onclick = () => {
  $("#create").classList.remove("hidden");
  $("#list").classList.add("hidden");
};
document.querySelectorAll(".cancel").forEach(element => element.onclick = () => {
  show("app");
  loadBusinesses().catch(error => alert(error.message));
});
$("#save-new").onclick = async () => {
  try {
    const business = await api("/api/dashboard/businesses", {
      method: "POST",
      body: JSON.stringify({ name: $("#new-name").value, googleUrl: $("#new-google").value })
    });
    await openBusiness(business.id);
  } catch (error) { alert(error.message); }
};
$("#edit-business").onclick = () => {
  if (!active) return;
  $("#edit-business-panel").classList.remove("hidden");
  $("#edit-business-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#edit-name").focus({ preventScroll: true });
};
$("#cancel-edit").onclick = () => {
  if (!active) return;
  $("#edit-name").value = active.name;
  $("#edit-google").value = active.googleUrl;
  Object.entries(active.questions).forEach(([key, value]) => {
    const field = document.querySelector(`#questions textarea[data-key="${CSS.escape(key)}"]`);
    if (field) field.value = value;
  });
  $("#saved").textContent = "";
  $("#edit-business-panel").classList.add("hidden");
};
$("#delete-business").onclick = async () => {
  if (!active) return;
  const confirmed = window.confirm(`Delete "${active.name}"? This permanently removes its QR destination, settings, and analytics. This cannot be undone.`);
  if (!confirmed) return;
  try {
    await api("/api/dashboard/businesses/" + encodeURIComponent(active.id), { method: "DELETE" });
    active = null;
    $("#detail").classList.add("hidden");
    $("#list").classList.remove("hidden");
    await loadBusinesses();
  } catch (error) {
    alert(error.message);
  }
};
$("#save-settings").onclick = async () => {
  if (!active) return;
  const questions = Object.fromEntries(
    [...document.querySelectorAll("#questions textarea")].map(element => [element.dataset.key, element.value])
  );
  try {
    active = await api("/api/dashboard/businesses/" + encodeURIComponent(active.id), {
      method: "PUT",
      body: JSON.stringify({ name: $("#edit-name").value, googleUrl: $("#edit-google").value, questions })
    });
    $("#business-title").textContent = active.name;
    $("#edit-name").value = active.name;
    $("#edit-google").value = active.googleUrl;
    $("#saved").textContent = "Changes saved.";
    const customerUrl = location.origin + "/r/" + active.slug;
    $("#customer-link").href = customerUrl;
    $("#customer-link").textContent = customerUrl;
  } catch (error) { $("#saved").textContent = error.message; }
};
$("#back-list").onclick = () => {
  $("#detail").classList.add("hidden");
  $("#list").classList.remove("hidden");
  loadBusinesses().catch(error => alert(error.message));
};
signedIn();
