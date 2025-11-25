console.log("✅ Enhanced clientadmin.js loaded (Premium Edition)");

const chapters = window.chapters;
const topics = window.topics;
let allFlashcards = [];

// ==================== NAVIGATION ====================
function showSection(sectionName) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(sectionName + '-section').classList.add('active');
  const navItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (navItem) navItem.classList.add('active');
  
  document.getElementById('sidebar').classList.remove('mobile-open');
  
  if (sectionName === 'flashcards') {
    loadAllFlashcards();
  } else if (sectionName === 'topics') {
    loadFlashcardCounts();
  }
}

function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
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
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
}

// ==================== COLLAPSIBLE SECTIONS ====================
function toggleCollapse(element) {
  element.classList.toggle('collapsed');
  const content = element.nextElementSibling;
  content.classList.toggle('collapsed');
}

// ==================== CHAPTER FUNCTIONS ====================
function openEditChapterModal(index, name) {
  document.getElementById('edit-old-chapter-index').value = index;
  document.getElementById('edit-new-chapter-name').value = name;
  openModal('edit-chapter-modal');
}

function openDeleteChapterModal(index) {
  document.getElementById('delete-chapter-index').value = index;
  document.getElementById('delete-chapter-number').textContent = index;
  openModal('delete-chapter-modal');
}

// ==================== ✨ PREMIUM MANAGEMENT ✨ ====================

function toggleChapterPremium(chapterIndex, isPremium) {
  console.log("🔧 Toggle called with:", { chapterIndex, isPremium, type: typeof isPremium });
  
  const action = isPremium ? 'PREMIUM' : 'FREE';
  const confirmation = confirm(
    `Are you sure you want to make Chapter ${chapterIndex} ${action}?\n\n` +
    `This will affect ALL topics and flashcards in this chapter.`
  );
  
  if (!confirmation) return;
  
  showToast('Updating chapter status...', 'info');
  
  fetch('/admin/toggle-chapter-premium', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ 
      chapterIndex: parseInt(chapterIndex), 
      isPremium: String(isPremium)
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      showToast(`✅ Chapter ${chapterIndex} is now ${action}!`, 'success');
      setTimeout(() => location.reload(), 1500);
    } else {
      throw new Error('Update failed');
    }
  })
  .catch(err => {
    console.error('❌ Error toggling chapter premium:', err);
    showToast('❌ Failed to update chapter status', 'error');
  });
}

function toggleTopicPremium(chapterIndex, topicIndex, isPremium) {
  const action = isPremium ? 'PREMIUM' : 'FREE';
  if (!confirm(`Make Topic ${topicIndex} ${action}?`)) return;
  
  showToast('Updating topic status...', 'info');
  
  fetch('/admin/toggle-topic-premium', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ 
      chapterIndex: parseInt(chapterIndex),
      topicIndex: parseInt(topicIndex),
      isPremium: String(isPremium)
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast(`✅ Topic ${topicIndex} is now ${action}!`, 'success');
      setTimeout(() => location.reload(), 1500);
    }
  })
  .catch(err => {
    console.error('Error:', err);
    showToast('❌ Failed to update topic status', 'error');
  });
}

function openSubscriptionModal(userId, username, currentStatus, currentExpiry) {
  document.getElementById('sub-userId').value = userId;
  document.getElementById('sub-username').textContent = username;
  document.getElementById('sub-status').value = currentStatus || 'free';
  
  if (currentExpiry) {
    const date = new Date(currentExpiry);
    document.getElementById('sub-expiry').value = date.toISOString().split('T')[0];
  } else {
    document.getElementById('sub-expiry').value = '';
  }
  
  openModal('subscription-modal');
}

// ==================== TOPIC FUNCTIONS ====================
function openTopicEditModal(chapterIndex, topicIndex, topicName) {
  document.getElementById('edit-topic-chapter').value = chapterIndex;
  document.getElementById('edit-topic-index').value = topicIndex;
  document.getElementById('edit-topic-name').value = topicName;
  openModal('edit-topic-modal');
}

