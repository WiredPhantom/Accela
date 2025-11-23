console.log("clientadmin.js loaded");

const chapters = window.chapters;
const topics = window.topics;

function fillBulkChapterName() {
  const sel = document.getElementById("bulkChapterIndex");
  const selected = sel.options[sel.selectedIndex];
  if (selected?.text.includes("—")) {
    document.getElementById("bulkChapterName").value = selected.text.split("—")[1].trim();
  }
}

function fillBulkTopicName() {
  const sel = document.getElementById("bulkTopicIndex");
  const selected = sel.options[sel.selectedIndex];
  if (selected) {
    document.getElementById("bulkTopicName").value = selected.dataset.name;
  }
}

document.getElementById("bulknewChapterName").addEventListener("input", () => {
  const max = chapters.length ? Math.max(...chapters.map(c => c._id)) : 0;
  document.getElementById("bulknewChapterIndex").value = max + 1;

  document.getElementById("bulkChapterIndex").selectedIndex = 0;
  document.getElementById("bulkChapterName").value = document.getElementById("bulknewChapterName").value.trim();
});

document.getElementById("bulknewTopicName").addEventListener("input", () => {
  const chapterIndex = +document.getElementById("bulknewChapterIndex").value || +document.getElementById("bulkChapterIndex").value;
  const filtered = topics.filter(tp => tp._id.chapterIndex === chapterIndex);
  const max = filtered.length ? Math.max(...filtered.map(tp => tp._id.topicIndex)) : 0;
  document.getElementById("bulknewTopicIndex").value = max + 1;

  document.getElementById("bulkTopicIndex").selectedIndex = 0;
  document.getElementById("bulkTopicName").value = document.getElementById("bulknewTopicName").value.trim();
});

function openTopicEditModal(chapterIndex, topicIndex, topicName) {
  document.getElementById('edit-topic-modal').style.display = 'block';
  document.getElementById('edit-topic-chapter').value = chapterIndex;
  document.getElementById('edit-topic-index').value = topicIndex;
  document.getElementById('edit-topic-name').value = topicName;
}

function openDeleteTopicModal(chapterIndex, topicIndex, topicName) {
  document.getElementById('delete-topic-modal').style.display = 'block';
  document.getElementById('delete-topic-chapter').value = chapterIndex;
  document.getElementById('delete-topic-index').value = topicIndex;
  document.getElementById('delete-topic-name').textContent = topicName;
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function openEditChapterModal(index, name) {
  document.getElementById('edit-chapter-modal').style.display = 'block';
  document.getElementById('edit-old-chapter-index').value = index;
  document.getElementById('edit-new-chapter-name').value = name;
}

function openDeleteChapterModal(index) {
  document.getElementById('delete-chapter-modal').style.display = 'block';
  document.getElementById('delete-chapter-index').value = index;
  document.getElementById('delete-chapter-number').textContent = index;
}

function fillChapterName() {
  const sel = document.getElementById("chapterIndex");
  const text = sel.options[sel.selectedIndex]?.text;
  if (text?.includes("—")) {
    const name = text.split("—")[1].trim();
    document.getElementById("chapterName").value = name;
  }

  document.getElementById("newChapterName").value = "";
  document.getElementById("newChapterIndex").value = "";
}

function fillTopicName() {
  const sel = document.getElementById("topicIndex");
  const name = sel.options[sel.selectedIndex]?.dataset.name;
  if (name) {
    document.getElementById("topicName").value = name;
  }

  document.getElementById("newTopicName").value = "";
  document.getElementById("newTopicIndex").value = "";
}

document.getElementById("newChapterName").addEventListener("input", (e) => {
  const name = e.target.value.trim();
  const index = chapters.length ? Math.max(...chapters.map(c => c._id)) + 1 : 1;
  document.getElementById("newChapterIndex").value = name ? index : "";

  document.getElementById("chapterIndex").selectedIndex = 0;
  document.getElementById("chapterName").value = name;
});

document.getElementById("newTopicName").addEventListener("input", (e) => {
  const name = e.target.value.trim();
  const chIdx = +document.getElementById("newChapterIndex").value || +document.getElementById("chapterIndex").value;
  const relatedTopics = topics.filter(t => t._id.chapterIndex === chIdx);
  const index = relatedTopics.length ? Math.max(...relatedTopics.map(t => t._id.topicIndex)) + 1 : 1;

  document.getElementById("newTopicIndex").value = name ? index : "";

  document.getElementById("topicIndex").selectedIndex = 0;
  document.getElementById("topicName").value = name;
});

const flashcardForm = document.querySelector('form[action="/admin/add-flashcard"]');

if (flashcardForm) {
  flashcardForm.addEventListener("submit", (e) => {
    const chSel = document.getElementById("chapterIndex");
    const chText = chSel.options[chSel.selectedIndex]?.text || "";
    if (chText.includes("—")) {
      document.getElementById("chapterName").value = chText.split("—")[1].trim();
    }

    const tpSel = document.getElementById("topicIndex");
    const tpData = tpSel.options[tpSel.selectedIndex]?.dataset;
    if (tpData?.name) {
      document.getElementById("topicName").value = tpData.name;
    }

    const chapterName = document.getElementById("chapterName").value.trim();
    const topicName = document.getElementById("topicName").value.trim();
    const newChapterName = document.getElementById("newChapterName").value.trim();
    const newTopicName = document.getElementById("newTopicName").value.trim();

    const chapterOk = chapterName || newChapterName;
    const topicOk = topicName || newTopicName;

    if (!chapterOk || !topicOk) {
      e.preventDefault();
      alert("Please select or enter both a Chapter and a Topic before submitting.");
    }
  });
}

function openModal(id) {
  document.getElementById(id).style.display = 'block';
}

function openDeleteUserModal(userId, username) {
  document.getElementById("delete-user-id").value = userId;
  document.getElementById("delete-user-name").innerText = username;
  openModal("delete-user-modal");
}

// NEW: View flashcards for a topic
async function viewFlashcards(chapterIndex, topicIndex, topicName) {
  try {
    const response = await fetch(`/admin/flashcards/${chapterIndex}/${topicIndex}`);
    const flashcards = await response.json();
    
    const modalTitle = document.getElementById('flashcards-modal-title');
    modalTitle.textContent = `Flashcards - Topic ${topicIndex}: ${topicName}`;
    
    const listContainer = document.getElementById('flashcards-list');
    
    if (flashcards.length === 0) {
      listContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No flashcards found for this topic.</p>';
    } else {
      listContainer.innerHTML = flashcards.map((card, index) => `
        <div style="
          background: rgba(40, 40, 60, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 12px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <strong style="color: #a8b3ff;">Card ${card.flashcardIndex}</strong>
            <div>
              <button onclick="openEditFlashcardModal('${card._id}', \`${card.question.replace(/`/g, '\\`')}\`, \`${card.answer.replace(/`/g, '\\`')}\`)" 
                style="padding: 6px 12px; font-size: 13px; margin-right: 8px;">
                ✏️ Edit
              </button>
              <button onclick="openDeleteFlashcardModal('${card._id}', \`${card.question.replace(/`/g, '\\`')}\`)" 
                class="danger" style="padding: 6px 12px; font-size: 13px;">
                🗑️ Delete
              </button>
            </div>
          </div>
          <div style="margin-bottom: 8px;">
            <strong style="color: #b8bec8;">Q:</strong> 
            <span style="color: #e8eaed;">${card.question}</span>
          </div>
          <div>
            <strong style="color: #b8bec8;">A:</strong> 
            <span style="color: #e8eaed;">${card.answer}</span>
          </div>
        </div>
      `).join('');
    }
    
    openModal('view-flashcards-modal');
  } catch (error) {
    console.error('Error fetching flashcards:', error);
    alert('Failed to load flashcards');
  }
}

