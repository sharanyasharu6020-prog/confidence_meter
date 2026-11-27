app.js

import flagsmith from "https://esm.sh/@flagsmith/flagsmith@12.4.0";

// 1. Replace with your Flagsmith Client-side Environment Key
const ENVIRONMENT_ID = "Kjq4Pfn7q6uP7zjos9Z6Az";

// 2. Generate & persist a stable user identifier so exposures and conversions join properly
let userId = localStorage.getItem("commitcheck_user_id");
if (!userId) {
  userId = "user_" + crypto.randomUUID();
  localStorage.setItem("commitcheck_user_id", userId);
}

const taskInput = document.getElementById("taskInput");
const confidenceBox = document.getElementById("confidenceBox");
const confButtons = document.querySelectorAll(".conf-btn");
const commitBtn = document.getElementById("commitBtn");
const statusMsg = document.getElementById("statusMsg");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");

let activeVariant = "control";
let selectedConfidence = null;
let tasks = [];

// Handle confidence pill selection (for variant users)
confButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    confButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedConfidence = btn.dataset.level;
    statusMsg.textContent = "";
  });
});

// Initialize Flagsmith with experimentation events enabled
async function initExperiment() {
  try {
    await flagsmith.init({
      environmentID: ENVIRONMENT_ID,
      identity: userId,
      enableEvents: true,
    });

    // Evaluate the multivariate experiment flag (records exposure automatically)
    const variantValue = flagsmith.getValue("confidence_meter", {
      fallback: "control",
    });

    activeVariant = variantValue === "variant" ? "variant" : "control";

    if (activeVariant === "variant") {
      confidenceBox.classList.remove("hidden");
    }

    commitBtn.disabled = false;
    commitBtn.textContent = "Commit to Task";
  } catch (err) {
    console.error("Flagsmith init failed, falling back to control:", err);
    commitBtn.disabled = false;
    commitBtn.textContent = "Commit to Task";
  }
}

// Handle task commitment + send conversion event to Flagsmith
commitBtn.addEventListener("click", async () => {
  const title = taskInput.value.trim();
  if (!title) {
    statusMsg.style.color = "#f87171";
    statusMsg.textContent = "Enter a task first.";
    return;
  }

  if (activeVariant === "variant" && !selectedConfidence) {
    statusMsg.style.color = "#f87171";
    statusMsg.textContent = "Select your confidence level (20%, 50%, or 90%) before committing.";
    return;
  }

  // Record conversion event in Flagsmith
  flagsmith.trackEvent("task_committed", {
    identifier: userId,
    metadata: {
      variant: activeVariant,
      confidence: selectedConfidence || "none",
    },
  });

  if (typeof flagsmith.flushEvents === "function") {
    await flagsmith.flushEvents();
  }

  tasks.push({
    title,
    badge: activeVariant === "variant" ? selectedConfidence : "Quick Commit",
  });

  renderTasks();
  taskInput.value = "";
  selectedConfidence = null;
  confButtons.forEach((b) => b.classList.remove("selected"));

  statusMsg.style.color = "#34d399";
  statusMsg.textContent = "Task committed! Conversion recorded.";
});

function renderTasks() {
  taskCount.textContent = tasks.length;
  taskList.innerHTML = tasks
    .map(
      (t) =>
        `<li><span>${escapeHtml(t.title)}</span><span class="tag">${t.badge}</span></li>`
    )
    .join("");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

initExperiment();
