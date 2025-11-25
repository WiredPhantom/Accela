console.log("âœ… Enhanced clientadmin.js loaded (Premium Edition)");

const chapters = window.chapters;
const topics = window.topics;
let allFlashcards = [];

// ==================== SECTION NAVIGATION ====================
function showSection(sectionName) {
  document.querySelectorAll('.section')?.forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item')?.forEach(n => n.classList.remove('active'));

  const section = document.getElementById(sectionName + '-section');
  if (section) section.classList.add('active');

  const navItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (navItem) navItem.classList.add('active');

  document.getElementById('sidebar')?.classList.remove('mobile-open');

  if (sectionName === 'flashcards') {
    loadAllFlashcards();
  } else if (sectionName === 'topics') {
    loadFlashcardCounts();
  }
}

function toggleMobileMenu() {
  document.getElementById('sidebar')?.classList.toggle('mobile-open');
}

// ==================== TOAST NOTIFICATIONS ====================
const MAX_TOASTS = 4; // limit to 4 on screen
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Remove old toasts if over limit
  while (container.childNodes.length >= MAX_TOASTS) {
    container.firstChild?.remove();
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== MODALS ====================
function openModal(id) {
  const mod = document.getElementById(id);
  if (mod) mod.style.display = 'flex';
}
function closeModal(id) {
  const mod = document.getElementById(id);
  if (mod) mod.style.display = 'none';
}

window.onclick = function(event) {
  if (event.target?.classList?.contains('modal')) {
    event.target.style.display = 'none';
  }
}

// ==================== COLLAPSIBLE SECTIONS ====================
function toggleCollapse(element) {
  element.classList.toggle('collapsed');
  const content = element.nextElementSibling;
  if (content) content.classList.toggle('collapsed');
}

// ==================== CHAPTER FUNCTIONS ====================
function openEditChapterModal(index, name) {
  const oldIdx = document.getElementById('edit-old-chapter-index');
  const newName = document.getElementById('edit-new-chapter-name');
  if (oldIdx) oldIdx.value = index;
  if (newName) newName.value = name;
  openModal('edit-chapter-modal');
}

function openDeleteChapterModal(index) {
  const idxEl = document.getElementById('delete-chapter-index');
  const numEl = document.getElementById('delete-chapter-number');
  if (idxEl) idxEl.value = index;
  if (numEl) numEl.textContent = index;
  openModal('delete-chapter-modal');
}

// ==================== PREMIUM MANAGEMENT ====================
function toggleChapterPremium(chapterIndex, isPremium) {
  console.log("ðŸ”§ Toggle called with:", { chapterIndex, isPremium, type: typeof isPremium });

  const action = isPremium ? 'PREMIUM' : 'FREE';
  const confirmation = confirm(
    `Are you sure you want to make Chapter ${chapterIndex} ${action}?\n\nThis will affect ALL topics and flashcards in this chapter.`
  );
  if (!confirmation) return;

  showToast('Updating chapter status...', 'info');
  fetch('/admin/toggle-chapter-premium', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      chapterIndex: parseInt(chapterIndex),
      isPremium: String(isPremium)
    })
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (data.success) {
        showToast(`âœ… Chapter ${chapterIndex} is now ${action}!`, 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        throw new Error('Update failed');
      }
    })
    .catch(err => {
      console.error('âŒ Error toggling chapter premium:', err);
      showToast('âŒ Failed to update chapter status', 'error');
    });
}

function toggleTopicPremium(chapterIndex, topicIndex, isPremium) {
  const action = isPremium ? 'PREMIUM' : 'FREE';
  if (!confirm(`Make Topic ${topicIndex} ${action}?`)) return;

  showToast('Updating topic status...', 'info');
  fetch('/admin/toggle-topic-premium', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      chapterIndex: parseInt(chapterIndex),
      topicIndex: parseInt(topicIndex),
      isPremium: String(isPremium)
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast(`âœ… Topic ${topicIndex} is now ${action}!`, 'success');
        setTimeout(() => location.reload(), 1500);
      }
    })
    .catch(err => {
      console.error('Error:', err);
      showToast('âŒ Failed to update topic status', 'error');
    });
}

