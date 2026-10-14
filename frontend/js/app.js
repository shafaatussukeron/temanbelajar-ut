/* =========================================================
   TEMANBELAJAR UT
   MULTI-PAGE JAVASCRIPT
========================================================= */

/* =========================================================
   API CONFIGURATION
========================================================= */

const API =
  location.protocol === "file:" ? "http://127.0.0.1:5000/api" : "/api";

let token = localStorage.getItem("tb");
let me = null;

/* =========================================================
   HELPER
========================================================= */

const $ = (id) => document.getElementById(id);

/* =========================================================
   API REQUEST
========================================================= */

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  let response;

  try {
    response = await fetch(API + path, {
      ...options,
      headers,
    });
  } catch (e) {
    throw new Error(
      "Backend belum terhubung. Pastikan python app.py masih berjalan di http://127.0.0.1:5000.",
    );
  }

  let data = {};

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(data.error || `Request gagal (${response.status})`);
  }

  return data;
}

/* =========================================================
   TOAST
========================================================= */

function msg(text, type = "info") {
  const toast = $("toast");

  if (!toast) {
    alert(text);

    return;
  }

  const t = document.createElement("div");

  t.className = "toast " + type;

  t.textContent = text;

  toast.appendChild(t);

  setTimeout(() => {
    t.remove();
  }, 2800);
}

/* =========================================================
   PAGE DETECTION
========================================================= */

function currentPage() {
  let path = window.location.pathname;

  let file = path.split("/").pop();

  if (!file) {
    file = "index.html";
  }

  return file;
}

/* =========================================================
   AUTH PAGE
========================================================= */

function isAuthPage() {
  const page = currentPage();

  return page === "" || page === "index.html";
}

/* =========================================================
   LOGIN / REGISTER TAB
========================================================= */

function tab(register) {
  const login = $("login");

  const reg = $("reg");

  if (!login || !reg) {
    return;
  }

  login.classList.toggle("hide", !!register);

  reg.classList.toggle("hide", !register);

  document.querySelectorAll(".auth-tab").forEach((button, index) => {
    button.classList.toggle("active", index === Number(register));
  });
}

/* =========================================================
   LOGIN
========================================================= */

async function login(e) {
  e.preventDefault();

  const button = e.submitter;

  if (button) {
    button.disabled = true;
    button.textContent = "Memproses...";
  }

  try {
    const data = await api("/login", {
      method: "POST",

      body: JSON.stringify({
        email: $("email").value.trim(),

        password: $("password").value,
      }),
    });

    token = data.token;

    localStorage.setItem("tb", token);

    /*
     * Ambil data user terlebih dahulu.
     * Ini penting untuk mengetahui apakah
     * user adalah mahasiswa atau admin.
     */

    me = (await api("/me")).user;

    /*
     * Setelah login berhasil,
     * masuk ke dashboard.
     */

    window.location.href = "dashboard.html";
  } catch (x) {
    msg(x.message, "error");
  } finally {
    if (button) {
      button.disabled = false;

      button.textContent = "Masuk ke Dashboard";
    }
  }
}

/* =========================================================
   REGISTER
========================================================= */

async function reg(e) {
  e.preventDefault();

  try {
    await api("/register", {
      method: "POST",

      body: JSON.stringify({
        full_name: $("rn").value.trim(),

        email: $("re").value.trim(),

        password: $("rp").value,

        program_study: $("rs").value.trim(),

        semester: $("rsem").value,

        domicile: $("rd").value.trim(),
      }),
    });

    msg("Registrasi berhasil. Silakan masuk.", "success");

    $("email").value = $("re").value.trim();

    $("password").value = "";

    tab(0);
  } catch (x) {
    msg(x.message, "error");
  }
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);

  if (!input) {
    return;
  }

  if (input.type === "password") {
    input.type = "text";
    button.textContent = "🙈";
    button.setAttribute("aria-label", "Sembunyikan password");
  } else {
    input.type = "password";
    button.textContent = "👁️";
    button.setAttribute("aria-label", "Tampilkan password");
  }
}

/* =========================================================
   AUTHENTICATION CHECK
========================================================= */

async function checkAuth() {
  /*
   * Jika belum mempunyai token,
   * halaman aplikasi tidak boleh dibuka.
   */

  if (!token) {
    if (!isAuthPage()) {
      window.location.href = "index.html";
    }

    return false;
  }

  try {
    const data = await api("/me");

    me = data.user;

    /*
     * Jika sedang berada di halaman login
     * tetapi sudah login, arahkan ke dashboard.
     */

    if (isAuthPage()) {
      window.location.href = "dashboard.html";

      return false;
    }

    return true;
  } catch (x) {
    localStorage.removeItem("tb");

    token = null;

    me = null;

    if (!isAuthPage()) {
      window.location.href = "index.html";
    }

    return false;
  }
}

/* =========================================================
   INITIALIZE APPLICATION
========================================================= */

async function init() {
  /*
   * Halaman login/register
   */

  if (isAuthPage()) {
    /*
     * Jika sudah login,
     * langsung ke dashboard.
     */

    if (token) {
      await checkAuth();
    }

    return;
  }

  /*
   * Halaman aplikasi
   */

  const authenticated = await checkAuth();

  if (!authenticated) {
    return;
  }

  /*
   * Isi data user pada header.
   */

  fillUser();

  /*
   * Tampilkan menu admin jika user admin.
   */

  setupAdminMenu();

  setupNotificationSidebar();

  await loadNotificationBadge();

  /*
   * Jalankan fungsi sesuai halaman.
   */

  const page = currentPage();

  if (page === "dashboard.html") {
    await loadDashboard();
  }

  if (page === "cari-teman.html") {
    await loadSearchPage();
  }

  if (page === "koneksi.html") {
    await loadConnectionsPage();
  }

  if (page === "chat.html") {
    await loadChatPage();
  }

  if (page === "notifikasi.html") {
    await loadNotificationsPage();
  }

  if (page === "kelompok.html") {
    await loadGroupPage();
  }

  if (page === "mata-kuliah.html") {
    await loadCoursePage();
  }

  if (page === "profil.html") {
    await loadProfilePage();
  }

  if (page === "admin.html") {
    await loadAdminPage();
  }
}

