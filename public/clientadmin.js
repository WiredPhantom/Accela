(function() {
  'use strict';

  console.log("✅ Enhanced clientadmin.js loaded (Premium + Notes Edition)");

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
      const topicNameEl = 