function openSubscriptionModal(userId, username, currentStatus, currentExpiry) {
  const idEl = document.getElementById('sub-userId');
  const userEl = document.getElementById('sub-username');
  const statusEl = document.getElementById('sub-status');
  const expiryEl = document.getElementById('sub-expiry');
  if (idEl) idEl.value = userId;
  if (userEl) userEl.textContent = username;
  if (statusEl) statusEl.value = currentStatus || 'free';
  if (expiryEl) {
    if (currentExpiry) {
      const date = new Date(currentExpiry);
      expiryEl.value = date.toISOString().split('T')[0];
    } else {
      expiryEl.value = '';
    }
  }
  openModal('subscription-modal');
}

// ==================== TOPIC FUNCTIONS ====================
function openTopicEditModal(chapterIndex, topicIndex, topicName) {
  const ch = document.getElementById('edit-topic-chapter');
  const idx = document.getElementById('edit-topic-index');
  const name = document.getElementById('edit-topic-name');
  if (ch) ch.value = chapterIndex;
  if (idx) idx.value = topicIndex;
  if (name) name.value = topicName;
  openModal('edit-topic-modal');
}
function openDeleteTopicModal(chapterIndex, topicIndex, topicName) {
  const ch = document.getElementById('delete-topic-chapter');
  const idx = document.getElementById('delete-topic-index');
  const name = document.getElementById('delete-topic-name');
  if (ch) ch.value = chapterIndex;
  if (idx) idx.value = topicIndex;
  if (name) name.textContent = topicName;
  openModal('delete-topic-modal');
}

