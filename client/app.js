const API_BASE = "https://servicehub-qkrk.onrender.com/api";

// IMPORTANT: set this to your real base64 VAPID public key (URL-safe)
const VAPID_PUBLIC_KEY = "BEgkNeMmBOoqGPyA933kZSFYXtnt0IAsIZ5xFUsSZdtmkTTZWhDhbczT5ph_3fqrmhyk15vEY6N_97XopAbJqxw";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const subscribeToPush = async () => {
  if (!("serviceWorker" in navigator)) return;
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes("REPLACE")) return;
  if (!getToken()) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await apiRequest("/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: subscription.getKey("p256dh") ? subscription.getKey("p256dh").toString("base64") : "",
        auth: subscription.getKey("auth") ? subscription.getKey("auth").toString("base64") : "",
      }),
    });
  } catch {
    // ignore
  }
};

const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  try {
    // sw.js is served from the site root (Vercel static)
    // We use absolute path to avoid scope issues across pages.
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // Ignore registration failures
  }
};

const applyAppShellUX = () => {
  // Helps the app feel more native once installed.
  // (Standalone mode is controlled by manifest display + iOS/Android behaviors.)
  try {
    document.documentElement.style.height = "100%";
    document.body.style.minHeight = "100vh";
  } catch {
    // no-op
  }

  let el = document.getElementById("pwaLoadingOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "pwaLoadingOverlay";
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.background = "rgba(247, 248, 251, 0.92)";
    el.style.zIndex = "9999";
    el.style.display = "none";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.font = "700 18px/1 Arial, Helvetica, sans-serif";
    el.style.color = "#17202a";
    el.textContent = "Loading…";
    document.body.appendChild(el);
  }

  el.style.display = "flex";
  window.addEventListener(
    "load",
    () => {
      el.style.display = "none";
    },
    { once: true }
  );
};

const getToken = () => localStorage.getItem("servicehubToken");

const MESSAGE_QUEUE_KEY = "servicehubMessageQueueV1";

const loadMessageQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(MESSAGE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveMessageQueue = (queue) => {
  localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(queue));
};

const enqueueQueuedMessage = (payload) => {
  const queue = loadMessageQueue();
  queue.push(payload);
  saveMessageQueue(queue);
};

const dequeueQueuedMessage = (queuedId) => {
  const queue = loadMessageQueue();
  const next = queue.filter((m) => m.queuedId !== queuedId);
  saveMessageQueue(next);
};

const flushQueuedMessages = async (conversationId, onStatus) => {
  if (!navigator.onLine) return;

  const queue = loadMessageQueue();
  const target = queue.filter((m) => m.conversationId === conversationId);

  for (const msg of target) {
    try {
      if (onStatus) onStatus(msg.queuedId, "sending");
      await apiRequest(`/messages/${conversationId}`, {
        method: "POST",
        body: JSON.stringify({ content: msg.content, clientQueuedId: msg.queuedId }),
      });
      if (onStatus) onStatus(msg.queuedId, "delivered");
      dequeueQueuedMessage(msg.queuedId);
    } catch (e) {
      if (onStatus) onStatus(msg.queuedId, "pending");
    }
  }
};
const getUser = () => JSON.parse(localStorage.getItem("servicehubUser") || "null");

const setSession = (token, user) => {
  localStorage.setItem("servicehubToken", token);
  localStorage.setItem("servicehubUser", JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem("servicehubToken");
  localStorage.removeItem("servicehubUser");
  window.location.href = "login.html";
};

const apiRequest = async (path, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let result;

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { message: text || "Request failed" };
  }

  if (!response.ok) {
    throw result;
  }

  return result;
};

const showMessage = (id, message, isError = false) => {
  const element = document.getElementById(id);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
};

const clearFieldErrors = () => {
  document.querySelectorAll(".field-error").forEach((el) => el.remove());
  const generalMessage = document.getElementById("formMessage");
  if (generalMessage) {
    generalMessage.textContent = "";
    generalMessage.classList.remove("error");
  }
};

const showFieldErrors = (errors) => {
  clearFieldErrors();

  errors.forEach((error) => {
    const input = document.getElementById(error.field) || document.querySelector(`[name="${error.field}"]`);
    if (input && input.parentNode) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "field-error error";
      errorDiv.textContent = error.message;
      input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }
  });
};

