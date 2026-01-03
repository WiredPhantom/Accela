// Lightweight UI deterrents: disable context menu, selection via keyboard shortcuts,
// drag of images/elements, and some devtools shortcuts
(function () {
  // Disable right-click
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Disable basic copy/print/save shortcuts
  document.addEventListener('keydown', function (e) {
    const key = (e.key || '').toLowerCase();
    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    // Block Ctrl/Cmd + C, S, P, U (copy, save, print, view-source), optionally block developer shortcuts
    if (ctrlOrCmd && (key === 'c' || key === 's' || key === 'p' || key === 'u')) {
      e.preventDefault();
    }

    // Block Ctrl+Shift+I / Ctrl+Shift+J / F12 to discourage devtools (not foolproof)
    if ((e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j')) || e.key === 'F12') {
      e.preventDefault();
    }
  });

  // Stop drag start (images/content)
  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });

  // Optionally hide selection on double click (some browsers)
  document.addEventListener('selectstart', function (e) {
    e.preventDefault();
  });
})();
