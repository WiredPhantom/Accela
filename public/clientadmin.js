(function() {
  'use strict';
  function findNextAvailableIndex(existingIndices) {
  if (existingIndices.length === 0) return 1;
  const sorted = [...existingIndices].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) return i + 1;
  }
  return sorted[sorted.length - 1] + 1;
  }

  console.log("✅ Enhanced clientadmin.js loaded (Premium + Notes + Device Lock Edition)");

  const chapters = window.chapters || [];
  const topics = window.topics || [];
  const noteChapters = window.noteChapters || [];
  const noteTopics = window.noteTopics || [];
  let allFlashcards = [];
  let allNotes = [];
  let searchTimeout;

  // ==================== SECTION NAVIGATION ====================
  window.showSection = function(sectionName) {
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
    } else if (sectionName === 'notes') {
      loadAllNotes();
    } else if (sectionName === 'device-locks') {
      loadDeviceLocks();
    }
  };

  window.toggleMobileMenu = function() {
    document.getElementById('sidebar')?.classList.toggle('mobile-open');
  };

  // ==================== TOAST NOTIFICATIONS ====================
  const MAX_TOASTS = 4;
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

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
  window.openModal = function(id) {
    const mod = document.getElementById(id);
    if (mod) mod.style.display = 'flex';
  };

  window.closeModal = function(id) {
    const mod = document.getElementById(id);
    if (mod) mod.style.display = 'none';
  };

  window.onclick = function(event) {
    if (event.target?.classList?.contains('modal')) {
      event.target.style.display = 'none';
    }
  };

  // ==================== COLLAPSIBLE SECTIONS ====================
  window.toggleCollapse = function(element) {
    element.classList.toggle('collapsed');
    const content = element.nextElementSibling;
    if (content) content.classList.toggle('collapsed');
  };

  // ==================== UTILITY FUNCTIONS ====================
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeForTemplate(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/`/g, '\\`').replace(/\$/g, '\\$');
  }

  // ==================== CHAPTER FUNCTIONS ====================
  window.openEditChapterModal = function(index, name) {
    const oldIdx = document.getElementById('edit-old-chapter-index');
    const newName = document.getElementById('edit-new-chapter-name');
    if (oldIdx) oldIdx.value = index;
    if (newName) newName.value = name;
    openModal('edit-chapter-modal');
  };

  window.openDeleteChapterModal = function(index) {
    const idxEl = document.getElementById('delete-chapter-index');
    const numEl = document.getElementById('delete-chapter-number');
    if (idxEl) idxEl.value = index;
    if (numEl) numEl.textContent = index;
    openModal('delete-chapter-modal');
  };

  // ==================== PREMIUM MANAGEMENT ====================
  window.toggleChapterPremium = function(chapterIndex, isPremium) {
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
  };

  window.toggleTopicPremium = function(chapterIndex, topicIndex, isPremium) {
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
          showToast(`✅ Topic ${topicIndex} is now ${action}!`, 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error('Update failed');
        }
      })
      .catch(err => {
        console.error('Error:', err);
        showToast('❌ Failed to update topic status', 'error');
      });
  };

  window.toggleNoteChapterPremium = function(chapterIndex, isPremium) {
    const action = isPremium ? 'PREMIUM' : 'FREE';
    const confirmation = confirm(
      `Are you sure you want to make Note Chapter ${chapterIndex} ${action}?\n\nThis will affect ALL notes in this chapter.`
    );
    if (!confirmation) return;

    showToast('Updating note chapter status...', 'info');
    fetch('/admin/toggle-note-chapter-premium', {
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
          showToast(`✅ Note Chapter ${chapterIndex} is now ${action}!`, 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error('Update failed');
        }
      })
      .catch(err => {
        console.error('❌ Error toggling note chapter premium:', err);
        showToast('❌ Failed to update note chapter status', 'error');
      });
  };

  window.openSubscriptionModal = function(userId, username, currentStatus, currentExpiry) {
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
  };

  // ==================== DEVICE LOCK MANAGEMENT (NEW) ====================

  // Force logout (session only, NOT device lock)
  window.forceLogout = async function(userId, username) {
    if (!confirm(`Force logout ${username}?\n\nThis will clear their session (they'll need to re-login) but their device lock will remain active.`)) return;

    try {
      const response = await fetch('/admin/force-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`✅ ${data.message}`, 'success');
      } else {
        showToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Force logout error:', err);
      showToast('❌ Failed to force logout', 'error');
    }
  };

  // Clear device lock
  window.clearDeviceLock = async function(userId, username) {
    if (!confirm(`Clear device lock for ${username}?\n\nThis will allow them to login from ANY device. A new device lock will be created when they next login.`)) return;

    try {
      const response = await fetch('/admin/clear-device-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`🔓 ${data.message}`, 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        showToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Clear device lock error:', err);
      showToast('❌ Failed to clear device lock', 'error');
    }
  };

  // Quick clear by username
  window.quickClearDeviceLock = async function() {
    const usernameInput = document.getElementById('quickClearUsername');
    const username = usernameInput?.value?.trim();
    
    if (!username) {
      showToast('⚠️ Please enter a username', 'error');
      return;
    }

    if (!confirm(`Clear device lock for "${username}"?\n\nThey will be able to login from any device.`)) return;

    try {
      const response = await fetch(`/admin/clear-device-lock/${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        showToast(`🔓 ${data.message}`, 'success');
        usernameInput.value = '';
        loadDeviceLocks(); // Refresh the list
      } else {
        showToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Quick clear error:', err);
      showToast('❌ Failed to clear device lock', 'error');
    }
  };

  // Load all active device locks
  window.loadDeviceLocks = async function() {
    const container = document.getElementById('device-locks-list');
    if (!container) return;

    container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;"><span class="loading"></span> Loading device locks...</p>';

    try {
      const response = await fetch('/admin/device-locks');
      const data = await response.json();

      if (data.count === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No active device locks found.</p>';
        return;
      }

      container.innerHTML = `
        <p style="color: #00ff88; margin-bottom: 16px;">🔒 ${data.count} active device lock(s)</p>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Subscription</th>
              <th>Device</th>
              <th>Locked Since</th>
              <th>Expires</th>
              <th>Remaining</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.locks.map(lock => `
              <tr>
                <td><strong>${escapeHtml(lock.username)}</strong></td>
                <td>
                  ${lock.subscriptionStatus === 'premium' 
                    ? '<span style="color: #ffd700;">⭐ Premium</span>' 
                    : '<span style="color: #888;">Free</span>'}
                </td>
                <td><code style="font-size: 11px; color: #888;">${escapeHtml(lock.deviceFingerprint)}</code></td>
                <td>${new Date(lock.lockedAt).toLocaleDateString()}</td>
                <td>${new Date(lock.expiresAt).toLocaleDateString()}</td>
                <td>
                  <span style="color: ${lock.remainingDays <= 7 ? '#ffd700' : '#ff6b6b'}; font-weight: 600;">
                    ${lock.remainingDays} days
                  </span>
                </td>
                <td>
                  <button onclick="clearDeviceLock('${lock.userId}', '${escapeHtml(lock.username)}')" 
                          style="background: rgba(255,165,0,0.2); border-color: rgba(255,165,0,0.3);">
                    🔓 Clear Lock
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error('Error loading device locks:', err);
      container.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">❌ Failed to load device locks</p>';
    }
  };

  // Load active sessions
  window.loadActiveSessions = async function() {
    const container = document.getElementById('active-sessions-list');
    if (!container) return;

    container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;"><span class="loading"></span> Loading sessions...</p>';

    try {
      const response = await fetch('/admin/active-sessions');
      const data = await response.json();

      if (data.count === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No active sessions found.</p>';
        return;
      }

      container.innerHTML = `
        <p style="color: #00ff88; margin-bottom: 16px;">🟢 ${data.count} active session(s)</p>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Login Time</th>
              <th>Last Activity</th>
              <th>Session Expires</th>
              <th>Device Lock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.sessions.map(s => `
              <tr>
                <td><strong>${escapeHtml(s.username)}</strong></td>
                <td style="text-transform: capitalize;">${s.role === 'admin' ? '<span style="color: #ff6b9d;">👑 Admin</span>' : s.role}</td>
                <td>${new Date(s.loginTime).toLocaleString()}</td>
                <td>${new Date(s.lastActivity).toLocaleString()}</td>
                <td>${new Date(s.sessionExpiresAt).toLocaleDateString()}</td>
                <td>
                  ${s.hasDeviceLock 
                    ? `<span style="color: #ff6b6b;">🔒 Locked</span><br><small style="color: #888;">Until ${new Date(s.deviceLockExpiresAt).toLocaleDateString()}</small>`
                    : '<span style="color: #00ff88;">🔓 None</span>'}
                </td>
                <td>
                  <button onclick="forceLogout('${s.userId}', '${escapeHtml(s.username)}')" style="font-size: 12px;">🚪 Logout</button>
                  ${s.hasDeviceLock 
                    ? `<button onclick="clearDeviceLock('${s.userId}', '${escapeHtml(s.username)}')" style="font-size: 12px; background: rgba(255,165,0,0.2); border-color: rgba(255,165,0,0.3);">🔓 Clear Lock</button>` 
                    : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error('Error loading sessions:', err);
      container.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">❌ Failed to load sessions</p>';
    }
  };

  // ==================== TOPIC FUNCTIONS ====================
  window.openTopicEditModal = function(chapterIndex, topicIndex, topicName) {
    const ch = document.getElementById('edit-topic-chapter');
    const idx = document.getElementById('edit-topic-index');
    const name = document.getElementById('edit-topic-name');
    if (ch) ch.value = chapterIndex;
    if (idx) idx.value = topicIndex;
    if (name) name.value = topicName;
    openModal('edit-topic-modal');
  };

  window.openDeleteTopicModal = function(chapterIndex, topicIndex, topicName) {
    const ch = document.getElementById('delete-topic-chapter');
    const idx = document.getElementById('delete-topic-index');
    const name = document.getElementById('delete-topic-name');
    if (ch) ch.value = chapterIndex;
    if (idx) idx.value = topicIndex;
    if (name) name.textContent = topicName;
    openModal('delete-topic-modal');
  };

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
  window.viewFlashcards = async function(chapterIndex, topicIndex, topicName) {
    try {
      const response = await fetch(`/admin/flashcards/${chapterIndex}/${topicIndex}`);
      const flashcards = await response.json();

      const modalTitle = document.getElementById('flashcards-modal-title');
      if (modalTitle) modalTitle.textContent = `📋 Topic ${topicIndex}: ${topicName}`;

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
                ${card.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">🔒 Premium</span>' : ''}
              </div>
              <div>
                <button onclick="openEditFlashcardModal('${card._id}', \`${escapeForTemplate(card.question)}\`, \`${escapeForTemplate(card.answer)}\`)">
                  ✏️ Edit
                </button>
                <button onclick="openDeleteFlashcardModal('${card._id}', \`${escapeForTemplate(card.question)}\`)" class="danger">
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
  };

  // ==================== EDIT/DELETE FLASHCARD ====================
  window.openEditFlashcardModal = function(flashcardId, question, answer) {
    const id = document.getElementById('edit-flashcard-id');
    const q = document.getElementById('edit-flashcard-question');
    const a = document.getElementById('edit-flashcard-answer');
    if (id) id.value = flashcardId;
    if (q) q.value = question;
    if (a) a.value = answer;
    openModal('edit-flashcard-modal');
  };

  const editFlashcardForm = document.getElementById('edit-flashcard-form');
  if (editFlashcardForm) {
    editFlashcardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const id = document.getElementById('edit-flashcard-id');
      const question = document.getElementById('edit-flashcard-question');
      const answer = document.getElementById('edit-flashcard-answer');
      
      if (!id || !question || !answer) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      try {
        const response = await fetch('/admin/edit-flashcard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            flashcardId: id.value, 
            question: question.value, 
            answer: answer.value 
          })
        });

        if (response.ok) {
          closeModal('edit-flashcard-modal');
          showToast('Flashcard updated successfully!', 'success');
          const vfm = document.getElementById('view-flashcards-modal');
          const fs = document.getElementById('flashcards-section');
          if (vfm?.style.display === 'flex') closeModal('view-flashcards-modal');
          if (fs?.classList.contains('active')) loadAllFlashcards();
        } else {
          throw new Error('Failed to update');
        }
      } catch (error) {
        console.error('Error updating flashcard:', error);
        showToast('Failed to update flashcard', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Flashcard';
      }
    });
  }

  window.openDeleteFlashcardModal = function(flashcardId, question) {
    const deleteId = document.getElementById('delete-flashcard-id');
    const preview = document.getElementById('delete-flashcard-preview');
    if (deleteId) deleteId.value = flashcardId;
    if (preview) preview.textContent = `"${question}"`;
    openModal('delete-flashcard-modal');
  };

  window.confirmDeleteFlashcard = async function() {
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
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      showToast('Failed to delete flashcard', 'error');
    }
  };

  // ==================== ALL FLASHCARDS ====================
  async function loadAllFlashcards() {
    const listContainer = document.getElementById('all-flashcards-list');
    if (listContainer) {
      listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;"><span class="loading"></span> Loading flashcards...</p>';
    }

    try {
      const response = await fetch('/admin/flashcards');
      allFlashcards = await response.json();
      displayFlashcards(allFlashcards);
      updateFilterOptions();
    } catch (err) {
      console.error('Error loading flashcards:', err);
      if (listContainer) {
        listContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">❌ Failed to load flashcards</p>';
      }
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
            ${card.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">🔒 Premium</span>' : '<span style="color: #00ff88; margin-left: 8px;">🔓 Free</span>'}
            <br><small style="color: #888;">${escapeHtml(card.chapterName)} → ${escapeHtml(card.topicName)}</small>
          </div>
          <div>
            <button onclick="openEditFlashcardModal('${card._id}', \`${escapeForTemplate(card.question)}\`, \`${escapeForTemplate(card.answer)}\`)">
              ✏️ Edit
            </button>
            <button onclick="openDeleteFlashcardModal('${card._id}', \`${escapeForTemplate(card.question)}\`)" class="danger">
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

  window.filterFlashcards = function() {
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
  };

  // ==================== NOTES MANAGEMENT ====================

  async function loadAllNotes() {
    const listContainer = document.getElementById('all-notes-list');
    if (listContainer) {
      listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;"><span class="loading"></span> Loading notes...</p>';
    }

    try {
      const response = await fetch('/admin/notes');
      allNotes = await response.json();
      displayNotes(allNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
      if (listContainer) {
        listContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">❌ Failed to load notes</p>';
      }
    }
  }

  function displayNotes(notes) {
    const listContainer = document.getElementById('all-notes-list');
    if (!listContainer) return;

    if (notes.length === 0) {
      listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No notes found. Add your first note!</p>';
      return;
    }
    
    listContainer.innerHTML = notes.map(note => `
      <div class="flashcard-item" style="background: rgba(255,215,0,0.03);">
        <div class="flashcard-header">
          <div>
            <strong>Chapter ${note.chapterIndex}, Topic ${note.topicIndex}</strong>
            ${note.isPremium ? '<span style="color: #ffd700; margin-left: 8px;">🔒 Premium</span>' : '<span style="color: #00ff88; margin-left: 8px;">🔓 Free</span>'}
            <br><small style="color: #888;">${escapeHtml(note.chapterName)} → ${escapeHtml(note.topicName)}</small>
            <br><strong style="color: #ffd700;">📝 ${escapeHtml(note.noteTitle)}</strong>
          </div>
          <div>
            <a href="/notes/chapter/${note.chapterIndex}/topic/${note.topicIndex}" target="_blank" style="display: inline-block; padding: 8px 16px; background: rgba(79,70,229,0.2); border: 1px solid rgba(79,70,229,0.3); border-radius: 8px; color: #fff; text-decoration: none; margin-right: 8px;">
              👁️ View
            </a>
            <button onclick="openEditNoteModalById('${note._id}')">
              ✏️ Edit
            </button>
            <button onclick="openDeleteNoteModal('${note._id}', \`${escapeForTemplate(note.noteTitle)}\`)" class="danger">
              🗑️ Delete
            </button>
          </div>
        </div>
        <div class="flashcard-content">
          <strong>Created:</strong> ${new Date(note.createdAt).toLocaleDateString()}
          ${note.updatedAt !== note.createdAt ? ` | <strong>Updated:</strong> ${new Date(note.updatedAt).toLocaleDateString()}` : ''}
        </div>
      </div>
    `).join('');
  }

  window.openEditNoteModal = function(noteId, title, htmlContent, isPremium) {
    const id = document.getElementById('edit-note-id');
    const titleEl = document.getElementById('edit-note-title');
    const content = document.getElementById('edit-note-content');
    const premium = document.getElementById('edit-note-premium');
    
    if (id) id.value = noteId;
    if (titleEl) titleEl.value = title;
    if (content) content.value = htmlContent;
    if (premium) premium.checked = isPremium;
    
    openModal('edit-note-modal');
  };

  window.openEditNoteModalById = async function(noteId) {
    try {
      const note = allNotes.find(n => n._id === noteId);
      
      if (!note) {
        showToast('Note not found', 'error');
        return;
      }
      
      openEditNoteModal(note._id, note.noteTitle, note.htmlContent, note.isPremium);
    } catch (error) {
      console.error('Error opening note modal:', error);
      showToast('Failed to open note editor', 'error');
    }
  };

  window.filterNotes = function() {
    const chapterFilter = document.getElementById('filterNoteChapter')?.value;
    let filtered = allNotes;

    if (chapterFilter) {
      filtered = filtered.filter(n => n.chapterIndex == chapterFilter);
    }
    displayNotes(filtered);
  };

  const editNoteForm = document.getElementById('edit-note-form');
  if (editNoteForm) {
    editNoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const id = document.getElementById('edit-note-id');
      const title = document.getElementById('edit-note-title');
      const content = document.getElementById('edit-note-content');
      const premium = document.getElementById('edit-note-premium');
      
      if (!id || !title || !content) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      try {
        const response = await fetch('/admin/edit-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            noteId: id.value, 
            noteTitle: title.value, 
            htmlContent: content.value,
            isPremium: premium.checked
          })
        });

        if (response.ok) {
          closeModal('edit-note-modal');
          showToast('Note updated successfully!', 'success');
          loadAllNotes();
        } else {
          throw new Error('Update failed');
        }
      } catch (error) {
        console.error('Error updating note:', error);
        showToast('Failed to update note', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Note';
      }
    });
  }

  window.openDeleteNoteModal = function(noteId, title) {
    const deleteId = document.getElementById('delete-note-id');
    const preview = document.getElementById('delete-note-preview');
    if (deleteId) deleteId.value = noteId;
    if (preview) preview.textContent = `"${title}"`;
    openModal('delete-note-modal');
  };

  window.confirmDeleteNote = async function() {
    const deleteId = document.getElementById('delete-note-id');
    if (!deleteId) return;

    try {
      const response = await fetch('/admin/delete-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: deleteId.value })
      });
      
      if (response.ok) {
        closeModal('delete-note-modal');
        showToast('Note deleted successfully!', 'success');
        loadAllNotes();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Failed to delete note', 'error');
    }
  };

  // ==================== NOTE FORM HELPERS ====================

  window.fillNoteChapterName = function() {
    const sel = document.getElementById("noteChapterIndex");
    if (!sel) return;
    const text = sel.options[sel.selectedIndex]?.text;
    document.getElementById("noteChapterName").value = chapterTextToName(text);
    document.getElementById("noteNewChapterName").value = "";
    document.getElementById("noteNewChapterIndex").value = "";
  };

  window.fillNoteTopicName = function() {
    const sel = document.getElementById("noteTopicIndex");
    if (!sel) return;
    const option = sel.options[sel.selectedIndex];
    document.getElementById("noteTopicName").value = topicOptionToName(option);
    document.getElementById("noteNewTopicName").value = "";
    document.getElementById("noteNewTopicIndex").value = "";
  };

  const noteNewChapterNameEl = document.getElementById("noteNewChapterName");
  if (noteNewChapterNameEl) {
    noteNewChapterNameEl.addEventListener("input", (e) => {
      const name = e.target.value.trim();
      const newIndexEl = document.getElementById("noteNewChapterIndex");
      const chapterNameEl = document.getElementById("noteChapterName");
      const chapterSel = document.getElementById("noteChapterIndex");
      
      if (name) {
        const maxIndex = noteChapters.length ? Math.max(...noteChapters.map(c => c._id)) : 0;
        if (newIndexEl) newIndexEl.value = maxIndex + 1;
        if (chapterNameEl) chapterNameEl.value = name;
        if (chapterSel) chapterSel.selectedIndex = 0;
      } else {
        if (newIndexEl) newIndexEl.value = "";
        if (chapterNameEl) chapterNameEl.value = "";
      }
    });
  }

  const noteNewTopicNameEl = document.getElementById("noteNewTopicName");
if (noteNewTopicNameEl) {
  noteNewTopicNameEl.addEventListener("input", (e) => {
    const name = e.target.value.trim();
    const newIndexEl = document.getElementById("noteNewTopicIndex");
    const topicNameEl = document.getElementById("noteTopicName");
    const newChIdxEl = document.getElementById("noteNewChapterIndex");
    const chapterSel = document.getElementById("noteChapterIndex");
    const topicSel = document.getElementById("noteTopicIndex");
    
    if (name) {
      const chIdx = parseInt(newChIdxEl?.value) || parseInt(chapterSel?.value);
      if (chIdx) {
        const relatedTopics = noteTopics.filter(t => t._id.chapterIndex === chIdx);
        
        if (newIndexEl) {
          const currentValue = newIndexEl.value;
          if (!currentValue || currentValue === '') {
            const existingIndices = relatedTopics.map(t => t._id.topicIndex);
            const nextIndex = findNextAvailableIndex(existingIndices);
            newIndexEl.value = nextIndex;
            newIndexEl.placeholder = `Suggested: ${nextIndex}`;
            newIndexEl.style.color = '#888';
          }
        }
        
        if (topicNameEl) topicNameEl.value = name;
        if (topicSel) topicSel.selectedIndex = 0;
      } else {
        showToast("Please select or create a chapter first", "error");
        e.target.value = "";
      }
    } else {
      if (newIndexEl && newIndexEl.style.color === 'rgb(136, 136, 136)') {
        newIndexEl.value = "";
        newIndexEl.placeholder = "Auto";
      }
      if (topicNameEl) topicNameEl.value = "";
    }
  });
}

const noteNewTopicIndexEl = document.getElementById("noteNewTopicIndex");
if (noteNewTopicIndexEl) {
  noteNewTopicIndexEl.addEventListener("input", (e) => {
    if (e.target.value) {
      e.target.style.color = '#fff';
      e.target.style.fontWeight = '700';
      e.target.placeholder = "Manual";
    } else {
      e.target.style.color = '#888';
      e.target.style.fontWeight = '400';
      e.target.placeholder = "Auto";
    }
  });
}

  // ==================== SEARCH ====================
  window.performSearch = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const input = document.getElementById('globalSearch');
      if (!input) return;
      const query = input.value.toLowerCase().trim();
      
      if (!query) {
        clearSearch();
        return;
      }
      
      if (allFlashcards.length > 0) {
        const flashcardResults = allFlashcards.filter(f =>
          f.question.toLowerCase().includes(query) ||
          f.answer.toLowerCase().includes(query) ||
          f.chapterName.toLowerCase().includes(query) ||
          f.topicName.toLowerCase().includes(query)
        );
        if (flashcardResults.length > 0) {
          showSection('flashcards');
          displayFlashcards(flashcardResults);
          showToast(`Found ${flashcardResults.length} flashcard(s)`, 'info');
          return;
        }
      }
      
      if (allNotes.length > 0) {
        const noteResults = allNotes.filter(n =>
          n.noteTitle.toLowerCase().includes(query) ||
          n.chapterName.toLowerCase().includes(query) ||
          n.topicName.toLowerCase().includes(query) ||
          n.htmlContent.toLowerCase().includes(query)
        );
        if (noteResults.length > 0) {
          showSection('notes');
          displayNotes(noteResults);
          showToast(`Found ${noteResults.length} note(s)`, 'info');
          return;
        }
      }
      
      showToast('No results found', 'info');
    }, 300);
  };

  window.clearSearch = function() {
    const input = document.getElementById('globalSearch');
    if (input) input.value = '';
    const flashcardsSection = document.getElementById('flashcards-section');
    const notesSection = document.getElementById('notes-section');
    if (flashcardsSection?.classList.contains('active')) {
      displayFlashcards(allFlashcards);
    }
    if (notesSection?.classList.contains('active')) {
      displayNotes(allNotes);
    }
  };

  // ==================== CHAPTER/TOPIC SELECTION HELPERS ====================

  function chapterTextToName(text) {
    if (!text) return "";
    const dash = text.match(/[—–-]/);
    if (dash) return text.split(dash[0])[1]?.trim() || "";
    return text.trim();
  }

  function topicOptionToName(option) {
    return option?.dataset?.name || option?.text?.trim() || "";
  }

  window.fillChapterName = function() {
    const sel = document.getElementById("chapterIndex");
    if (!sel) return;
    const text = sel.options[sel.selectedIndex]?.text;
    document.getElementById("chapterName").value = chapterTextToName(text);
    document.getElementById("newChapterName").value = "";
    document.getElementById("newChapterIndex").value = "";
  };

  window.fillTopicName = function() {
    const sel = document.getElementById("topicIndex");
    if (!sel) return;
    const option = sel.options[sel.selectedIndex];
    document.getElementById("topicName").value = topicOptionToName(option);
    document.getElementById("newTopicName").value = "";
    document.getElementById("newTopicIndex").value = "";
  };

  window.fillBulkChapterName = function() {
    const sel = document.getElementById("bulkChapterIndex");
    if (!sel) return;
    const text = sel.options[sel.selectedIndex]?.text;
    document.getElementById("bulkChapterName").value = chapterTextToName(text);
    document.getElementById("bulknewChapterName").value = "";
    document.getElementById("bulknewChapterIndex").value = "";
  };

  window.fillBulkTopicName = function() {
    const sel = document.getElementById("bulkTopicIndex");
    if (!sel) return;
    const option = sel.options[sel.selectedIndex];
    document.getElementById("bulkTopicName").value = topicOptionToName(option);
    document.getElementById("bulknewTopicName").value = "";
    document.getElementById("bulknewTopicIndex").value = "";
  };

  // ==================== INPUT HANDLERS ====================
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
        
        if (newIndexEl) {
          const currentValue = newIndexEl.value;
          if (!currentValue || currentValue === '') {
            const existingIndices = relatedTopics.map(t => t._id.topicIndex);
            const nextIndex = findNextAvailableIndex(existingIndices);
            newIndexEl.value = nextIndex;
            newIndexEl.placeholder = `Suggested: ${nextIndex}`;
            newIndexEl.style.color = '#888';
          }
        }
        
        if (topicNameEl) topicNameEl.value = name;
        if (topicSel) topicSel.selectedIndex = 0;
      } else {
        showToast("Please select or create a chapter first", "error");
        e.target.value = "";
      }
    } else {
      if (newIndexEl && newIndexEl.style.color === 'rgb(136, 136, 136)') {
        newIndexEl.value = "";
        newIndexEl.placeholder = "Auto";
      }
      if (topicNameEl) topicNameEl.value = "";
    }
  });
}

const newTopicIndexEl = document.getElementById("newTopicIndex");
if (newTopicIndexEl) {
  newTopicIndexEl.addEventListener("input", (e) => {
    if (e.target.value) {
      e.target.style.color = '#fff';
      e.target.style.fontWeight = '700';
      e.target.placeholder = "Manual";
    } else {
      e.target.style.color = '#888';
      e.target.style.fontWeight = '400';
      e.target.placeholder = "Auto";
    }
  });

  newTopicIndexEl.addEventListener("keydown", (e) => {
    if (e.key === 'Backspace' && e.target.value.length === 1) {
      e.target.value = "";
      e.target.style.color = '#888';
      e.target.placeholder = "Auto";
    }
  });
}

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
        
        if (newIndexEl) {
          const currentValue = newIndexEl.value;
          if (!currentValue || currentValue === '') {
            const existingIndices = related.map(t => t._id.topicIndex);
            const nextIndex = findNextAvailableIndex(existingIndices);
            newIndexEl.value = nextIndex;
            newIndexEl.placeholder = `Suggested: ${nextIndex}`;
            newIndexEl.style.color = '#888';
          }
        }
        
        if (topicNameEl) topicNameEl.value = name;
        if (topicSel) topicSel.selectedIndex = 0;
      } else {
        showToast("Please select or create a chapter first", "error");
        e.target.value = "";
      }
    } else {
      if (newIndexEl && newIndexEl.style.color === 'rgb(136, 136, 136)') {
        newIndexEl.value = "";
        newIndexEl.placeholder = "Auto";
      }
      if (topicNameEl) topicNameEl.value = "";
    }
  });
}

const bulkNewTopicIndexEl = document.getElementById("bulknewTopicIndex");
if (bulkNewTopicIndexEl) {
  bulkNewTopicIndexEl.addEventListener("input", (e) => {
    if (e.target.value) {
      e.target.style.color = '#fff';
      e.target.style.fontWeight = '700';
      e.target.placeholder = "Manual";
    } else {
      e.target.style.color = '#888';
      e.target.style.fontWeight = '400';
      e.target.placeholder = "Auto";
    }
  });
}

  // ==================== FORM VALIDATION ====================
  const flashcardForm = document.getElementById('add-flashcard-form');
  if (flashcardForm) {
    flashcardForm.addEventListener("submit", (e) => {
      const submitBtn = flashcardForm.querySelector('button[type="submit"]');
      const chapterName = document.getElementById("chapterName")?.value.trim();
      const topicName = document.getElementById("topicName")?.value.trim();
      const newChapterName = document.getElementById("newChapterName")?.value.trim();
      const newTopicName = document.getElementById("newTopicName")?.value.trim();

      const chapterOk = chapterName || newChapterName;
      const topicOk = topicName || newTopicName;
      
      if (!chapterOk || !topicOk) {
        e.preventDefault();
        showToast("Please select or enter both a Chapter and a Topic", "error");
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';
    });
  }

  // ==================== USER MANAGEMENT ====================
  window.openDeleteUserModal = function(userId, username) {
    const userIdEl = document.getElementById("delete-user-id");
    const userNameEl = document.getElementById("delete-user-name");
    if (userIdEl) userIdEl.value = userId;
    if (userNameEl) userNameEl.textContent = username;
    openModal("delete-user-modal");
  };

  // ==================== EXPORT ====================
  window.exportAllData = async function() {
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
  };

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
    console.log('✅ Admin panel initialized with Premium + Notes + Device Lock features');

    const chapterIndexEl = document.getElementById("chapterIndex");
    if (chapterIndexEl) chapterIndexEl.addEventListener("change", fillChapterName);
    
    const topicIndexEl = document.getElementById("topicIndex");
    if (topicIndexEl) topicIndexEl.addEventListener("change", fillTopicName);
    
    const bulkChapterIndexEl = document.getElementById("bulkChapterIndex");
    if (bulkChapterIndexEl) bulkChapterIndexEl.addEventListener("change", fillBulkChapterName);
    
    const bulkTopicIndexEl = document.getElementById("bulkTopicIndex");
    if (bulkTopicIndexEl) bulkTopicIndexEl.addEventListener("change", fillBulkTopicName);
    
    const noteChapterIndexEl = document.getElementById("noteChapterIndex");
    if (noteChapterIndexEl) noteChapterIndexEl.addEventListener("change", fillNoteChapterName);
    
    const noteTopicIndexEl = document.getElementById("noteTopicIndex");
    if (noteTopicIndexEl) noteTopicIndexEl.addEventListener("change", fillNoteTopicName);
  });


// ==================== BULK UPLOAD FILE/TEXT TOGGLE ====================
document.addEventListener('DOMContentLoaded', () => {
  const bulkMethodFile = document.getElementById('bulkMethodFile');
  const bulkMethodText = document.getElementById('bulkMethodText');
  const bulkFileSection = document.getElementById('bulkFileUploadSection');
  const bulkTextSection = document.getElementById('bulkTextUploadSection');
  const bulkJsonFile = document.getElementById('bulkJsonFile');
  const bulkJsonData = document.getElementById('bulkJsonData');

  if (bulkMethodFile && bulkMethodText) {
    bulkMethodFile.addEventListener('change', () => {
      if (bulkFileSection) bulkFileSection.style.display = 'block';
      if (bulkTextSection) bulkTextSection.style.display = 'none';
      if (bulkJsonData) bulkJsonData.removeAttribute('required');
      if (bulkJsonFile) bulkJsonFile.setAttribute('required', 'required');
      bulkMethodFile.parentElement.style.background = 'rgba(79,70,229,0.2)';
      bulkMethodFile.parentElement.style.borderColor = 'rgba(79,70,229,0.5)';
      bulkMethodText.parentElement.style.background = 'rgba(255,255,255,0.05)';
      bulkMethodText.parentElement.style.borderColor = 'rgba(255,255,255,0.2)';
    });

    bulkMethodText.addEventListener('change', () => {
      if (bulkFileSection) bulkFileSection.style.display = 'none';
      if (bulkTextSection) bulkTextSection.style.display = 'block';
      if (bulkJsonFile) bulkJsonFile.removeAttribute('required');
      if (bulkJsonData) bulkJsonData.setAttribute('required', 'required');
      bulkMethodText.parentElement.style.background = 'rgba(79,70,229,0.2)';
      bulkMethodText.parentElement.style.borderColor = 'rgba(79,70,229,0.5)';
      bulkMethodFile.parentElement.style.background = 'rgba(255,255,255,0.05)';
      bulkMethodFile.parentElement.style.borderColor = 'rgba(255,255,255,0.2)';
    });
  }

  if (bulkJsonFile) {
    bulkJsonFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById('bulkFilePreview');
      const fileName = document.getElementById('bulkFileName');
      const fileInfo = document.getElementById('bulkFileInfo');

      if (file) {
        if (!file.name.endsWith('.json')) {
          showToast('⚠️ Please select a valid JSON file', 'error');
          e.target.value = '';
          if (preview) preview.style.display = 'none';
          return;
        }
        if (fileName) fileName.textContent = file.name;
        if (fileInfo) fileInfo.textContent = `Size: ${(file.size / 1024).toFixed(2)} KB | Type: ${file.type || 'application/json'}`;
        if (preview) preview.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const jsonData = JSON.parse(event.target.result);
            if (Array.isArray(jsonData)) {
              showToast(`✅ Valid JSON with ${jsonData.length} flashcard(s)`, 'success');
            } else {
              showToast('⚠️ JSON must be an array of objects', 'error');
            }
          } catch (err) {
            showToast('⚠️ Invalid JSON format', 'error');
          }
        };
        reader.readAsText(file);
      } else {
        if (preview) preview.style.display = 'none';
      }
    });
  }

  // Note upload toggle
  const noteMethodFile = document.getElementById('noteMethodFile');
  const noteMethodText = document.getElementById('noteMethodText');
  const noteFileSection = document.getElementById('noteFileUploadSection');
  const noteTextSection = document.getElementById('noteTextUploadSection');
  const noteHtmlFile = document.getElementById('noteHtmlFile');
  const noteHtmlContent = document.getElementById('noteHtmlContent');

  if (noteMethodFile && noteMethodText) {
    noteMethodFile.addEventListener('change', () => {
      if (noteFileSection) noteFileSection.style.display = 'block';
      if (noteTextSection) noteTextSection.style.display = 'none';
      if (noteHtmlContent) noteHtmlContent.removeAttribute('required');
      if (noteHtmlFile) noteHtmlFile.setAttribute('required', 'required');
      noteMethodFile.parentElement.style.background = 'rgba(255,215,0,0.2)';
      noteMethodFile.parentElement.style.borderColor = 'rgba(255,215,0,0.5)';
      noteMethodText.parentElement.style.background = 'rgba(255,255,255,0.05)';
      noteMethodText.parentElement.style.borderColor = 'rgba(255,255,255,0.2)';
    });

    noteMethodText.addEventListener('change', () => {
      if (noteFileSection) noteFileSection.style.display = 'none';
      if (noteTextSection) noteTextSection.style.display = 'block';
      if (noteHtmlFile) noteHtmlFile.removeAttribute('required');
      if (noteHtmlContent) noteHtmlContent.setAttribute('required', 'required');
      noteMethodText.parentElement.style.background = 'rgba(255,215,0,0.2)';
      noteMethodText.parentElement.style.borderColor = 'rgba(255,215,0,0.5)';
      noteMethodFile.parentElement.style.background = 'rgba(255,255,255,0.05)';
      noteMethodFile.parentElement.style.borderColor = 'rgba(255,255,255,0.2)';
    });
  }

  if (noteHtmlFile) {
    noteHtmlFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById('noteFilePreview');
      const fileName = document.getElementById('noteFileName');
      const fileInfo = document.getElementById('noteFileInfo');

      if (file) {
        if (!file.name.match(/\.(html|htm)$/i)) {
          showToast('⚠️ Please select a valid HTML file', 'error');
          e.target.value = '';
          if (preview) preview.style.display = 'none';
          return;
        }
        if (fileName) fileName.textContent = file.name;
        if (fileInfo) fileInfo.textContent = `Size: ${(file.size / 1024).toFixed(2)} KB | Type: ${file.type || 'text/html'}`;
        if (preview) preview.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          if (content.toLowerCase().includes('<html') && content.toLowerCase().includes('<body')) {
            showToast('✅ Valid HTML file detected', 'success');
          } else {
            showToast('⚠️ HTML file may be incomplete (missing <html> or <body> tags)', 'error');
          }
        };
        reader.readAsText(file);
      } else {
        if (preview) preview.style.display = 'none';
      }
    });
  }

  // Form submission handlers
  const bulkUploadForm = document.getElementById('bulk-upload-form');
  if (bulkUploadForm) {
    bulkUploadForm.addEventListener('submit', (e) => {
      const submitBtn = document.getElementById('bulk-submit-btn');
      const method = document.querySelector('input[name="bulkUploadMethod"]:checked')?.value;
      const fileInput = document.getElementById('bulkJsonFile');
      const textInput = document.getElementById('bulkJsonData');
      
      const chapterName = document.getElementById("bulkChapterName")?.value.trim();
      const topicName = document.getElementById("bulkTopicName")?.value.trim();
      const newChapterName = document.getElementById("bulknewChapterName")?.value.trim();
      const newTopicName = document.getElementById("bulknewTopicName")?.value.trim();

      if (!(chapterName || newChapterName) || !(topicName || newTopicName)) {
        e.preventDefault();
        showToast("Please select or enter both a Chapter and a Topic", "error");
        return;
      }

      if (method === 'file') {
        if (!fileInput?.files?.length) {
          e.preventDefault();
          showToast('⚠️ Please select a JSON file to upload', 'error');
          return;
        }
        if (textInput) textInput.value = '';
      } else if (method === 'text') {
        if (!textInput?.value.trim()) {
          e.preventDefault();
          showToast('⚠️ Please paste JSON data', 'error');
          return;
        }
        if (fileInput) fileInput.value = '';
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Uploading...';
      }
    });
  }

  const addNoteForm = document.getElementById('add-note-form');
  if (addNoteForm) {
    addNoteForm.addEventListener('submit', (e) => {
      const submitBtn = document.getElementById('note-submit-btn');
      const method = document.querySelector('input[name="noteUploadMethod"]:checked')?.value;
      const fileInput = document.getElementById('noteHtmlFile');
      const textInput = document.getElementById('noteHtmlContent');
      const titleInput = document.getElementById('noteTitle');
      
      if (!titleInput?.value.trim()) {
        e.preventDefault();
        showToast('⚠️ Please enter a note title', 'error');
        return;
      }

      const chapterName = document.getElementById("noteChapterName")?.value.trim();
      const topicName = document.getElementById("noteTopicName")?.value.trim();
      const newChapterName = document.getElementById("noteNewChapterName")?.value.trim();
      const newTopicName = document.getElementById("noteNewTopicName")?.value.trim();

      if (!(chapterName || newChapterName) || !(topicName || newTopicName)) {
        e.preventDefault();
        showToast("Please select or enter both a Chapter and a Topic", "error");
        return;
      }

      if (method === 'file') {
        if (!fileInput?.files?.length) {
          e.preventDefault();
          showToast('⚠️ Please select an HTML file to upload', 'error');
          return;
        }
        if (textInput) textInput.value = '';
      } else if (method === 'text') {
        if (!textInput?.value.trim()) {
          e.preventDefault();
          showToast('⚠️ Please paste HTML content', 'error');
          return;
        }
        if (fileInput) fileInput.value = '';
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Adding Note...';
      }
    });
  }
});

console.log('✅ File upload + Device Lock handlers initialized');

})();
