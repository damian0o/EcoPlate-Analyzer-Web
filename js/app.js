// EcoPlate Analyzer — Main application entry point
// Tab navigation and shared state

import { initLoadTab } from './tabs/load-tab.js';
import { initEditTab, refreshEditDropdown } from './tabs/edit-tab.js';
import { initFilterTab, refreshFilterLists } from './tabs/filter-tab.js';

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initLoadTab();
  initEditTab();
  initFilterTab();
});

/* ---------- Tab Navigation ---------- */

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const sections = document.querySelectorAll(".tab-content");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      buttons.forEach((b) => b.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");

      // Refresh edit tab dropdown when it becomes visible
      if (target === "edit") {
        refreshEditDropdown();
      }

      // Refresh filter lists when filter tab becomes visible
      if (target === "filter") {
        refreshFilterLists();
      }
    });
  });
}
