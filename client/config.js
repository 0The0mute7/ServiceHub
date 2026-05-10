window.APP_CONFIG = {
  API_BASE:
    window.location.hostname === "localhost"
      ? "http://localhost:5000/api"
      : "https://servicehub-qkrk.onrender.com/api",
};