const setButtonLoading = (button, isLoading, loadingText) => {
  if (!button) return;
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.originalText;
};

const getQueryParams = () => new URLSearchParams(window.location.search);

const scrollToBottom = (container) => {
  if (!container) return;
  container.scrollTop = container.scrollHeight;
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
};

const updateNav = () => {
  const user = getUser();
  const authOnly = document.querySelectorAll("[data-auth-only]");
  const guestOnly = document.querySelectorAll("[data-guest-only]");
  const userName = document.querySelector("[data-user-name]");

  authOnly.forEach((element) => {
    element.hidden = !user;
  });

  guestOnly.forEach((element) => {
    element.hidden = !!user;
  });

  if (userName && user) {
    userName.textContent = user.name;
  }
};

const updateHomepageCta = () => {
  const button = document.getElementById("heroSecondaryButton");
  if (!button) return;

  const user = getUser();
  if (user) {
    button.textContent = "Go to dashboard";
    button.href = "dashboard.html";
  } else {
    button.textContent = "Create Listing";
    button.href = "create-service.html";
  }
};

const handleProfilePage = () => {
  const form = document.getElementById("profileForm");
  if (!form) return;

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  const user = getUser();
  if (!user) return;

  const nameInput = document.getElementById("profileName");
  const emailInput = document.getElementById("profileEmail");

  if (nameInput) nameInput.value = user.name;
  if (emailInput) emailInput.value = user.email;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFieldErrors();

    const button = form.querySelector("button[type='submit']");
    setButtonLoading(button, true, "Saving...");

    const formData = new FormData(form);
    const updatedUser = {
      ...user,
      name: formData.get("name"),
    };

    setSession(getToken(), updatedUser);
    updateNav();
    updateHomepageCta();
    showMessage("formMessage", "Profile saved.");
    setButtonLoading(button, false);
  });
};

const bindLogout = () => {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", clearSession);
  });
};

const handleRegister = () => {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors();

    const button = form.querySelector("button[type='submit']");
    setButtonLoading(button, true, "Creating account...");

    const formData = new FormData(form);
    const body = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });

      localStorage.setItem("servicehubUser", JSON.stringify(result.data));
      showMessage("formMessage", "Account created. You can log in now.");
      window.location.href = "login.html";
    } catch (error) {
      if (error.errors) {
        showFieldErrors(error.errors);
      } else {
        showMessage("formMessage", error.message || "Registration failed", true);
      }
    } finally {
      setButtonLoading(button, false);
    }
  });
};

const handleLogin = () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors();

    const button = form.querySelector("button[type='submit']");
    setButtonLoading(button, true, "Logging in...");

    const formData = new FormData(form);
    const email = formData.get("email");
    const body = {
      email,
      password: formData.get("password"),
    };

    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setSession(result.data.token, result.data.user);
      window.location.href = "services.html";
    } catch (error) {
      if (error.errors) {
        showFieldErrors(error.errors);
      } else {
        showMessage("formMessage", error.message || "Login failed", true);
      }
    } finally {
      setButtonLoading(button, false);
    }
  });
};

const renderServices = (services) => {
  const list = document.getElementById("servicesList");
  if (!list) return;

  if (!services.length) {
    list.innerHTML = "<p class=\"notice\">No services yet.</p>";
    return;
  }

  list.innerHTML = services
    .map(
      (service) => `
        <a class="service-card-link" href="service.html?id=${service.id}">
          <article class="service-card">
            <div class="meta">
              <span class="pill">${escapeHtml(service.category)}</span>
              <span class="pill">${escapeHtml(service.location)}</span>
            </div>
            <h3>${escapeHtml(service.title)}</h3>
            <p>${escapeHtml(service.description)}</p>
            <strong>$${Number(service.price).toFixed(2)}</strong>
          </article>
        </a>
      `
    )
    .join("");
};

const loadServices = async () => {
  const list = document.getElementById("servicesList");
  if (!list) return;

  try {
    const result = await apiRequest("/services");
    renderServices(result.data);
  } catch (error) {
    list.innerHTML = `<p class="notice error">${error.message}</p>`;
  }
};