function openDeleteTopicModal(chapterIndex, topicIndex, topicName) {
  document.getElementById('delete-topic-chapter').value = chapterIndex;
  document.getElementById('delete-topic-index').value = topicIndex;
  document.getElementById('delete-topic-name').textContent = topicName;
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
      if (badge) {
        badge.textContent = `${counts[key] || 0} cards`;
      }
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
    modalTitle.textContent = `📋 Topic ${topicIndex}: ${topicName}`;
    
    const listContainer = document.getElementById('flashcards-list');
    
    if (flashcards.length === 0) {
      listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No flashcards found for this topic.</p>';
    } else {
      listContainer.innerHTML = flashcards.map(card => `
        <div class="flashcard-item">
          <div class="flashcard-header">
            <div>
              <strong>Card ${card.flashcardIndex}</strong>
              ${card.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">🔒 Premium</span>' : ''}
            </div>
            <div>
              <button onclick="openEditFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`, \`${escapeHtml(card.answer)}\`)">
                ✏️ Edit
              </button>
              <button onclick="openDeleteFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`)" class="danger">
                🗑️ Delete
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
  document.getElementById('edit-flashcard-id').value = flashcardId;
  document.getElementById('edit-flashcard-question').value = question;
  document.getElementById('edit-flashcard-answer').value = answer;
  openModal('edit-flashcard-modal');
}

document.getElementById('edit-flashcard-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const flashcardId = document.getElementById('edit-flashcard-id').value;
  const question = document.getElementById('edit-flashcard-question').value;
  const answer = document.getElementById('edit-flashcard-answer').value;
  
  try {
    const response = await fetch('/admin/edit-flashcard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flashcardId, question, answer })
    });
    
    if (response.ok) {
      closeModal('edit-flashcard-modal');
      showToast('Flashcard updated successfully!', 'success');
      
      if (document.getElementById('view-flashcards-modal').style.display === 'flex') {
        closeModal('view-flashcards-modal');
      }
      
      if (document.getElementById('flashcards-section').classList.contains('active')) {
        loadAllFlashcards();
      }
    } else {
      showToast('Failed to update flashcard', 'error');
    }
  } catch (error) {
    console.error('Error updating flashcard:', error);
    showToast('Failed to update flashcard', 'error');
  }
});

function openDeleteFlashcardModal(flashcardId, question) {
  document.getElementById('delete-flashcard-id').value = flashcardId;
  document.getElementById('delete-flashcard-preview').textContent = `"${question}"`;
  openModal('delete-flashcard-modal');
}