// NEW: Open edit flashcard modal
function openEditFlashcardModal(flashcardId, question, answer) {
  document.getElementById('edit-flashcard-id').value = flashcardId;
  document.getElementById('edit-flashcard-question').value = question;
  document.getElementById('edit-flashcard-answer').value = answer;
  openModal('edit-flashcard-modal');
}

// NEW: Handle edit flashcard form submission
document.getElementById('edit-flashcard-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const flashcardId = document.getElementById('edit-flashcard-id').value;
  const question = document.getElementById('edit-flashcard-question').value;
  const answer = document.getElementById('edit-flashcard-answer').value;
  
  try {
    const response = await fetch('/admin/edit-flashcard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flashcardId, question, answer })
    });
    
    if (response.ok) {
      closeModal('edit-flashcard-modal');
      // Reload the flashcards view if it's open
      const modalTitle = document.getElementById('flashcards-modal-title').textContent;
      if (modalTitle.includes('Topic')) {
        // Extract topic info from modal and refresh
        alert('Flashcard updated successfully! Close and reopen the topic to see changes.');
      } else {
        alert('Flashcard updated successfully!');
      }
    } else {
      alert('Failed to update flashcard');
    }
  } catch (error) {
    console.error('Error updating flashcard:', error);
    alert('Failed to update flashcard');
  }
});

// NEW: Open delete flashcard modal
function openDeleteFlashcardModal(flashcardId, question) {
  document.getElementById('delete-flashcard-id').value = flashcardId;
  document.getElementById('delete-flashcard-preview').textContent = `Question: ${question}`;
  openModal('delete-flashcard-modal');
}

// NEW: Confirm delete flashcard
async function confirmDeleteFlashcard() {
  const flashcardId = document.getElementById('delete-flashcard-id').value;
  
  try {
    const response = await fetch('/admin/delete-flashcard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flashcardId })
    });
    
    if (response.ok) {
      closeModal('delete-flashcard-modal');
      alert('Flashcard deleted successfully! Close and reopen the topic to see changes.');
    } else {
      alert('Failed to delete flashcard');
    }
  } catch (error) {
    console.error('Error deleting flashcard:', error);
    alert('Failed to delete flashcard');
  }
}