const handleCreateService = () => {
  const form = document.getElementById("serviceForm");
  if (!form) return;

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get("id");

  if (serviceId) {
    loadServiceForEdit(serviceId);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors();

    const button = form.querySelector("button[type='submit']");
    setButtonLoading(button, true, serviceId ? "Saving..." : "Creating...");

    const formData = new FormData(form);
    const body = {
      title: formData.get("title"),
      description: formData.get("description"),
      price: Number(formData.get("price")),
      category: formData.get("category"),
      location: formData.get("location"),
      contact: formData.get("contact"),
    };

    try {
      await apiRequest(serviceId ? `/services/${serviceId}` : "/services", {
        method: serviceId ? "PUT" : "POST",
        body: JSON.stringify(body),
      });

      showMessage("formMessage", serviceId ? "Service updated successfully." : "Service created successfully.");
      window.location.href = serviceId ? "dashboard.html" : "services.html";
    } catch (error) {
      if (error.errors) {
        showFieldErrors(error.errors);
      } else {
        showMessage("formMessage", error.message || "Failed to save service", true);
      }
    } finally {
      setButtonLoading(button, false);
    }
  });
};

const loadServiceForEdit = async (serviceId) => {
  const title = document.getElementById("serviceFormTitle");
  const submitButton = document.getElementById("serviceSubmitButton");

  if (title) {
    title.textContent = "Edit Service";
  }

  if (submitButton) {
    submitButton.textContent = "Save Changes";
  }

  try {
    const result = await apiRequest(`/services/${serviceId}`);
    const service = result.data;

    document.getElementById("title").value = service.title;
    document.getElementById("description").value = service.description;
    document.getElementById("price").value = service.price;
    document.getElementById("category").value = service.category;
    document.getElementById("location").value = service.location;
    document.getElementById("contact").value = service.contact;
  } catch (error) {
    showMessage("formMessage", error.message, true);
  }
};

const loadDashboard = async () => {
  const count = document.getElementById("serviceCount");
  const userLabel = document.getElementById("dashboardUser");
  const myServicesList = document.getElementById("myServicesList");
  if (!count && !userLabel && !myServicesList) return;

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  const user = getUser();
  if (userLabel && user) {
    userLabel.textContent = user.email;
  }

  try {
    const result = await apiRequest("/services/mine");
    const services = result.data;

    if (count) {
      count.textContent = services.length;
    }

    renderMyServices(services);
  } catch (error) {
    showMessage("dashboardMessage", error.message, true);
  }
};

const renderServiceDetail = (service) => {
  const detail = document.getElementById("serviceDetail");
  const panel = document.getElementById("messagePanel");
  if (!detail || !panel) return;

  const user = getUser();
  const isOwner = user && service.provider && user.id === service.provider.id;

  detail.innerHTML = `
    <div>
      <span class="pill">${escapeHtml(service.category)}</span>
      <span class="pill">${escapeHtml(service.location)}</span>
      <h1 class="page-title">${escapeHtml(service.title)}</h1>
      <p>${escapeHtml(service.description)}</p>
      <strong>$${Number(service.price).toFixed(2)}</strong>
    </div>
    <div class="contact-box">
      <h3>Provider</h3>
      <p><strong>${escapeHtml(service.provider.name)}</strong></p>
      <p>${escapeHtml(service.provider.email)}</p>
      <h3>Contact</h3>
      <p>${service.contact ? escapeHtml(service.contact) : "Login to view contact details."}</p>
    </div>
  `;

  panel.innerHTML = `
    <h2>Connect with provider</h2>
    <p class="notice">${isOwner ? "You are the owner of this listing." : "Send a message to start a conversation."}</p>
    <div class="card-actions">
      ${isOwner ? "" : `<a class="button icon-button" href="messages.html?serviceId=${service.id}" aria-label="Message provider"><span>💬</span></a>`}
      <a class="button secondary" href="services.html">Back to listings</a>
    </div>
  `;
};

const loadServiceDetail = async () => {
  const detail = document.getElementById("serviceDetail");
  if (!detail) return;

  const params = getQueryParams();
  const serviceId = params.get("id");

  if (!serviceId) {
    detail.innerHTML = "<p class='notice error'>Service not found.</p>";
    return;
  }

  try {
    const result = await apiRequest(`/services/${serviceId}`);
    renderServiceDetail(result.data);
  } catch (error) {
    detail.innerHTML = `<p class='notice error'>${error.message || "Unable to load service."}</p>`;
  }
};

