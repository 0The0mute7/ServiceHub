const API_BASE = "http://localhost:5000/api";

const getToken = () => localStorage.getItem("servicehubToken");
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
      return `
        <div class="message-bubble ${isMine ? "mine" : ""}">
          <strong>${escapeHtml(message.sender.name)}</strong>
          <p>${escapeHtml(message.content)}</p>
          <time>${new Date(message.createdAt).toLocaleString()}</time>
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

  const sendMessage = async () => {
    const content = textarea.value.trim();
    if (!content) {
      showMessage("messagePageNotice", "Message content is required.", true);
      return;
    }

    const button = form.querySelector("button[type='submit']");
    setButtonLoading(button, true, "Sending...");
    showMessage("messagePageNotice", "", false);

    try {
      if (conversationId) {
        await apiRequest(`/messages/${conversationId}`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        textarea.value = "";
        await loadMessages(conversationId);
      } else if (serviceId) {
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendMessage();
  });

  textarea.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
    }
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