/* =========================================================
   USER INFORMATION
========================================================= */

function fillUser() {
  if (!me) {
    return;
  }

  const who = $("who");

  if (who) {
    who.textContent = me.full_name || "Mahasiswa";
  }

  const avatar = $("avatar");

  if (avatar) {
    avatar.textContent = getInitial(me.full_name);
  }

  const hello = $("hello");

  if (hello) {
    hello.textContent = (me.full_name || "Mahasiswa").split(" ")[0];
  }
}

/* =========================================================
   ADMIN MENU
========================================================= */

function setupAdminMenu() {
  const menu = $("adminMenu");

  if (!menu) {
    return;
  }

  if (me && me.role === "admin") {
    menu.classList.remove("hide");
  } else {
    menu.classList.add("hide");
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {
  try {
    await stats();

    await loadNotificationBadge();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

async function stats() {
  const data = await api("/stats");

  if ($("s1")) {
    $("s1").textContent = data.partners ?? 0;
  }

  if ($("s2")) {
    $("s2").textContent = data.courses ?? 0;
  }

  if ($("s3")) {
    $("s3").textContent = data.groups ?? 0;
  }

  if ($("s4")) {
    $("s4").textContent = data.connections ?? 0;
  }
}

/* =========================================================
   SETUP NOTIFICATION SIDEBAR
========================================================= */

function setupNotificationSidebar() {
  document.querySelectorAll("aside nav").forEach((nav) => {
    const buttons = nav.querySelectorAll("button");

    buttons.forEach((button) => {
      if (!button.textContent.includes("Notifikasi")) {
        return;
      }

      let badge = button.querySelector("#notificationBadge");

      if (!badge) {
        badge = document.createElement("span");

        badge.id = "notificationBadge";
        badge.className = "notification-badge hide";

        button.appendChild(badge);
      }
    });
  });
}

/* =========================================================
   NOTIFICATION BADGE
========================================================= */

async function loadNotificationBadge() {
  try {
    const data = await api("/notifications");

    const badge = $("notificationBadge");

    if (!badge) {
      return;
    }

    const notifications = data.notifications || [];

    const unread = notifications.filter((item) => !item.is_read).length;

    if (unread > 0) {
      badge.textContent = unread > 99 ? "99+" : unread;

      badge.classList.remove("hide");
    } else {
      badge.textContent = "0";

      badge.classList.add("hide");
    }
  } catch (x) {
    console.error("Gagal memuat badge notifikasi:", x);
  }
}

/* =========================================================
   SEARCH PAGE
========================================================= */

async function loadSearchPage() {
  // Ambil daftar mata kuliah dari database
  await loadCourses();

  // Isi dropdown mata kuliah di halaman Cari Teman
  const searchCourse = $("fc");

  if (searchCourse) {
    searchCourse.innerHTML =
      '<option value="">Semua mata kuliah</option>' +
      cs
        .map((course) => {
          return `
            <option value="${escapeHtml(course.name)}">
              ${escapeHtml(course.code)}
              —
              ${escapeHtml(course.name)}
            </option>
          `;
        })
        .join("");
  }

  // =====================================================
  // ISI DROPDOWN DOMISILI DARI DATABASE
  // =====================================================

  const searchDomicile = $("fd");

  if (searchDomicile) {
    try {
      const domicileData = await api("/domiciles");

      const domiciles = domicileData.domiciles || [];

      searchDomicile.innerHTML =
        '<option value="">Semua domisili</option>' +
        domiciles
          .map((item) => {
            return `
              <option value="${escapeHtml(item.domicile)}">
                ${escapeHtml(item.domicile)}
              </option>
            `;
          })
          .join("");
    } catch (x) {
      console.error("Gagal memuat daftar domisili:", x);
    }
  }
  // Tampilkan daftar teman
  await find();
}

/* =========================================================
   SEARCH STUDY PARTNERS
========================================================= */

async function find() {
  try {
    const params = new URLSearchParams({
      course: $("fc")?.value || "",

      program: $("fp")?.value || "",

      semester: $("fs")?.value || "",

      method: $("fm")?.value || "",

      time: $("ft")?.value || "",

      domicile: $("fd")?.value || "",
    });

    const data = await api("/partners?" + params.toString());

    const people = $("people");

    if (!people) {
      return;
    }

    if (!data.partners || data.partners.length === 0) {
      people.innerHTML = `
                <div class="empty">
                    Tidak menemukan teman.
                    Coba kurangi filter.
                </div>
            `;

      return;
    }

    people.innerHTML = data.partners
      .map((person) => {
        return `
                        <article class="person">

                            <div class="person-top">

                                <div class="avatar">
                                    ${escapeHtml(getInitial(person.full_name))}
                                </div>

                                <div>

                                    <h3>
                                        ${escapeHtml(person.full_name)}
                                    </h3>

                                    <span>
                                        ${escapeHtml(
                                          person.program_study || "-",
                                        )}
                                        · Semester
                                        ${escapeHtml(
                                          String(person.semester || "-"),
                                        )}
                                    </span>

                                </div>

                            </div>


                            <div class="tags">

                                ${
                                  person.study_method
                                    ? `
                                            <span>
                                                ${escapeHtml(
                                                  person.study_method,
                                                )}
                                            </span>
                                          `
                                    : ""
                                }


                                ${
                                  person.study_time
                                    ? `
                                            <span>
                                                ${escapeHtml(person.study_time)}
                                            </span>
                                          `
                                    : ""
                                }


                                ${
                                  person.domicile
                                    ? `
                                            <span>
                                                ${escapeHtml(person.domicile)}
                                            </span>
                                          `
                                    : ""
                                }

                            </div>


                            <p>
                                ${escapeHtml(
                                  person.bio ||
                                    "Mahasiswa UT yang mencari teman belajar.",
                                )}
                            </p>


                            <p class="courses">

                                <b>
                                    Mata kuliah:
                                </b>

                                ${escapeHtml(person.courses || "Belum diatur")}

                            </p>


                           ${
                             person.connection_status === "pending"
                               ? `
            <button
                type="button"
                disabled>
                ✓ Terkirim
            </button>
          `
                               : person.connection_status === "accepted"
                                 ? `
            <button
                type="button"
                disabled>
                ✓ Terhubung
            </button>
          `
                                 : `
            <button
                type="button"
                onclick="connectUser(${person.id}, this)">
                Hubungkan
            </button>
          `
                           }

                        </article>
                    `;
      })
      .join("");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   CONNECTION
========================================================= */

async function connectUser(id, button) {
  if (!id) {
    msg("ID mahasiswa tidak ditemukan.", "error");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Mengirim...";
    }

    await api("/connections", {
      method: "POST",

      body: JSON.stringify({
        receiver_id: Number(id),
      }),
    });

    msg("Permintaan koneksi berhasil dikirim.", "success");

    if (button) {
      button.textContent = "✓ Terkirim";
    }

    await stats();
  } catch (x) {
    if (button) {
      button.disabled = false;
      button.textContent = "Hubungkan";
    }

    msg(x.message, "error");
  }
}

/* =========================================================
   CONNECTION LIST
========================================================= */

async function loadConnectionsPage() {
  try {
    const data = await api("/connections");

    const incoming = $("incomingConnections");
    const outgoing = $("outgoingConnections");
    const connected = $("connectedUsers");

    /* =========================
       PERMINTAAN MASUK
    ========================= */

    if (incoming) {
      const pendingIncoming = (data.incoming || []).filter(
        (item) => item.status === "pending",
      );

      if (pendingIncoming.length === 0) {
        incoming.innerHTML = `
          <div class="empty">
            Tidak ada permintaan koneksi.
          </div>
        `;
      } else {
        incoming.innerHTML = pendingIncoming
          .map(
            (item) => `

              <article class="person">

                <div class="person-top">

                  <div class="avatar">
                    ${escapeHtml(getInitial(item.full_name))}
                  </div>

                  <div>

                    <h3>
                      ${escapeHtml(item.full_name)}
                    </h3>

                    <span>
                      ${escapeHtml(item.program_study || "-")}

                      · Semester

                      ${escapeHtml(String(item.semester || "-"))}
                    </span>

                  </div>

                </div>


                <p>
                  ${escapeHtml(
                    item.bio || "Mahasiswa UT yang ingin terhubung.",
                  )}
                </p>


                <div class="tags">

  ${
    item.domicile
      ? `
        <span>
          ${escapeHtml(item.domicile)}
        </span>
      `
      : ""
  }

  ${
    item.study_method
      ? `
        <span>
          ${escapeHtml(item.study_method)}
        </span>
      `
      : ""
  }

  ${
    item.study_time
      ? `
        <span>
          ${escapeHtml(item.study_time)}
        </span>
      `
      : ""
  }

</div>


                <div class="connection-actions">

                  <button
                    type="button"
                    onclick="acceptConnection(${item.id})">

                    ✓ Terima

                  </button>


                  <button
                    type="button"
                    onclick="rejectConnection(${item.id})">

                    ✕ Tolak

                  </button>

                </div>

              </article>

            `,
          )
          .join("");
      }
    }

    /* =========================
       PERMINTAAN TERKIRIM
    ========================= */

    if (outgoing) {
      const pendingOutgoing = (data.outgoing || []).filter(
        (item) => item.status === "pending",
      );

      if (pendingOutgoing.length === 0) {
        outgoing.innerHTML = `
          <div class="empty">
            Tidak ada permintaan terkirim.
          </div>
        `;
      } else {
        outgoing.innerHTML = pendingOutgoing
          .map(
            (item) => `

              <article class="person">

                <div class="person-top">

                  <div class="avatar">
                    ${escapeHtml(getInitial(item.full_name))}
                  </div>

                  <div>

                    <h3>
                      ${escapeHtml(item.full_name)}
                    </h3>

                    <span>
                      ${escapeHtml(item.program_study || "-")}

                      · Semester

                      ${escapeHtml(String(item.semester || "-"))}
                    </span>

                  </div>

                </div>


                <p>
                  Menunggu persetujuan permintaan koneksi.
                </p>


                <button
                  type="button"
                  disabled>

                  ✓ Terkirim

                </button>

              </article>

            `,
          )
          .join("");
      }
    }

    /* =========================
       KONEKSI DITERIMA
    ========================= */

    if (connected) {
      if (!data.connected || data.connected.length === 0) {
        connected.innerHTML = `
          <div class="empty">
            Belum memiliki koneksi.
          </div>
        `;
      } else {
        connected.innerHTML = data.connected
          .map(
            (item) => `

              <article class="person">

                <div class="person-top">

                  <div class="avatar">
                    ${escapeHtml(getInitial(item.full_name))}
                  </div>

                  <div>

                    <h3>
                      ${escapeHtml(item.full_name)}
                    </h3>

                    <span>
                      ${escapeHtml(item.program_study || "-")}

                      · Semester

                      ${escapeHtml(String(item.semester || "-"))}
                    </span>

                  </div>

                </div>


                <div class="tags">

                  ${
                    item.domicile
                      ? `
                        <span>
                          ${escapeHtml(item.domicile)}
                        </span>
                      `
                      : ""
                  }

                  ${
                    item.study_method
                      ? `
                        <span>
                          ${escapeHtml(item.study_method)}
                        </span>
                      `
                      : ""
                  }

                  ${
                    item.study_time
                      ? `
                    <span>
                      ${escapeHtml(item.study_time)}
                    </span>
                  `
                      : ""
                  }

                </div>


                <button
    type="button"
    onclick="location.href='chat.html?user=${item.id}'">

    💬 Chat

</button>

              </article>

            `,
          )
          .join("");
      }
    }
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ACCEPT CONNECTION
========================================================= */

async function acceptConnection(id) {
  try {
    await api("/connections/" + id, {
      method: "PUT",

      body: JSON.stringify({
        action: "accept",
      }),
    });

    msg("Permintaan koneksi diterima.", "success");

    await loadConnectionsPage();

    await stats();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   REJECT CONNECTION
========================================================= */

async function rejectConnection(id) {
  if (!confirm("Tolak permintaan koneksi ini?")) {
    return;
  }

  try {
    await api("/connections/" + id, {
      method: "PUT",

      body: JSON.stringify({
        action: "reject",
      }),
    });

    msg("Permintaan koneksi ditolak.", "success");

    await loadConnectionsPage();

    await stats();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   CHAT
========================================================= */

let activeChatUserId = null;
let chatConnections = [];
let chatPollTimer = null;

async function loadChatPage() {
  try {
    await loadChatUsers();

    const params = new URLSearchParams(window.location.search);
    const requestedUserId = Number(params.get("user") || 0);

    if (requestedUserId) {
      const button = document.querySelector(
        `.chat-user[data-user-id="${requestedUserId}"]`,
      );

      if (button) {
        await openChat(requestedUserId, button);
      }
    }
  } catch (x) {
    msg(x.message, "error");
  }
}

async function loadChatUsers() {
  const list = $("chatUserList");

  if (!list) return;

  const data = await api("/connections");

  chatConnections = data.connected || [];

  if (!chatConnections.length) {
    list.innerHTML = `
      <div class="chat-empty">
        Belum memiliki teman terhubung.
      </div>
    `;
    return;
  }

  list.innerHTML = chatConnections
    .map(
      (item) => `
    <button
      type="button"
      class="chat-user"
      data-user-id="${item.user_id}"
      onclick="openChat(${item.user_id}, this)"
    >

      <div class="chat-avatar">
        ${escapeHtml(getInitial(item.full_name))}
      </div>

      <div class="chat-user-info">

        <div class="chat-user-name">
          ${escapeHtml(item.full_name)}
        </div>

        <div class="chat-user-detail">
          ${escapeHtml(item.program_study || "-")}
          · Semester
          ${escapeHtml(String(item.semester || "-"))}
        </div>

      </div>

    </button>
  `,
    )
    .join("");
}

async function openChat(userId, button) {
  activeChatUserId = Number(userId);

  document.querySelectorAll(".chat-user").forEach((item) => {
    item.classList.remove("active");
  });

  if (button) {
    button.classList.add("active");
  }

  const url = new URL(window.location.href);

  url.searchParams.set("user", activeChatUserId);

  window.history.replaceState({}, "", url);

  const person = chatConnections.find(
    (item) => Number(item.user_id) === activeChatUserId,
  );

  if (!person) {
    throw new Error("Teman tidak ditemukan atau belum terhubung.");
  }

  const headerName = $("chatHeaderName");

  const headerAvatar = $("chatHeaderAvatar");

  const headerStatus = $("chatHeaderStatus");

  const input = $("chatInput");

  const send = $("chatSend");

  if (headerName) {
    headerName.textContent = person.full_name || "Teman";
  }

  if (headerAvatar) {
    headerAvatar.textContent = getInitial(person.full_name);
  }

  if (headerStatus) {
    const statusText = [person.program_study, person.domicile]
      .filter(Boolean)
      .join(" · ");

    headerStatus.textContent = statusText || "Teman terhubung";
  }

  if (input) {
    input.disabled = false;
  }

  if (send) {
    send.disabled = false;
  }

  await loadMessages();

  if (chatPollTimer) {
    clearInterval(chatPollTimer);
  }

  chatPollTimer = setInterval(() => {
    if (activeChatUserId) {
      loadMessages(true);
    }
  }, 3000);

  if (input) {
    input.focus();
  }
}

function formatChatMessageDate(value) {
  if (!value) {
    return "";
  }

  let date;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
    date = new Date(value.replace(" ", "T") + "+07:00");
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    console.error("Timestamp tidak valid:", value);
    return "";
  }

  const timeZone = "Asia/Jakarta";

  const getDateKey = (dateValue) => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateValue);
  };

  const now = new Date();

  const todayKey = getDateKey(now);
  const messageKey = getDateKey(date);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = getDateKey(yesterday);

  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (messageKey === todayKey) {
    return `Hari ini, ${time}`;
  }

  if (messageKey === yesterdayKey) {
    return `Kemarin, ${time}`;
  }

  const dateText = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return `${dateText}, ${time}`;
}

async function loadMessages(silent = false) {
  if (!activeChatUserId) {
    return;
  }

  try {
    const data = await api("/messages/" + activeChatUserId);

    const list = $("chatMessages");

    if (!list) {
      return;
    }

    const messages = data.messages || [];

    if (!messages.length) {
      list.innerHTML = `
        <div class="chat-empty">

          <div>

            <div style="font-size:42px;">
              💬
            </div>

            <p>
              Belum ada percakapan.
            </p>

            <small>
              Mulai percakapan dengan
              teman belajar kamu.
            </small>

          </div>

        </div>
      `;
    } else {
      list.innerHTML = messages
        .map((item) => {
          const mine = Number(item.sender_id) === Number(me.id);

          const date = formatChatMessageDate(item.created_at);

          return `
            <div class="message-row ${mine ? "mine" : ""}">

              <div class="message-bubble">

                ${escapeHtml(item.message)}

                <span class="message-time">
                  ${escapeHtml(date)}
                </span>

              </div>

            </div>
          `;
        })
        .join("");
    }

    list.scrollTop = list.scrollHeight;

    await api("/messages/" + activeChatUserId + "/read", {
      method: "PUT",
    });
  } catch (x) {
    if (!silent) {
      msg(x.message, "error");
    }
  }
}

async function sendChat(event) {
  event.preventDefault();

  if (!activeChatUserId) {
    msg("Pilih teman terlebih dahulu.", "error");

    return;
  }

  const input = $("chatInput");

  const button = $("chatSend");

  const message = input?.value.trim() || "";

  if (!message) {
    return;
  }

  try {
    if (button) {
      button.disabled = true;
    }

    await api("/messages", {
      method: "POST",

      body: JSON.stringify({
        receiver_id: activeChatUserId,

        message: message,
      }),
    });

    input.value = "";

    await loadMessages();
  } catch (x) {
    msg(x.message, "error");
  } finally {
    if (button && activeChatUserId) {
      button.disabled = false;
    }

    if (input) {
      input.focus();
    }
  }
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

async function loadNotificationsPage() {
  try {
    const [notificationData, connectionData] = await Promise.all([
      api("/notifications"),
      api("/connections"),
    ]);

    const incomingList = $("incomingRequests");

    const outgoingList = $("outgoingRequests");

    const notificationList = $("notificationList");

    /* =====================================================
       PERMINTAAN MASUK
    ===================================================== */

    if (incomingList) {
      const incoming = (connectionData.incoming || []).filter(
        (item) => item.status === "pending",
      );

      if (incoming.length === 0) {
        incomingList.innerHTML = `
          <div class="empty">
            Tidak ada permintaan masuk.
          </div>
        `;
      } else {
        incomingList.innerHTML = incoming
          .map(
            (item) => `

              <article class="person">

                <div class="person-top">

                  <div class="avatar">
                    ${escapeHtml(getInitial(item.full_name))}
                  </div>

                  <div>

                    <h3>
                      ${escapeHtml(item.full_name)}
                    </h3>

                    <span>
                      ${escapeHtml(item.program_study || "-")}

                      · Semester

                      ${escapeHtml(String(item.semester || "-"))}
                    </span>

                  </div>

                </div>


                <div class="tags">

                  ${
                    item.domicile
                      ? `
                        <span>
                          ${escapeHtml(item.domicile)}
                        </span>
                      `
                      : ""
                  }


                  ${
                    item.study_method
                      ? `
                        <span>
                          ${escapeHtml(item.study_method)}
                        </span>
                      `
                      : ""
                  }


                  ${
                    item.study_time
                      ? `
                        <span>
                          ${escapeHtml(item.study_time)}
                        </span>
                      `
                      : ""
                  }

                </div>


                <div class="connection-actions">

                  <button
                    type="button"
                    onclick="acceptConnection(${item.id})">

                    ✓ Terima

                  </button>


                  <button
                    type="button"
                    onclick="rejectConnection(${item.id})">

                    ✕ Tolak

                  </button>

                </div>

              </article>

            `,
          )
          .join("");
      }
    }

    /* =====================================================
       PERMINTAAN TERKIRIM
    ===================================================== */

    if (outgoingList) {
      const outgoing = (connectionData.outgoing || []).filter(
        (item) => item.status === "pending",
      );

      if (outgoing.length === 0) {
        outgoingList.innerHTML = `
          <div class="empty">
            Tidak ada permintaan terkirim.
          </div>
        `;
      } else {
        outgoingList.innerHTML = outgoing
          .map(
            (item) => `

              <article class="person">

                <div class="person-top">

                  <div class="avatar">
                    ${escapeHtml(getInitial(item.full_name))}
                  </div>

                  <div>

                    <h3>
                      ${escapeHtml(item.full_name)}
                    </h3>

                    <span>
                      ${escapeHtml(item.program_study || "-")}

                      · Semester

                      ${escapeHtml(String(item.semester || "-"))}
                    </span>

                  </div>

                </div>


                <div class="tags">

                  ${
                    item.domicile
                      ? `
                        <span>
                          ${escapeHtml(item.domicile)}
                        </span>
                      `
                      : ""
                  }


                  ${
                    item.study_method
                      ? `
                        <span>
                          ${escapeHtml(item.study_method)}
                        </span>
                      `
                      : ""
                  }


                  ${
                    item.study_time
                      ? `
                        <span>
                          ${escapeHtml(item.study_time)}
                        </span>
                      `
                      : ""
                  }

                </div>


                <button
                  type="button"
                  disabled>

                  ⏳ Menunggu persetujuan

                </button>

              </article>

            `,
          )
          .join("");
      }
    }

    /* =====================================================
       NOTIFIKASI AKTIVITAS
    ===================================================== */

    if (notificationList) {
      const notifications = notificationData.notifications || [];

      if (notifications.length === 0) {
        notificationList.innerHTML = `
          <div class="empty">
            Belum ada notifikasi.
          </div>
        `;
      } else {
        notificationList.innerHTML = notifications
          .map((item) => {
            const unread = !item.is_read;

            return `

              <article
                class="
                  notification-item
                  ${unread ? "unread" : ""}
                "
                onclick="
    handleNotificationClick(
    ${item.id},
   '${escapeJs(item.title || "")}',
    ${Number(item.related_user_id) || "null"}
  )
"
              >

                <div class="notification-icon">

                  ${unread ? "🔔" : "✓"}

                </div>


                <div
                  class="notification-content"
                >

                  <h3>

                    ${escapeHtml(item.title || "Notifikasi")}

                  </h3>


                  <p>

                    ${escapeHtml(item.message || "")}

                  </p>


                  <small>

                    ${formatNotificationDate(item.created_at)}

                  </small>

                </div>


                ${
                  unread
                    ? `
                      <span
                        class="notification-dot"
                      ></span>
                    `
                    : ""
                }

              </article>

            `;
          })
          .join("");
      }
    }
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   MARK ONE NOTIFICATION AS READ
========================================================= */

async function handleNotificationClick(notificationId, title, relatedUserId) {
  try {
    await api("/notifications/" + notificationId + "/read", {
      method: "PUT",
    });

    if (title === "Pesan baru" && relatedUserId) {
      window.location.href = "chat.html?user=" + Number(relatedUserId);

      return;
    }

    await loadNotificationsPage();
    await loadNotificationBadge();
  } catch (x) {
    msg(x.message, "error");
  }
}

async function markNotificationRead(id) {
  if (!id) {
    return;
  }

  try {
    await api("/notifications/" + id + "/read", {
      method: "PUT",
    });

    await loadNotificationsPage();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   MARK ALL NOTIFICATIONS AS READ
========================================================= */

async function markAllNotificationsRead() {
  try {
    await api("/notifications/read-all", {
      method: "PUT",
    });

    msg("Semua notifikasi sudah dibaca.", "success");

    await loadNotificationsPage();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   NOTIFICATION DATE
========================================================= */

function formatNotificationDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   GROUP PAGE
========================================================= */

async function loadGroupPage() {
  await loadCourses();

  await groups();
}

/* =========================================================
   LOAD GROUPS
========================================================= */

async function groups() {
  try {
    const data = await api("/groups");

    const list = $("groupList");

    if (!list) {
      return;
    }

    if (!data.groups || data.groups.length === 0) {
      list.innerHTML = `
                <div class="empty">
                    Belum ada kelompok belajar.
                </div>
            `;

      return;
    }

    list.innerHTML = data.groups
      .map((group) => {
        return `
                        <article class="group">

                            <div class="group-icon">
                                👥
                            </div>


                            <div class="tag">
                                ${escapeHtml(group.code || "UMUM")}
                            </div>


                            <h3>
                                ${escapeHtml(group.name)}
                            </h3>


                            <p>
                                ${escapeHtml(
                                  group.description ||
                                    "Kelompok belajar mahasiswa UT.",
                                )}
                            </p>


                            <div class="group-meta">

                                <span>
                                    👥
                                    ${escapeHtml(
                                      String(group.member_count || 0),
                                    )}
                                    /
                                    ${escapeHtml(
                                      String(group.max_members || 0),
                                    )}
                                </span>


                                <span>
                                    🕐
                                    ${escapeHtml(group.study_time || "-")}
                                </span>

                            </div>


                            ${
                              group.joined
                                ? `
                                        <button disabled>
                                            ✓ Sudah bergabung
                                        </button>
                                      `
                                : `
                                        <button
                                            onclick="joinG(${group.id})">

                                            Gabung Kelompok

                                        </button>
                                      `
                            }

                        </article>
                    `;
      })
      .join("");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   JOIN GROUP
========================================================= */

async function joinG(id) {
  try {
    await api("/groups/" + id + "/join", {
      method: "POST",
    });

    msg("Berhasil bergabung ke kelompok.", "success");

    await groups();

    await stats();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   GROUP MODAL
========================================================= */

function openM() {
  const modal = $("modal");

  if (modal) {
    modal.classList.remove("hide");
  }
}

function closeM() {
  const modal = $("modal");

  if (modal) {
    modal.classList.add("hide");
  }
}

/* =========================================================
   CREATE GROUP
========================================================= */

async function createG(e) {
  e.preventDefault();

  try {
    await api("/groups", {
      method: "POST",

      body: JSON.stringify({
        name: $("gn").value.trim(),

        course_id: $("gc").value,

        description: $("gd").value.trim(),

        method: $("gm").value,

        study_time: $("gt").value.trim(),

        max_members: $("gx").value,
      }),
    });

    closeM();

    msg("Kelompok berhasil dibuat.", "success");

    await groups();

    await stats();

    e.target.reset();

    /*
     * Setelah reset, tampilkan lagi
     * pilihan default.
     */

    if ($("gc")) {
      $("gc").value = "";
    }
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   COURSE PAGE
========================================================= */

async function loadCoursePage() {
  await loadCourses();

  await myCourses();
}

/* =========================================================
   COURSE DATA
========================================================= */

let cs = [];

/* =========================================================
   LOAD ALL COURSES
========================================================= */

async function loadCourses() {
  try {
    const data = await api("/courses");

    cs = data.courses || [];

    /*
     * Select di halaman mata kuliah
     */

    const courseSelect = $("cs");

    if (courseSelect) {
      courseSelect.innerHTML =
        '<option value="">Pilih mata kuliah</option>' +
        cs
          .map((course) => {
            return `
                            <option value="${course.id}">
                                ${escapeHtml(course.code)}
                                —
                                ${escapeHtml(course.name)}
                            </option>
                        `;
          })
          .join("");
    }

    /*
     * Select di modal kelompok
     */

    const groupSelect = $("gc");

    if (groupSelect) {
      groupSelect.innerHTML =
        '<option value="">Pilih mata kuliah</option>' +
        cs
          .map((course) => {
            return `
                            <option value="${course.id}">
                                ${escapeHtml(course.code)}
                                —
                                ${escapeHtml(course.name)}
                            </option>
                        `;
          })
          .join("");
    }
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   MY COURSES
========================================================= */

async function myCourses() {
  try {
    const data = await api("/my-courses");

    const list = $("myc");

    if (!list) {
      return;
    }

    if (!data.courses || data.courses.length === 0) {
      list.innerHTML = `
                <div class="empty">
                    Belum ada mata kuliah.
                </div>
            `;

      return;
    }

    list.innerHTML = data.courses
      .map((course) => {
        return `
                        <div class="course-row">

                            <span>

                                <b>
                                    ${escapeHtml(course.code)}
                                </b>

                                <small>
                                    ${escapeHtml(course.name)}
                                </small>

                            </span>


                            <button
                                class="danger"
                                onclick="delC(${course.id})">

                                Hapus

                            </button>

                        </div>
                    `;
      })
      .join("");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADD MY COURSE
========================================================= */

async function addC() {
  const select = $("cs");

  if (!select || !select.value) {
    msg("Silakan pilih mata kuliah terlebih dahulu.", "error");

    return;
  }

  try {
    await api("/my-courses", {
      method: "POST",

      body: JSON.stringify({
        course_id: select.value,
      }),
    });

    msg("Mata kuliah berhasil ditambahkan.", "success");

    await myCourses();

    await stats();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   DELETE MY COURSE
========================================================= */

async function delC(id) {
  if (!confirm("Hapus mata kuliah ini dari profil kamu?")) {
    return;
  }

  try {
    await api("/my-courses/" + id, {
      method: "DELETE",
    });

    msg("Mata kuliah berhasil dihapus.", "success");

    await myCourses();

    await stats();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   PROFILE PAGE
========================================================= */

async function loadProfilePage() {
  await loadProfileDomiciles();

  fillProfile();
}

async function loadProfileDomiciles() {
  const profileDomicile = $("pd");

  if (!profileDomicile) {
    return;
  }

  try {
    const data = await api("/domiciles");

    const domiciles = data.domiciles || [];

    const currentDomicile = me?.domicile || "";

    profileDomicile.innerHTML = `
      <option value="">
        Pilih Kabupaten / Kota
      </option>

      ${domiciles
        .map((item) => {
          return `
              <option
                value="${escapeHtml(item.domicile)}"
                ${item.domicile === currentDomicile ? "selected" : ""}
              >
                ${escapeHtml(item.domicile)}
              </option>
            `;
        })
        .join("")}
    `;
  } catch (x) {
    console.error("Gagal memuat daftar domisili:", x);
  }
}

/* =========================================================
   FILL PROFILE
========================================================= */

function fillProfile() {
  if (!me) {
    return;
  }

  const fields = [
    ["pn", "full_name"],

    ["pnim", "nim"],

    ["pp", "program_study"],

    ["psem", "semester"],

    ["pd", "domicile"],

    ["pu", "upbjj"],

    ["pm", "study_method"],

    ["pt", "study_time"],

    ["pb", "bio"],

    ["pw", "whatsapp"],
  ];

  fields.forEach(([elementId, property]) => {
    const element = $(elementId);

    if (element) {
      element.value = me[property] || "";
    }
  });

  const consent = $("pc");

  if (consent) {
    consent.checked = !!me.whatsapp_consent;
  }
}

/* =========================================================
   SAVE PROFILE
========================================================= */

async function save(e) {
  e.preventDefault();

  try {
    await api("/me", {
      method: "PUT",

      body: JSON.stringify({
        full_name: $("pn").value.trim(),

        nim: $("pnim").value.trim(),

        program_study: $("pp").value.trim(),

        semester: $("psem").value,

        domicile: $("pd").value.trim(),

        upbjj: $("pu").value.trim(),

        study_method: $("pm").value,

        study_time: $("pt").value.trim(),

        bio: $("pb").value.trim(),

        whatsapp: $("pw").value.trim(),

        whatsapp_consent: $("pc").checked,
      }),
    });

    /*
     * Ambil data terbaru
     */

    me = (await api("/me")).user;

    fillUser();

    fillProfile();

    msg("Profil berhasil diperbarui.", "success");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN PAGE
========================================================= */

async function loadAdminPage() {
  /*
   * Keamanan tambahan di frontend.
   * Backend tetap menjadi pengaman utama.
   */

  if (!me || me.role !== "admin") {
    msg("Akses ditolak. Halaman ini hanya untuk administrator.", "error");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 700);

    return;
  }

  try {
    await loadAdminOverview();

    await adminLoadCourses();

    await adminLoadUsers();

    await adminLoadGroups();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN OVERVIEW
========================================================= */

async function loadAdminOverview() {
  const data = await api("/admin/overview");

  if ($("adminUsers")) {
    $("adminUsers").textContent = data.users ?? 0;
  }

  if ($("adminCourses")) {
    $("adminCourses").textContent = data.courses ?? 0;
  }

  if ($("adminGroups")) {
    $("adminGroups").textContent = data.groups ?? 0;
  }
}

/* =========================================================
   ADMIN TABS
========================================================= */

function adminTab(tabName) {
  const panels = {
    courses: $("adminCoursesPanel"),

    users: $("adminUsersPanel"),

    groups: $("adminGroupsPanel"),
  };

  Object.values(panels).forEach((panel) => {
    if (panel) {
      panel.classList.add("hide");
    }
  });

  const buttons = {
    courses: $("adminTabCourses"),

    users: $("adminTabUsers"),

    groups: $("adminTabGroups"),
  };

  Object.values(buttons).forEach((button) => {
    if (button) {
      button.classList.remove("active");
    }
  });

  if (panels[tabName]) {
    panels[tabName].classList.remove("hide");
  }

  if (buttons[tabName]) {
    buttons[tabName].classList.add("active");
  }

  if (tabName === "courses") {
    adminLoadCourses();
  }

  if (tabName === "users") {
    adminLoadUsers();
  }

  if (tabName === "groups") {
    adminLoadGroups();
  }
}

/* =========================================================
   ADMIN - COURSES
========================================================= */

async function adminLoadCourses() {
  try {
    const data = await api("/admin/courses");

    const list = $("adminCourseList");

    if (!list) {
      return;
    }

    if (!data.courses || data.courses.length === 0) {
      list.innerHTML = `
                <div class="empty">
                    Belum ada mata kuliah.
                </div>
            `;

      return;
    }

    list.innerHTML = data.courses
      .map((course) => {
        return `
                        <div class="admin-row">

                            <div class="admin-row-main">

                                <div class="admin-course-icon">
                                    📚
                                </div>


                                <div>

                                    <strong>
                                        ${escapeHtml(course.code)}
                                    </strong>

                                    <span>
                                        ${escapeHtml(course.name)}
                                    </span>

                                </div>

                            </div>


                            <div class="admin-row-actions">

                                <button
                                    onclick="adminEditCourse(
                                        ${course.id},
                                        '${escapeJs(course.code)}',
                                        '${escapeJs(course.name)}'
                                    )">

                                    Edit

                                </button>


                                <button
                                    class="danger"
                                    onclick="adminDeleteCourse(
                                        ${course.id}
                                    )">

                                    Hapus

                                </button>

                            </div>

                        </div>
                    `;
      })
      .join("");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - ADD COURSE
========================================================= */

async function adminAddCourse() {
  const code = $("adminCourseCode")?.value.trim();

  const name = $("adminCourseName")?.value.trim();

  if (!code || !name) {
    msg("Kode dan nama mata kuliah wajib diisi.", "error");

    return;
  }

  try {
    await api("/admin/courses", {
      method: "POST",

      body: JSON.stringify({
        code,
        name,
      }),
    });

    $("adminCourseCode").value = "";

    $("adminCourseName").value = "";

    msg("Mata kuliah berhasil ditambahkan.", "success");

    await adminLoadCourses();

    await loadAdminOverview();

    await loadCourses();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - EDIT COURSE
========================================================= */

async function adminEditCourse(id, oldCode, oldName) {
  const code = prompt("Kode mata kuliah:", oldCode);

  if (code === null) {
    return;
  }

  const name = prompt("Nama mata kuliah:", oldName);

  if (name === null) {
    return;
  }

  if (!code.trim() || !name.trim()) {
    msg("Kode dan nama tidak boleh kosong.", "error");

    return;
  }

  try {
    await api("/admin/courses/" + id, {
      method: "PUT",

      body: JSON.stringify({
        code: code.trim(),

        name: name.trim(),
      }),
    });

    msg("Mata kuliah berhasil diperbarui.", "success");

    await adminLoadCourses();

    await loadCourses();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - DELETE COURSE
========================================================= */

async function adminDeleteCourse(id) {
  if (!confirm("Yakin ingin menghapus mata kuliah ini?")) {
    return;
  }

  try {
    await api("/admin/courses/" + id, {
      method: "DELETE",
    });

    msg("Mata kuliah berhasil dihapus.", "success");

    await adminLoadCourses();

    await loadAdminOverview();

    await loadCourses();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - USERS
========================================================= */

async function adminLoadUsers() {
  try {
    const data = await api("/admin/users");

    const list = $("adminUserList");

    if (!list) {
      return;
    }

    if (!data.users || data.users.length === 0) {
      list.innerHTML = `
                <div class="empty">
                    Belum ada pengguna.
                </div>
            `;

      return;
    }

    list.innerHTML = data.users
      .map((user) => {
        const isAdmin = user.role === "admin";

        return `
                        <div class="admin-row">

                            <div class="admin-row-main">

                                <div class="admin-avatar">
                                    ${escapeHtml(getInitial(user.full_name))}
                                </div>


                                <div>

                                    <strong>
                                        ${escapeHtml(user.full_name)}
                                    </strong>

                                    <span>
                                        ${escapeHtml(user.email)}
                                    </span>

                                    <small>
                                        ${escapeHtml(user.program_study || "-")}
                                        · Semester
                                        ${escapeHtml(
                                          String(user.semester || "-"),
                                        )}
                                    </small>

                                </div>

                            </div>


                            <div class="admin-user-actions">

                                <span
                                    class="role-badge ${
                                      isAdmin ? "admin" : "student"
                                    }">

                                    ${isAdmin ? "ADMIN" : "MAHASISWA"}

                                </span>


                                ${
                                  isAdmin
                                    ? user.id !== me.id
                                      ? `
                                            <button
                                                onclick="adminChangeRole(
                                                    ${user.id},
                                                    'student'
                                                )">

                                                Jadikan Mahasiswa

                                            </button>
                                        `
                                      : `
                                            <span class="self-label">
                                                Akun Saya
                                            </span>
                                        `
                                    : `
                                        <button
                                            onclick="adminChangeRole(
                                                ${user.id},
                                                'admin'
                                            )">

                                            Jadikan Admin

                                        </button>
                                    `
                                }

                            </div>

                        </div>
                    `;
      })
      .join("");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - CHANGE ROLE
========================================================= */

async function adminChangeRole(id, role) {
  const message =
    role === "admin"
      ? "Jadikan pengguna ini sebagai ADMIN?"
      : "Ubah pengguna ini menjadi MAHASISWA?";

  if (!confirm(message)) {
    return;
  }

  try {
    await api("/admin/users/" + id + "/role", {
      method: "PUT",

      body: JSON.stringify({
        role,
      }),
    });

    msg("Hak akses pengguna berhasil diperbarui.", "success");

    await adminLoadUsers();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - GROUPS
========================================================= */

async function adminLoadGroups() {
  try {
    const data = await api("/admin/groups");

    const list = $("adminGroupList");

    if (!list) {
      return;
    }

    if (!data.groups || data.groups.length === 0) {
      list.innerHTML = `
                <div class="empty">
                    Belum ada kelompok belajar.
                </div>
            `;

      return;
    }

    list.innerHTML = data.groups
      .map((group) => {
        return `
                        <div class="admin-row">

                            <div class="admin-row-main">

                                <div class="admin-group-icon">
                                    👥
                                </div>


                                <div>

                                    <strong>
                                        ${escapeHtml(group.name)}
                                    </strong>

                                    <span>
                                        ${escapeHtml(group.code || "UMUM")}
                                    </span>

                                    <small>
                                        Anggota:
                                        ${escapeHtml(
                                          String(group.member_count || 0),
                                        )}
                                        /
                                        ${escapeHtml(
                                          String(group.max_members || 0),
                                        )}
                                    </small>

                                </div>

                            </div>


                            <div class="admin-row-actions">

                                <button
                                    class="danger"
                                    onclick="adminDeleteGroup(
                                        ${group.id}
                                    )">

                                    Hapus

                                </button>

                            </div>

                        </div>
                    `;
      })
      .join("");
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   ADMIN - DELETE GROUP
========================================================= */

async function adminDeleteGroup(id) {
  if (!confirm("Yakin ingin menghapus kelompok belajar ini?")) {
    return;
  }

  try {
    await api("/admin/groups/" + id, {
      method: "DELETE",
    });

    msg("Kelompok berhasil dihapus.", "success");

    await adminLoadGroups();

    await loadAdminOverview();

    await stats();
  } catch (x) {
    msg(x.message, "error");
  }
}

/* =========================================================
   LOGOUT
========================================================= */

function logout() {
  localStorage.removeItem("tb");

  token = null;

  me = null;

  window.location.href = "index.html";
}

/* =========================================================
   UTILITY - INITIAL
========================================================= */

function getInitial(name) {
  if (!name) {
    return "?";
  }

  return String(name).trim().charAt(0).toUpperCase();
}

/* =========================================================
   UTILITY - ESCAPE HTML
========================================================= */

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");
}

/* =========================================================
   UTILITY - ESCAPE JAVASCRIPT
========================================================= */

function escapeJs(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\\/g, "\\\\")

    .replace(/'/g, "\\'")

    .replace(/"/g, '\\"')

    .replace(/\n/g, "\\n")

    .replace(/\r/g, "\\r");
}

/* =========================================================
   START
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  init();
});