const renderMessages = (messages, currentUserId) => {
  const thread = document.getElementById("messageThread");
  if (!thread) return;

  if (!messages.length) {
    thread.innerHTML = "<p class='notice'>No messages yet. Start the conversation below.</p>";
    return;
  }

  thread.innerHTML = messages
    .map((message) => {
      const isMine = message.sender.id === currentUserId;
      const status = message.status || "sent";
      const ticks = status === "sent" ? "✔" : status === "delivered" ? "✔✔" : "✔✔";
      const color = status === "seen" ? "#146c5f" : "inherit";
      return `
        <div class="message-bubble ${isMine ? "mine" : ""}">
          <strong>${escapeHtml(message.sender.name)}</strong>
          <p>${escapeHtml(message.content)}</p>
          <time>${new Date(message.createdAt).toLocaleString()}</time>
          ${
            isMine
              ? `<p class="notice" style="margin:8px 0 0;">
                   <span style="color:${color};">${ticks}</span>
                 </p>`
              : ""
          }
        </div>
      `;
    })
    .join("");
  scrollToBottom(thread);
};

const renderConversations = (conversations) => {
  const thread = document.getElementById("messageThread");
  if (!thread) return;

  if (!conversations.length) {
    thread.innerHTML = "<p class='notice'>No conversations yet.</p>";
    return;
  }

  thread.innerHTML = conversations
    .map((conversation) => {
      const other = conversation.otherParticipant;
      const latest = conversation.latestMessage;
      return `
        <a class="service-card-link" href="messages.html?conversationId=${conversation.id}">
          <article class="service-card">
            <div class="meta">
              <span class="pill">${escapeHtml(conversation.service.category)}</span>
              <span class="pill">${escapeHtml(conversation.service.location)}</span>
            </div>
            <h3>${escapeHtml(conversation.service.title)}</h3>
            <p>Conversation with ${escapeHtml(other.name)}</p>
            <p class="notice">${latest ? escapeHtml(latest.content) : "No messages yet."}</p>
          </article>
        </a>
      `;
    })
    .join("");
};

const loadConversations = async () => {
  const thread = document.getElementById("messageThread");
  if (thread) {
    thread.innerHTML = "<p class='notice'>Loading inbox...</p>";
  }

  try {
    const result = await apiRequest("/messages/conversations");
    renderConversations(result.data);
  } catch (error) {
    if (thread) thread.innerHTML = `<p class='notice error'>${error.message || "Unable to load conversations."}</p>`;
  }
};

const loadMessages = async (conversationId) => {
  const thread = document.getElementById("messageThread");
  const notice = document.getElementById("messagePageNotice");

  if (thread) {
    thread.innerHTML = "<p class='notice'>Loading conversation...</p>";
  }

  try {
    const result = await apiRequest(`/messages/${conversationId}`);
    const user = getUser();
    renderMessages(result.data, user?.id);
  } catch (error) {
    if (thread) thread.innerHTML = `<p class='notice error'>${error.message || "Unable to load messages."}</p>`;
    if (notice) showMessage("messagePageNotice", error.message || "Unable to load messages.", true);
  }
};