// ==================== FLASHCARD COUNTS ====================
async function loadFlashcardCounts() {
  try {
    const response = await fetch('/admin/flashcards');
    const flashcards = await response.json();
    const counts = {};
    flashcards.forEach(fc => {
      const key = `${fc.chapterIndex}-${fc.topicIndex}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    topics.forEach(tp => {
      const key = `${tp._id.chapterIndex}-${tp._id.topicIndex}`;
      const badge = document.getElementById(`count-${key}`);
      if (badge) badge.textContent = `${counts[key] || 0} cards`;
    });
  } catch (err) {
    console.error('Error loading flashcard counts:', err);
  }
}

// ==================== VIEW FLASHCARDS ====================
async function viewFlashcards(chapterIndex, topicIndex, topicName) {
  try {
    const response = await fetch(`/admin/flashcards/${chapterIndex}/${topicIndex}`);
    const flashcards = await response.json();

    const modalTitle = document.getElementById('flashcards-modal-title');
    if (modalTitle) modalTitle.textContent = `ðŸ“‹ Topic ${topicIndex}: ${topicName}`;

    const listContainer = document.getElementById('flashcards-list');
    if (!listContainer) return;

    if (flashcards.length === 0) {
      listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No flashcards found for this topic.</p>';
    } else {
      listContainer.innerHTML = flashcards.map(card => `
        <div class="flashcard-item">
          <div class="flashcard-header">
            <div>
              <strong>Card ${card.flashcardIndex}</strong>
              ${card.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">ðŸ”’ Premium</span>' : ''}
            </div>
            <div>
              <button onclick="openEditFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`, \`${escapeHtml(card.answer)}\`)">
                âœï¸ Edit
              </button>
              <button onclick="openDeleteFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`)" class="danger">
                ðŸ—‘ï¸ Delete
              </button>
            </div>
          </div>
          <div class="flashcard-content">
            <strong>Q:</strong> <span>${escapeHtml(card.question)}</span>
          </div>
          <div class="flashcard-content">
            <strong>A:</strong> <span>${escapeHtml(card.answer)}</span>
          </div>
        </div>
      `).join('');
    }
    openModal('view-flashcards-modal');
  } catch (error) {
    console.error('Error fetching flashcards:', error);
    showToast('Failed to load flashcards', 'error');
  }
}

// ==================== EDIT/DELETE FLASHCARD ====================
function openEditFlashcardModal(flashcardId, question, answer) {
  const id = document.getElementById('edit-flashcard-id');
  const q = document.getElementById('edit-flashcard-question');
  const a = document.getElementById('edit-flashcard-answer');
  if (id) id.value = flashcardId;
  if (q) q.value = question;
  if (a) a.value = answer;
  openModal('edit-flashcard-modal');
}

const editFlashcardForm = document.getElementById('edit-flashcard-form');
if (editFlashcardForm) {
  editFlashcardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-flashcard-id');
    const question = document.getElementById('edit-flashcard-question');
    const answer = document.getElementById('edit-flashcard-answer');
    if (!id || !question || !answer) return;

    try {
      const response = await fetch('/admin/edit-flashcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flashcardId: id.value, question: question.value, answer: answer.value })
      });

      if (response.ok) {
        closeModal('edit-flashcard-modal');
        showToast('Flashcard updated successfully!', 'success');
        const vfm = document.getElementById('view-flashcards-modal');
        const fs = document.getElementById('flashcards-section');
        if (vfm?.style.display === 'flex') closeModal('view-flashcards-modal');
        if (fs?.classList.contains('active')) loadAllFlashcards();
      } else {
        showToast('Failed to update flashcard', 'error');
      }
    } catch (error) {
      console.error('Error updating flashcard:', error);
      showToast('Failed to update flashcard', 'error');
    }
  });
}

function openDeleteFlashcardModal(flashcardId, question) {
  const deleteId = document.getElementById('delete-flashcard-id');
  const preview = document.getElementById('delete-flashcard-preview');
  if (deleteId) deleteId.value = flashcardId;
  if (preview) preview.textContent = `"${question}"`;
  openModal('delete-flashcard-modal');
}

async function confirmDeleteFlashcard() {
  const deleteId = document.getElementById('delete-flashcard-id');
  if (!deleteId) return;

  try {
    const response = await fetch('/admin/delete-flashcard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flashcardId: deleteId.value })
    });
    if (response.ok) {
      closeModal('delete-flashcard-modal');
      showToast('Flashcard deleted successfully!', 'success');
      const vfm = document.getElementById('view-flashcards-modal');
      const fs = document.getElementById('flashcards-section');
      if (vfm?.style.display === 'flex') closeModal('view-flashcards-modal');
      if (fs?.classList.contains('active')) loadAllFlashcards();
      loadFlashcardCount();
    } else {
      showToast('Failed to delete flashcard', 'error');
    }
  } catch (error) {
    console.error('Error deleting flashcard:', error);
    showToast('Failed to delete flashcard', 'error');
  }
}

// ==================== ALL FLASHCARDS ====================
async function loadAllFlashcards() {
  const listContainer = document.getElementById('all-flashcards-list');
  if (listContainer)
    listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;"><span class="loading"></span> Loading flashcards...</p>';

  try {
    const response = await fetch('/admin/flashcards');
    allFlashcards = await response.json();
    displayFlashcards(allFlashcards);
    updateFilterOptions();
  } catch (err) {
    console.error('Error loading flashcards:', err);
    if (listContainer)
      listContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">âŒ Failed to load flashcards</p>';
  }
}

function displayFlashcards(flashcards) {
  const listContainer = document.getElementById('all-flashcards-list');
  if (!listContainer) return;

  if (flashcards.length === 0) {
    listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No flashcards found.</p>';
    return;
  }
  listContainer.innerHTML = flashcards.map(card => `
    <div class="flashcard-item">
      <div class="flashcard-header">
        <div>
          <strong>Chapter ${card.chapterIndex}, Topic ${card.topicIndex}, Card ${card.flashcardIndex}</strong>
          ${card.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">ðŸ”’ Premium</span>' : '<span style="color: #00ff88; margin-left: 8px;">ðŸ”“ Free</span>'}
          <br><small style="color: #888;">${escapeHtml(card.chapterName)} â†’ ${escapeHtml(card.topicName)}</small>
        </div>
        <div>
          <button onclick="openEditFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`, \`${escapeHtml(card.answer)}\`)">
            âœï¸ Edit
          </button>
          <button onclick="openDeleteFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`)" class="danger">
            ðŸ—‘ï¸ Delete
          </button>
        </div>
      </div>
      <div class="flashcard-content">
        <strong>Q:</strong> <span>${escapeHtml(card.question)}</span>
      </div>
      <div class="flashcard-content">
        <strong>A:</strong> <span>${escapeHtml(card.answer)}</span>
      </div>
    </div>
  `).join('');
}

function updateFilterOptions() {
  const chapterSelect = document.getElementById('filterChapter');
  if (!chapterSelect) return;
  const selectedChapter = chapterSelect.value;

  const topicSelect = document.getElementById('filterTopic');
  if (!topicSelect) return;

  if (selectedChapter) {
    topicSelect.disabled = false;
    const relevantTopics = topics.filter(t => t._id.chapterIndex == selectedChapter);
    topicSelect.innerHTML = '<option value="">All Topics</option>' +
      relevantTopics.map(t =>
        `<option value="${t._id.topicIndex}">Topic ${t._id.topicIndex}: ${escapeHtml(t.topicName)}</option>`
      ).join('');
  } else {
    topicSelect.disabled = true;
    topicSelect.innerHTML = '<option value="">All Topics</option>';
  }
}

function filterFlashcards() {
  const chapterFilter = document.getElementById('filterChapter')?.value;
  const topicFilter = document.getElementById('filterTopic')?.value;
  let filtered = allFlashcards;

  if (chapterFilter) {
    filtered = filtered.filter(f => f.chapterIndex == chapterFilter);
  }
  if (topicFilter) {
    filtered = filtered.filter(f => f.topicIndex == topicFilter);
  }
  displayFlashcards(filtered);
  updateFilterOptions();
}

// ==================== SEARCH ====================
let searchTimeout;
function performSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const input = document.getElementById('globalSearch');
    if (!input) return;
    const query = input.value.toLowerCase().trim();
    if (!query) {
      clearSearch();
      return;
    }
    if (allFlashcards.length === 0) return;
    const results = allFlashcards.filter(f =>
      f.question.toLowerCase().includes(query) ||
      f.answer.toLowerCase().includes(query) ||
      f.chapterName.toLowerCase().includes(query) ||
      f.topicName.toLowerCase().includes(query)
    );
    showSection('flashcards');
    displayFlashcards(results);
    if (results.length > 0) {
      showToast(`Found ${results.length} result(s)`, 'info');
    } else {
      showToast('No results found', 'info');
    }
  }, 300);
}
function clearSearch() {
  const input = document.getElementById('globalSearch');
  if (input) input.value = '';
  if (document.getElementById('flashcards-section')?.classList.contains('active')) {
    displayFlashcards(allFlashcards);
  }
}

// ==================== CHAPTER/TOPIC SELECTION HELPERS ===============
// These are the new robust versions which always set the value correctly

function chapterTextToName(text) {
  if (!text) return "";
  // Accepts hyphen, en dash, em dash, or borked dash
  const dash = text.match(/[â€”â€“-]|Ã¢â‚¬â€/);
  if (dash) return text.split(dash[0])[1]?.trim() || "";
  // fallback to text if no dash (should never happen)
  return text.trim();
}
function topicOptionToName(option) {
  // Try to use data-name attribute for topic name
  return option?.dataset?.name || option?.text?.trim() || "";
}

// --- REGULAR FLASHCARD FORM ---
function fillChapterName() {
  const sel = document.getElementById("chapterIndex");
  if (!sel) return;
  const text = sel.options[sel.selectedIndex]?.text;
  document.getElementById("chapterName").value = chapterTextToName(text);
  document.getElementById("newChapterName").value = "";
  document.getElementById("newChapterIndex").value = "";
}

function fillTopicName() {
  const sel = document.getElementById("topicIndex");
  if (!sel) return;
  const option = sel.options[sel.selectedIndex];
  document.getElementById("topicName").value = topicOptionToName(option);
  document.getElementById("newTopicName").value = "";
  document.getElementById("newTopicIndex").value = "";
}

// --- BULK FORM ---
function fillBulkChapterName() {
  const sel = document.getElementById("bulkChapterIndex");
  if (!sel) return;
  const text = sel.options[sel.selectedIndex]?.text;
  document.getElementById("bulkChapterName").value = chapterTextToName(text);
  document.getElementById("bulknewChapterName").value = "";
  document.getElementById("bulknewChapterIndex").value = "";
}
function fillBulkTopicName() {
  const sel = document.getElementById("bulkTopicIndex");
  if (!sel) return;
  const option = sel.options[sel.selectedIndex];
  document.getElementById("bulkTopicName").value = topicOptionToName(option);
  document.getElementById("bulknewTopicName").value = "";
  document.getElementById("bulknewTopicIndex").value = "";
}

// ==================== INPUT HANDLERS ====================
// --- REGULAR ---
const newChapterNameEl = document.getElementById("newChapterName");
if (newChapterNameEl) {
  newChapterNameEl.addEventListener("input", (e) => {
    const name = e.target.value.trim();
    const newIndexEl = document.getElementById("newChapterIndex");
    const chapterNameEl = document.getElementById("chapterName");
    const chapterSel = document.getElementById("chapterIndex");
    if (name) {
      const maxIndex = chapters.length ? Math.max(...chapters.map(c => c._id)) : 0;
      if (newIndexEl) newIndexEl.value = maxIndex + 1;
      if (chapterNameEl) chapterNameEl.value = name;
      if (chapterSel) chapterSel.selectedIndex = 0;
    } else {
      if (newIndexEl) newIndexEl.value = "";
      if (chapterNameEl) chapterNameEl.value = "";
    }
  });
}

const newTopicNameEl = document.getElementById("newTopicName");
if (newTopicNameEl) {
  newTopicNameEl.addEventListener("input", (e) => {
    const name = e.target.value.trim();
    const newIndexEl = document.getElementById("newTopicIndex");
    const topicNameEl = document.getElementById("topicName");
    const newChIdxEl = document.getElementById("newChapterIndex");
    const chapterSel = document.getElementById("chapterIndex");
    const topicSel = document.getElementById("topicIndex");
    if (name) {
      const chIdx = parseInt(newChIdxEl?.value) || parseInt(chapterSel?.value);
      if (chIdx) {
        const relatedTopics = topics.filter(t => t._id.chapterIndex === chIdx);
        const maxIndex = relatedTopics.length ? Math.max(...relatedTopics.map(t => t._id.topicIndex)) : 0;
        if (newIndexEl) newIndexEl.value = maxIndex + 1;
        if (topicNameEl) topicNameEl.value = name;
        if (topicSel) topicSel.selectedIndex = 0;
      } else {
        showToast("Please select or create a chapter first", "error");
        e.target.value = "";
      }
    } else {
      if (newIndexEl) newIndexEl.value = "";
      if (topicNameEl) topicNameEl.value = "";
    }
  });
}

// --- BULK ---
const bulkNewChapterNameEl = document.getElementById("bulknewChapterName");
if (bulkNewChapterNameEl) {
  bulkNewChapterNameEl.addEventListener("input", (e) => {
    const name = e.target.value.trim();
    const newIndexEl = document.getElementById("bulknewChapterIndex");
    const bulkChapterName = document.getElementById("bulkChapterName");
    const bulkChapterSel = document.getElementById("bulkChapterIndex");
    if (name) {
      const maxIndex = chapters.length ? Math.max(...chapters.map(c => c._id)) : 0;
      if (newIndexEl) newIndexEl.value = maxIndex + 1;
      if (bulkChapterName) bulkChapterName.value = name;
      if (bulkChapterSel) bulkChapterSel.selectedIndex = 0;
    } else {
      if (newIndexEl) newIndexEl.value = "";
      if (bulkChapterName) bulkChapterName.value = "";
    }
  });
}

const bulkNewTopicNameEl = document.getElementById("bulknewTopicName");
if (bulkNewTopicNameEl) {
  bulkNewTopicNameEl.addEventListener("input", (e) => {
    const name = e.target.value.trim();
    const newIndexEl = document.getElementById("bulknewTopicIndex");
    const topicNameEl = document.getElementById("bulkTopicName");
    const newChIdxEl = document.getElementById("bulknewChapterIndex");
    const chapterSel = document.getElementById("bulkChapterIndex");
    const topicSel = document.getElementById("bulkTopicIndex");
    if (name) {
      const chIdx = parseInt(newChIdxEl?.value) || parseInt(chapterSel?.value);
      if (chIdx) {
        const related = topics.filter(tp => tp._id.chapterIndex === chIdx);
        const maxIndex = related.length ? Math.max(...related.map(tp => tp._id.topicIndex)) : 0;
        if (newIndexEl) newIndexEl.value = maxIndex + 1;
        if (topicNameEl) topicNameEl.value = name;
        if (topicSel) topicSel.selectedIndex = 0;
      } else {
        showToast("Please select or create a chapter first", "error");
        e.target.value = "";
      }
    } else {
      if (newIndexEl) newIndexEl.value = "";
      if (topicNameEl) topicNameEl.value = "";
    }
  });
}

// ==================== FORM VALIDATION ====================
const flashcardForm = document.getElementById('add-flashcard-form');
if (flashcardForm) {
  flashcardForm.addEventListener("submit", (e) => {
    const chapterName = document.getElementById("chapterName")?.value.trim();
    const topicName = document.getElementById("topicName")?.value.trim();
    const newChapterName = document.getElementById("newChapterName")?.value.trim();
    const newTopicName = document.getElementById("newTopicName")?.value.trim();

    const chapterOk = chapterName || newChapterName;
    const topicOk = topicName || newTopicName;
    if (!chapterOk || !topicOk) {
      e.preventDefault();
      showToast("Please select or enter both a Chapter and a Topic", "error");
    }
  });
}

// ==================== BULK UPLOAD ====================
// (Handlers above)

// ==================== USER MANAGEMENT ====================
function openDeleteUserModal(userId, username) {
  const userIdEl = document.getElementById("delete-user-id");
  const userNameEl = document.getElementById("delete-user-name");
  if (userIdEl) userIdEl.value = userId;
  if (userNameEl) userNameEl.textContent = username;
  openModal("delete-user-modal");
}

// ==================== EXPORT ====================
async function exportAllData() {
  try {
    const response = await fetch('/admin/flashcards');
    const flashcards = await response.json();
    const dataStr = JSON.stringify(flashcards, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flashcards_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('Failed to export data', 'error');
  }
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== DASHBOARD STATS ====================
async function loadFlashcardCount() {
  try {
    const response = await fetch('/admin/flashcards');
    const flashcards = await response.json();
    const statEl = document.getElementById('stat-flashcards');
    if (statEl) statEl.textContent = flashcards.length;
    allFlashcards = flashcards;
  } catch (err) {
    console.error('Error loading flashcard count:', err);
    const statEl = document.getElementById('stat-flashcards');
    if (statEl) statEl.textContent = '0';
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  loadFlashcardCount();
  console.log(' Admin panel initialized with Premium features');

  // Attach dropdown change handlers for correct name filling
  document.getElementById("chapterIndex")?.addEventListener("change", fillChapterName);
  document.getElementById("topicIndex")?.addEventListener("change", fillTopicName);
  document.getElementById("bulkChapterIndex")?.addEventListener("change", fillBulkChapterName);
  document.getElementById("bulkTopicIndex")?.addEventListener("change", fillBulkTopicName);
});
