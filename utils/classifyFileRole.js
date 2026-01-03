// utils/classifyFileRole.js

function classifyFileRole(path, content) {
  const lower = content.toLowerCase();

  // ViewModel
  if (lower.includes("viewmodel") || lower.includes("mutablelivedata") || lower.includes("stateflow")) {
    return "viewmodel";
  }

  // UI (Jetpack Compose or XML or Activity/Fragment)
  if (
    lower.includes("@composable") ||
    lower.includes("setcontent") ||
    lower.includes("activity") ||
    lower.includes("fragment") ||
    lower.includes("compose")
  ) {
    return "ui";
  }

  // Service / Repository / API
  if (
    lower.includes("retrofit") ||
    lower.includes("okhttp") ||
    lower.includes("repository") ||
    lower.includes("service") ||
    lower.includes("api")
  ) {
    return "service";
  }

  // Navigation
  if (
    lower.includes("navcontroller") ||
    lower.includes("navhost") ||
    lower.includes("navigation") ||
    lower.includes("deeplink")
  ) {
    return "navigation";
  }

  // Data models
  if (
    lower.includes("data class") ||
    lower.includes("entity") ||
    lower.includes("@serializedname") ||
    lower.includes("parcelize")
  ) {
    return "data";
  }

  // Utility / helpers
  if (
    lower.includes("util") ||
    lower.includes("helper") ||
    lower.includes("extension") ||
    lower.includes("object ")
  ) {
    return "utility";
  }

  return "unknown";
}

module.exports = { classifyFileRole };