const handleMessagesPage = () => {
  const form = document.getElementById("messageForm");
  const notice = document.getElementById("messagePageNotice");
  const textarea = document.getElementById("messageContent");
  if (!form || !textarea) return;

  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  const params = getQueryParams();
  const conversationId = params.get("conversationId");
  const serviceId = params.get("serviceId");

  if (conversationId) {
    loadMessages(conversationId);
  } else if (!serviceId) {
    loadConversations();
  }

  // Socket.io realtime (WhatsApp-style)
  let socket = null;
  const typingIndicatorId = "typingIndicator";
  const ensureTypingIndicator = () => {
    if (document.getElementById(typingIndicatorId)) return;
    const thread = document.getElementById("messageThread");
    if (!thread) return;

    const el = document.createElement("div");
    el.id = typingIndicatorId;
    el.className = "notice";
    el.style.marginBottom = "12px";
    el.style.display = "none";
    el.textContent = "Typing…";
    thread.prepend(el);
  };

  ensureTypingIndicator();

  const connectSocket = () => {
    if (!conversationId) return;
    if (typeof io === "undefined") return;

    // JWT from localStorage
    const token = getToken();
    if (!token) return;

    socket = io({
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("joinConversation", { conversationId });
    });

    socket.on("typing:other", ({ conversationId: cid, typing }) => {
      if (!cid || String(cid) !== String(conversationId)) return;
      const el = document.getElementById(typingIndicatorId);
      if (!el) return;
      el.style.display = typing ? "block" : "none";
      el.textContent = typing ? "User is typing…" : "";
    });

    socket.on("message:new", (messagePayload) => {
      if (!messagePayload || messagePayload.conversationId !== conversationId) return;

      // Remove offline queued bubbles if they exist for same content is hard; we keep them.
      // Render the new message bubble.
      const thread = document.getElementById("messageThread");
      if (!thread) return;

      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="message-bubble ${messagePayload.sender?.id === getUser()?.id ? "mine" : ""}" data-message-id="${messagePayload.id}">
          <strong>${escapeHtml(messagePayload.sender?.name || "Unknown")}</strong>
          <p>${escapeHtml(messagePayload.content || "")}</p>
          <time>${new Date(messagePayload.createdAt || Date.now()).toLocaleString()}</time>
          <p class="notice" style="margin:8px 0 0;">
            <span style="color:${messagePayload.status === "seen" ? "#146c5f" : "inherit"};">
              ${messagePayload.status === "sent" ? "✔" : messagePayload.status === "delivered" ? "✔✔" : "✔✔"}
            </span>
          </p>
        </div>
      `;
      thread.appendChild(wrap.firstElementChild);

      scrollToBottom(thread);
    });

    socket.on("message:status", ({ conversationId: cid, messageId, status, seenAt }) => {
      if (!cid || String(cid) !== String(conversationId)) return;
      const bubble = document.querySelector(`[data-message-id="${messageId}"]`);
      if (!bubble) return;

      const statusSpan = bubble.querySelector(".notice span");
      if (statusSpan) statusSpan.textContent = status || "sent";
    });

    // Mark seen when chat is open (after initial render)
    setTimeout(() => {
      // We'll mark seen only for messages already loaded; later we can do a smarter range query.
      const msgBubbles = document.querySelectorAll("[data-message-id]");
      msgBubbles.forEach((b) => {
        const id = b.getAttribute("data-message-id");
        if (id) socket.emit("messageSeen", { conversationId, messageId: Number(id) });
      });
    }, 800);
  };

  connectSocket();

  const upsertMessageStatus = (queuedId, status) => {
    // Best-effort UI: if we re-render later, statuses will refresh from server.
    // For offline, we show queued "pending" line items below.
    const el = document.querySelector(`[data-queued-id="${queuedId}"]`);
    if (el) el.textContent = status;
  };

  const renderQueuedBubbles = (conversationIdToRender) => {
    if (!conversationIdToRender) return;
    const queue = loadMessageQueue();
    const queued = queue.filter((m) => m.conversationId === conversationIdToRender);
    if (!queued.length) return;

    const thread = document.getElementById("messageThread");
    if (!thread) return;

    const existingQueued = thread.querySelector(".queued-pending");
    if (!existingQueued) {
      const wrap = document.createElement("div");
      wrap.className = "queued-pending";
      wrap.style.display = "grid";
      wrap.style.gap = "12px";
      wrap.style.marginBottom = "12px";
      thread.prepend(wrap);
    }

    const container = thread.querySelector(".queued-pending");
    if (!container) return;

    container.innerHTML = queued
      .map(
        (m) => `
          <div class="message-bubble mine" data-queued-id="${m.queuedId}">
            <strong>${escapeHtml(getUser()?.name || "You")}</strong>
            <p>${escapeHtml(m.content)}</p>
            <time>Pending • ${new Date(m.createdAt).toLocaleString()}</time>
            <p class="notice" style="margin:8px 0 0;">Status: <span>${m.status || "pending"}</span></p>
          </div>
        `
      )
      .join("");
  };

  const sendMessage = async () => {
    const content = textarea.value.trim();
    if (!content) {
      showMessage("messagePageNotice", "Message content is required.", true);
      return;
    }

    const button = form.querySelector("button[type='submit']");
    setButtonLoading(button, true, "Sending...");
    showMessage("messagePageNotice", "", false);

    // Offline: queue + mark pending
    if (conversationId && !navigator.onLine) {
      const queuedId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      enqueueQueuedMessage({
        queuedId,
        conversationId,
        content,
        createdAt: new Date().toISOString(),
        status: "pending",
      });

      textarea.value = "";
      renderQueuedBubbles(conversationId);
      showMessage("messagePageNotice", "You’re offline. Message queued (pending).");
      setButtonLoading(button, false);
      return;
    }

    // Prefer realtime via Socket.io when possible.
    if (conversationId && socket && socket.connected) {
      try {
        const result = await new Promise((resolve) => {
          socket.emit("sendMessage", { conversationId, content }, (ack) => resolve(ack));
        });

        if (result && result.ok) {
          textarea.value = "";
          // UI will update via message:new event.
          showMessage("messagePageNotice", "Message sent.");
        } else {
          // Fall back to REST if ack failed.
          await apiRequest(`/messages/${conversationId}`, {
            method: "POST",
            body: JSON.stringify({ content }),
          });
          textarea.value = "";
          await loadMessages(conversationId);
        }
      } catch (error) {
        try {
          await apiRequest(`/messages/${conversationId}`, {
            method: "POST",
            body: JSON.stringify({ content }),
          });
          textarea.value = "";
          await loadMessages(conversationId);
        } catch (fallbackErr) {
          showMessage("messagePageNotice", fallbackErr.message || "Failed to send message.", true);
        }
      } finally {
        setButtonLoading(button, false);
      }
      return;
    }

    try {
      if (conversationId) {
        await apiRequest(`/messages/${conversationId}`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        textarea.value = "";
        await loadMessages(conversationId);
      } else if (serviceId) {
        // If we don't have a conversationId yet, we can only start conversation online.
        // Offline: queue not supported for "start" (needs conversationId from server).
        if (!navigator.onLine) {
          showMessage("messagePageNotice", "Go online first to start a conversation.", true);
          return;
        }

        const result = await apiRequest("/messages/start", {
          method: "POST",
          body: JSON.stringify({ serviceId: Number(serviceId), content }),
        });
        window.location.href = `messages.html?conversationId=${result.data.id}`;
        return;
      }
      showMessage("messagePageNotice", "Message sent successfully.");
    } catch (error) {
      showMessage("messagePageNotice", error.message || "Failed to send message.", true);
    } finally {
      setButtonLoading(button, false);
    }
  };

  // When online again, flush queued messages for the current conversation.
  if (conversationId) {
    const flush = async () => {
      renderQueuedBubbles(conversationId);
      await flushQueuedMessages(conversationId, (queuedId, status) => {
        upsertMessageStatus(queuedId, status);
        const q = loadMessageQueue();
        const pending = q.filter((m) => m.conversationId === conversationId && m.queuedId === queuedId);
        if (status === "sending") showMessage("messagePageNotice", "Sending pending messages…");
        if (status === "delivered") showMessage("messagePageNotice", "Pending messages delivered.");
        if (status === "pending") showMessage("messagePageNotice", "Some messages are still pending.", true);
      });
      // Refresh thread after flush so the UI shows real server delivery.
      await loadMessages(conversationId);
    };

    if (navigator.onLine) {
      flush();
    } else {
      showMessage("messagePageNotice", "You’re offline. Messages will be queued.", false);
      renderQueuedBubbles(conversationId);
    }

    window.addEventListener(
      "online",
      () => {
        flush();
      },
      { once: false }
    );
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendMessage();
  });

  let typingTimeoutId = null;
  const typingStart = () => {
    if (!conversationId || !socket || !socket.connected) return;
    socket.emit("typing:start", { conversationId });
  };

  const typingStop = () => {
    if (!conversationId || !socket || !socket.connected) return;
    socket.emit("typing:stop", { conversationId });
  };

  const scheduleTypingStop = () => {
    if (typingTimeoutId) clearTimeout(typingTimeoutId);
    typingTimeoutId = setTimeout(() => {
      typingStop();
    }, 1000);
  };

  textarea.addEventListener("input", () => {
    typingStart();
    scheduleTypingStop();
  });

  textarea.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      typingStop();
      await sendMessage();
      return;
    }
    // Other keys imply typing.
    typingStart();
    scheduleTypingStop();
  });

  textarea.addEventListener("blur", () => {
    typingStop();
  });
};

const protectRoute = () => {
  const protectedPages = ["create-service.html", "dashboard.html", "messages.html", "profile.html"];
  const currentPage = window.location.pathname.split("/").pop();
  if (protectedPages.includes(currentPage) && !getToken()) {
    window.location.href = "login.html";
  }
};

const renderMyServices = (services) => {
  const list = document.getElementById("myServicesList");
  if (!list) return;

  if (!services.length) {
    list.innerHTML = "<p class=\"notice\">You haven’t created any services yet.</p>";
    return;
  }

  list.innerHTML = services
    .map(
      (service) => `
        <article class="service-card">
          <div class="meta">
            <span class="pill">${escapeHtml(service.category)}</span>
            <span class="pill">${escapeHtml(service.location)}</span>
          </div>
          <h3>${escapeHtml(service.title)}</h3>
          <p>${escapeHtml(service.description)}</p>
          <strong>$${Number(service.price).toFixed(2)}</strong>
          <div class="card-actions">
            <a class="button secondary" href="service.html?id=${service.id}">
              View
            </a>
            <a class="button secondary" href="create-service.html?id=${service.id}">
              Edit
            </a>
            <button class="button danger" type="button" data-delete-service="${service.id}">
              Delete
            </button>
          </div>
        </article>
      `
    )
    .join("");
};

const handleDashboardActions = () => {
  const list = document.getElementById("myServicesList");
  if (!list) return;

  list.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-service]");
    if (!deleteButton) return;

    const serviceId = deleteButton.dataset.deleteService;
    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    try {
      await apiRequest(`/services/${serviceId}`, {
        method: "DELETE",
      });

      showMessage("dashboardMessage", "Service deleted.");
      loadDashboard();
    } catch (error) {
      deleteButton.disabled = false;
      deleteButton.textContent = "Delete";
      showMessage("dashboardMessage", error.message, true);
    }
  });

};

document.addEventListener("DOMContentLoaded", () => {
  applyAppShellUX();
  registerServiceWorker().then(() => subscribeToPush());

  updateNav();
  updateHomepageCta();
  bindLogout();
  protectRoute();
  handleRegister();
  handleLogin();
  loadServices();
  handleCreateService();
  handleDashboardActions();
  loadDashboard();
  loadInbox();
  loadServiceDetail();
  handleMessagesPage();
  handleProfilePage();
});

const renderInbox = (conversations) => {
  const list = document.getElementById("inboxList");
  if (!list) return;

  if (!conversations.length) {
    list.innerHTML = "<p class=\"notice\">No inbox conversations yet.</p>";
    return;
  }

  const user = getUser();
  list.innerHTML = conversations
    .map((conversation) => {
      const other = conversation.otherParticipant;
      const latest = conversation.latestMessage;
      const isUnread = latest && latest.sender.id !== user?.id;
      return `
        <article class="service-card ${isUnread ? "unread" : ""}">
          <div class="meta">
            <span class="pill">${escapeHtml(conversation.service.category)}</span>
            <span class="pill">${escapeHtml(conversation.service.location)}</span>
            ${isUnread ? `<span class="badge unread-badge">●</span>` : ""}
          </div>
          <h3>${escapeHtml(conversation.service.title)}</h3>
          <p>${escapeHtml(other.name)}</p>
          <p class="notice">${latest ? escapeHtml(latest.content) : "No messages yet."}</p>
          <div class="card-actions">
            <a class="button secondary" href="messages.html?conversationId=${conversation.id}">Open</a>
          </div>
        </article>
      `;
    })
    .join("");
};

const loadInbox = async () => {
  const list = document.getElementById("inboxList");
  const toggle = document.getElementById("inboxToggle");
  if (!list) return;

  if (toggle) {
    toggle.addEventListener("click", () => {
      const isVisible = list.style.display !== "none";
      list.style.display = isVisible ? "none" : "grid";
      toggle.setAttribute("aria-expanded", !isVisible);
      toggle.textContent = isVisible ? "Show" : "Hide";
    });
  }

  list.innerHTML = "<p class='notice'>Loading inbox...</p>";

  try {
    const result = await apiRequest("/messages/conversations");
    renderInbox(result.data);
  } catch (error) {
    list.innerHTML = `<p class='notice error'>${error.message || "Unable to load inbox."}</p>`;
  }
};