async function confirmDeleteFlashcard() {
  const flashcardId = document.getElementById('delete-flashcard-id').value;
  
  try {
    const response = await fetch('/admin/delete-flashcard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flashcardId })
    });
    
    if (response.ok) {
      closeModal('delete-flashcard-modal');
      showToast('Flashcard deleted successfully!', 'success');
      
      if (document.getElementById('view-flashcards-modal').style.display === 'flex') {
        closeModal('view-flashcards-modal');
      }
      
      if (document.getElementById('flashcards-section').classList.contains('active')) {
        loadAllFlashcards();
      }
      
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
  listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;"><span class="loading"></span> Loading flashcards...</p>';
  
  try {
    const response = await fetch('/admin/flashcards');
    allFlashcards = await response.json();
    
    displayFlashcards(allFlashcards);
    updateFilterOptions();
  } catch (err) {
    console.error('Error loading flashcards:', err);
    listContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">❌ Failed to load flashcards</p>';
  }
}

function displayFlashcards(flashcards) {
  const listContainer = document.getElementById('all-flashcards-list');
  
  if (flashcards.length === 0) {
    listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No flashcards found.</p>';
    return;
  }
  
  listContainer.innerHTML = flashcards.map(card => `
    <div class="flashcard-item">
      <div class="flashcard-header">
        <div>
          <strong>Chapter ${card.chapterIndex}, Topic ${card.topicIndex}, Card ${card.flashcardIndex}</strong>
          ${card.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">🔒 Premium</span>' : '<span style="color: #00ff88; margin-left: 8px;">🔓 Free</span>'}
          <br><small style="color: #888;">${card.chapterName} → ${card.topicName}</small>
        </div>
        <div>
          <button onclick="openEditFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`, \`${escapeHtml(card.answer)}\`)">
            ✏️ Edit
          </button>
          <button onclick="openDeleteFlashcardModal('${card._id}', \`${escapeHtml(card.question)}\`)" class="danger">
            🗑️ Delete
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
  const selectedChapter = chapterSelect.value;
  
  if (selectedChapter) {
    const topicSelect = document.getElementById('filterTopic');
    topicSelect.disabled = false;
    
    const relevantTopics = topics.filter(t => t._id.chapterIndex == selectedChapter);
    topicSelect.innerHTML = '<option value="">All Topics</option>' + 
      relevantTopics.map(t => 
        `<option value="${t._id.topicIndex}">Topic ${t._id.topicIndex}: ${t.topicName}</option>`
      ).join('');
  } else {
    document.getElementById('filterTopic').disabled = true;
    document.getElementById('filterTopic').innerHTML = '<option value="">All Topics</option>';
  }
}

function filterFlashcards() {
  const chapterFilter = document.getElementById('filterChapter').value;
  const topicFilter = document.getElementById('filterTopic').value;
  
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
    const query = document.getElementById('globalSearch').value.toLowerCase().trim();
    
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
  document.getElementById('globalSearch').value = '';
  if (document.getElementById('flashcards-section').classList.contains('active')) {
    displayFlashcards(allFlashcards);
  }
}

// ==================== ADD FLASHCARD FORM ====================
function fillChapterName() {
  const sel = document.getElementById("chapterIndex");
  const text = sel.options[sel.selectedIndex]?.text;
  if (text?.includes("—")) {
    const name = text.split("—")[1].trim();
    document.getElementById("chapterName").value = name;
  }
  
  // ✅ CLEAR new chapter fields when selecting existing chapter
  document.getElementById("newChapterName").value = "";
  document.getElementById("newChapterIndex").value = "";
}

function fillTopicName() {
  const sel = document.getElementById("topicIndex");
  const name = sel.options[sel.selectedIndex]?.dataset.name;
  if (name) {
    document.getElementById("topicName").value = name;
  }
  
  // ✅ CLEAR new topic fields when selecting existing topic
  document.getElementById("newTopicName").value = "";
  document.getElementById("newTopicIndex").value = "";
}

// ✅ FIXED: New Chapter Name Input Handler
document.getElementById("newChapterName").addEventListener("input", (e) => {
  const name = e.target.value.trim();
  
  if (name) {
    // Calculate new chapter index
    const maxIndex = chapters.length ? Math.max(...chapters.map(c => c._id)) : 0;
    document.getElementById("newChapterIndex").value = maxIndex + 1;
    document.getElementById("chapterName").value = name;
    
    // Clear chapter selection
    document.getElementById("chapterIndex").selectedIndex = 0;
  } else {
    document.getElementById("newChapterIndex").value = "";
    document.getElementById("chapterName").value = "";
  }
});

// ✅ FIXED: New Topic Name Input Handler
document.getElementById("newTopicName").addEventListener("input", (e) => {
  const name = e.target.value.trim();
  
  if (name) {
    // Get selected or new chapter index
    const chIdx = parseInt(document.getElementById("newChapterIndex").value) || 
                   parseInt(document.getElementById("chapterIndex").value);
    
    if (chIdx) {
      // Find topics in this chapter
      const relatedTopics = topics.filter(t => t._id.chapterIndex === chIdx);
      const maxIndex = relatedTopics.length ? Math.max(...relatedTopics.map(t => t._id.topicIndex)) : 0;
      
      document.getElementById("newTopicIndex").value = maxIndex + 1;
      document.getElementById("topicName").value = name;
      
      // Clear topic selection
      document.getElementById("topicIndex").selectedIndex = 0;
    } else {
      // No chapter selected yet
      showToast("Please select or create a chapter first", "error");
      e.target.value = "";
    }
  } else {
    document.getElementById("newTopicIndex").value = "";
    document.getElementById("topicName").value = "";
  }
});

// Form validation
const flashcardForm = document.getElementById('add-flashcard-form');
if (flashcardForm) {
  flashcardForm.addEventListener("submit", (e) => {
    const chapterName = document.getElementById("chapterName").value.trim();
    const topicName = document.getElementById("topicName").value.trim();
    const newChapterName = document.getElementById("newChapterName").value.trim();
    const newTopicName = document.getElementById("newTopicName").value.trim();

    const chapterOk = chapterName || newChapterName;
    const topicOk = topicName || newTopicName;

    if (!chapterOk || !topicOk) {
      e.preventDefault();
      showToast("Please select or enter both a Chapter and a Topic", "error");
    }
  });
}


// ==================== BULK UPLOAD ====================
function fillBulkChapterName() {
  const sel = document.getElementById("bulkChapterIndex");
  const selected = sel.options[sel.selectedIndex];
  if (selected?.text.includes("â€”")) {
    document.getElementById("bulkChapterName").value = selected.text.split("â€”")[1].trim();
  }
  
  // Clear new chapter fields
  document.getElementById("bulknewChapterName").value = "";
  document.getElementById("bulknewChapterIndex").value = "";
}

function fillBulkTopicName() {
  const sel = document.getElementById("bulkTopicIndex");
  const selected = sel.options[sel.selectedIndex];
  if (selected) {
    document.getElementById("bulkTopicName").value = selected.dataset.name;
  }
  
  // Clear new topic fields
  document.getElementById("bulknewTopicName").value = "";
  document.getElementById("bulknewTopicIndex").value = "";
}

document.getElementById("bulknewChapterName").addEventListener("input", (e) => {
  const name = e.target.value.trim();
  
  if (name) {
    const maxIndex = chapters.length ? Math.max(...chapters.map(c => c._id)) : 0;
    document.getElementById("bulknewChapterIndex").value = maxIndex + 1;
    document.getElementById("bulkChapterName").value = name;
    document.getElementById("bulkChapterIndex").selectedIndex = 0;
  } else {
    document.getElementById("bulknewChapterIndex").value = "";
    document.getElementById("bulkChapterName").value = "";
  }
});

document.getElementById("bulknewTopicName").addEventListener("input", (e) => {
  const name = e.target.value.trim();
  
  if (name) {
    const chapterIndex = parseInt(document.getElementById("bulknewChapterIndex").value) || 
                         parseInt(document.getElementById("bulkChapterIndex").value);
    
    if (chapterIndex) {
      const filtered = topics.filter(tp => tp._id.chapterIndex === chapterIndex);
      const maxIndex = filtered.length ? Math.max(...filtered.map(tp => tp._id.topicIndex)) : 0;
      
      document.getElementById("bulknewTopicIndex").value = maxIndex + 1;
      document.getElementById("bulkTopicName").value = name;
      document.getElementById("bulkTopicIndex").selectedIndex = 0;
    } else {
      showToast("Please select or create a chapter first", "error");
      e.target.value = "";
    }
  } else {
    document.getElementById("bulknewTopicIndex").value = "";
    document.getElementById("bulkTopicName").value = "";
  }
});

// ==================== USER MANAGEMENT ====================
function openDeleteUserModal(userId, username) {
  document.getElementById("delete-user-id").value = userId;
  document.getElementById("delete-user-name").textContent = username;
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
    document.getElementById('stat-flashcards').textContent = flashcards.length;
    allFlashcards = flashcards;
  } catch (err) {
    console.error('Error loading flashcard count:', err);
    document.getElementById('stat-flashcards').textContent = '0';
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  loadFlashcardCount();
  console.log(' Admin panel initialized with Premium features');
});
