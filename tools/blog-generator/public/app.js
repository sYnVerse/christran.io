// Initialize Markdown-it parser
const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true
});

// State
let appConfig = null;
let currentIdeas = [];
let activeDraft = null;
let savedFilename = '';

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const configStatus = document.getElementById('config-status');
const apiWarning = document.getElementById('api-warning');

// Ideas elements
const btnGenerateIdeas = document.getElementById('btn-generate-ideas');
const btnEmailIdeas = document.getElementById('btn-email-ideas');
const ideasLoader = document.getElementById('ideas-loader');
const ideasContainer = document.getElementById('ideas-container');

// Editor elements
const editorNavBtn = document.getElementById('editor-nav-btn');
const activePostTitle = document.getElementById('active-post-title');
const slugInfo = document.getElementById('slug-info');
const btnLoadDraft = document.getElementById('btn-load-draft');
const btnSaveDraft = document.getElementById('btn-save-draft');
const markdownEditor = document.getElementById('markdown-editor');
const htmlPreview = document.getElementById('html-preview');
const refinePrompt = document.getElementById('refine-prompt');
const btnRefineDraft = document.getElementById('btn-refine-draft');
const refineLoader = document.getElementById('refine-loader');

// Publish elements
const publishNavBtn = document.getElementById('publish-nav-btn');
const commitFilename = document.getElementById('commit-filename');
const commitMessage = document.getElementById('commit-message');
const btnGitPublish = document.getElementById('btn-git-publish');
const consoleLog = document.getElementById('console-log');
const btnClearConsole = document.getElementById('btn-clear-console');

// API Base URL (runs on the same host)
const API_BASE = '';

// Initialize Lucide Icons
function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Tab Switching Logic
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    // Update active tab buttons
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update active content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === targetTab) {
        content.classList.add('active');
      }
    });
  });
});

// Navigate to tab helper
function navigateToTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

// Fetch API config and update UI
async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const config = await res.json();
    appConfig = config;
    
    // Update status indicator
    if (config.hasGeminiKey && config.hasResendKey) {
      configStatus.className = 'status-indicator ready';
      configStatus.innerHTML = '<span class="status-dot"></span> APIs Ready';
      apiWarning.classList.add('hidden');
    } else {
      configStatus.className = 'status-indicator warning';
      configStatus.innerHTML = '<span class="status-dot"></span> Config Warning';
      apiWarning.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error fetching config:', error);
    configStatus.className = 'status-indicator warning';
    configStatus.innerHTML = '<span class="status-dot"></span> Offline';
  }
}

// Fetch current proposals
async function loadIdeas() {
  try {
    const res = await fetch(`${API_BASE}/api/ideas`);
    const ideas = await res.json();
    currentIdeas = ideas;
    renderIdeas(ideas);
  } catch (error) {
    console.error('Error loading ideas:', error);
  }
}

// Render Ideas list
function renderIdeas(ideas) {
  ideasContainer.innerHTML = '';
  
  if (!ideas || ideas.length === 0) {
    ideasContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="lightbulb" class="huge-icon"></i>
        <h3>No ideas loaded</h3>
        <p>Click "Generate New Ideas" to run Gemini and generate a personalized list of topics based on your site's history.</p>
      </div>
    `;
    btnEmailIdeas.disabled = true;
    updateIcons();
    return;
  }
  
  btnEmailIdeas.disabled = false;
  
  ideas.forEach(idea => {
    const card = document.createElement('div');
    card.className = 'idea-card';
    
    const outlineItems = idea.outline.map(pt => `<li>${pt}</li>`).join('');
    const tagsItems = idea.tags.map(t => `<span class="tag">#${t}</span>`).join('');
    
    card.innerHTML = `
      <h3 class="idea-title">${idea.title}</h3>
      <p class="idea-desc">"${idea.description}"</p>
      <div class="idea-outline-title">Outline Points:</div>
      <ul class="idea-outline">
        ${outlineItems}
      </ul>
      <div class="idea-tags">
        ${tagsItems}
      </div>
      <div class="idea-card-footer">
        <button class="btn btn-primary btn-select" data-id="${idea.id}">
          <i data-lucide="file-plus"></i> Select & Write Draft
        </button>
      </div>
    `;
    
    // Bind write draft event
    card.querySelector('.btn-select').addEventListener('click', async () => {
      await generateDraftForIdea(idea);
    });
    
    ideasContainer.appendChild(card);
  });
  
  updateIcons();
}

// Generate Blog Post Draft
async function generateDraftForIdea(idea) {
  // Disable all select buttons while generating
  document.querySelectorAll('.btn-select').forEach(b => b.disabled = true);
  btnGenerateIdeas.disabled = true;
  
  // Show loader in ideas container
  ideasContainer.classList.add('hidden');
  ideasLoader.classList.remove('hidden');
  ideasLoader.querySelector('p').innerText = `Gemini is writing the draft for: "${idea.title}"... This may take a moment.`;
  
  try {
    const response = await fetch(`${API_BASE}/api/draft/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea })
    });
    const result = await response.json();
    
    if (result.success) {
      loadDraftContent(result.content, idea.title);
      navigateToTab('editor-tab');
      
      // Notify user draft was also emailed
      if (appConfig && appConfig.hasResendKey && appConfig.userEmail) {
        alert(`Draft generated successfully and emailed to ${appConfig.userEmail}!`);
      } else {
        alert('Draft generated successfully! Load complete in local editor.');
      }
    } else {
      alert(`Generation failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error generating draft:', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Re-enable buttons
    document.querySelectorAll('.btn-select').forEach(b => b.disabled = false);
    btnGenerateIdeas.disabled = false;
    ideasContainer.classList.remove('hidden');
    ideasLoader.classList.add('hidden');
  }
}

// Load draft data into Editor UI
function loadDraftContent(markdownContent, title = '') {
  activeDraft = markdownContent;
  markdownEditor.value = markdownContent;
  markdownEditor.disabled = false;
  
  btnSaveDraft.disabled = false;
  refinePrompt.disabled = false;
  btnRefineDraft.disabled = false;
  
  if (title) {
    activePostTitle.innerText = title;
  } else {
    // Try to extract title from frontmatter
    const fm = parseFrontmatter(markdownContent);
    activePostTitle.innerText = fm && fm.title ? fm.title : 'Draft Post';
  }
  
  updatePreview(markdownContent);
  updateSlugDisplay(markdownContent);
}

// Compile Markdown to Live Preview
function updatePreview(markdownContent) {
  if (!markdownContent) {
    htmlPreview.innerHTML = `
      <div class="empty-preview">
        <p>No content to display.</p>
      </div>
    `;
    return;
  }
  
  // Separate frontmatter and body
  const match = markdownContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let body = markdownContent;
  let frontmatterHtml = '';
  
  if (match) {
    body = markdownContent.substring(match[0].length);
    const fmText = match[1];
    frontmatterHtml = `
      <div class="frontmatter-preview">
        <strong>Frontmatter Configuration:</strong>
        <pre>${escapeHtml(fmText)}</pre>
      </div>
    `;
  }
  
  // Parse body Markdown
  const parsedBody = md.render(body);
  htmlPreview.innerHTML = frontmatterHtml + parsedBody;
}

// Generate & display slug suggestion
function updateSlugDisplay(markdownContent) {
  const fm = parseFrontmatter(markdownContent);
  if (fm && fm.title) {
    const slug = fm.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    slugInfo.innerText = `slug: ${slug}.md`;
    slugInfo.setAttribute('data-slug', slug);
  } else {
    slugInfo.innerText = 'slug: none';
    slugInfo.removeAttribute('data-slug');
  }
}

// Local frontmatter parser helper
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return null;
  const fmText = match[1];
  const result = {};
  fmText.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      result[key] = val;
    }
  });
  return result;
}

// Escape HTML helper
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Handle Editor Input Change
markdownEditor.addEventListener('input', (e) => {
  const content = e.target.value;
  activeDraft = content;
  updatePreview(content);
  updateSlugDisplay(content);
});

// Fetch active draft stored on server (if any)
async function loadActiveDraftFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/draft`);
    const draft = await res.json();
    if (draft && draft.content) {
      const title = draft.idea ? draft.idea.title : '';
      loadDraftContent(draft.content, title);
      navigateToTab('editor-tab');
    } else {
      alert('No active draft saved on the server. Select an idea to generate one!');
    }
  } catch (error) {
    console.error('Error loading draft:', error);
    alert('Failed to load draft from server.');
  }
}

// Generate Ideas Button Event
btnGenerateIdeas.addEventListener('click', async () => {
  btnGenerateIdeas.disabled = true;
  ideasContainer.classList.add('hidden');
  ideasLoader.classList.remove('hidden');
  ideasLoader.querySelector('p').innerText = 'Analyzing existing articles and brainstorming ideas...';
  
  try {
    const res = await fetch(`${API_BASE}/api/ideas/generate`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.success) {
      currentIdeas = result.ideas;
      renderIdeas(result.ideas);
    } else {
      alert(`Error generating ideas: ${result.error}`);
    }
  } catch (error) {
    console.error('Error generating ideas:', error);
    alert(`Failed to request ideas: ${error.message}`);
  } finally {
    btnGenerateIdeas.disabled = false;
    ideasLoader.classList.add('hidden');
    ideasContainer.classList.remove('hidden');
  }
});

// Email Ideas Button Event
btnEmailIdeas.addEventListener('click', async () => {
  btnEmailIdeas.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/ideas/send-email`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.success) {
      alert('Daily ideas successfully emailed!');
    } else {
      alert(`Failed to send email: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending ideas email:', error);
    alert(`Error: ${error.message}`);
  } finally {
    btnEmailIdeas.disabled = false;
  }
});

// Refine Draft Button Event
btnRefineDraft.addEventListener('click', async () => {
  const prompt = refinePrompt.value.trim();
  if (!prompt) return;
  
  refinePrompt.disabled = true;
  btnRefineDraft.disabled = true;
  refineLoader.classList.remove('hidden');
  
  try {
    const res = await fetch(`${API_BASE}/api/draft/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: activeDraft,
        suggestion: prompt
      })
    });
    const result = await res.json();
    if (result.success) {
      loadDraftContent(result.content);
      refinePrompt.value = '';
      alert('Suggestions applied! Draft updated.');
    } else {
      alert(`Refinement failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error refining draft:', error);
    alert(`Error: ${error.message}`);
  } finally {
    refinePrompt.disabled = false;
    btnRefineDraft.disabled = false;
    refineLoader.classList.add('hidden');
  }
});

// Save Draft File Event
btnSaveDraft.addEventListener('click', async () => {
  const slug = slugInfo.getAttribute('data-slug');
  if (!slug) {
    alert('Could not determine slug. Please make sure the post has a title in frontmatter.');
    return;
  }
  
  // Prompt user to verify the slug
  const finalSlug = prompt('Verify slug/filename for markdown file:', slug);
  if (!finalSlug) return;
  
  btnSaveDraft.disabled = true;
  
  try {
    const res = await fetch(`${API_BASE}/api/draft/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: activeDraft,
        slug: finalSlug
      })
    });
    const result = await res.json();
    if (result.success) {
      savedFilename = result.filename;
      alert(`Successfully saved draft to: src/content/blog/${result.filename}!`);
      
      // Update publish tab state
      commitFilename.value = result.filename;
      commitMessage.value = `feat(blog): add post about ${activePostTitle.innerText}`;
      commitMessage.disabled = false;
      btnGitPublish.disabled = false;
      
      // Open publish tab
      navigateToTab('publish-tab');
    } else {
      alert(`Failed to save draft file: ${result.error}`);
    }
  } catch (error) {
    console.error('Error saving draft:', error);
    alert(`Error: ${error.message}`);
  } finally {
    btnSaveDraft.disabled = false;
  }
});

// Git Publisher Button Event
btnGitPublish.addEventListener('click', async () => {
  const msg = commitMessage.value.trim();
  if (!msg) {
    alert('Please enter a commit message.');
    return;
  }
  
  btnGitPublish.disabled = true;
  commitMessage.disabled = true;
  consoleLog.innerText = `Running Git publish workflow...\nStaging file...\nCommitting: "${msg}"...\nPushing to remote origin...`;
  
  try {
    const res = await fetch(`${API_BASE}/api/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        filename: savedFilename
      })
    });
    const result = await res.json();
    
    if (result.success) {
      consoleLog.innerText += `\n\n✅ SUCCESS!\n\n${result.log}`;
      alert('Successfully committed and pushed blog post to GitHub!');
    } else {
      consoleLog.innerText += `\n\n❌ ERROR!\n\n${result.error || result.stderr || 'Git operation failed.'}`;
      alert('Git operation encountered an error. Check the terminal log.');
    }
  } catch (error) {
    console.error('Git publish error:', error);
    consoleLog.innerText += `\n\n❌ CONNECTION ERROR:\n${error.message}`;
    alert(`Connection Error: ${error.message}`);
  } finally {
    btnGitPublish.disabled = false;
    commitMessage.disabled = false;
  }
});

// Load Saved Draft button binding
btnLoadDraft.addEventListener('click', loadActiveDraftFromServer);

// Clear console binding
btnClearConsole.addEventListener('click', () => {
  consoleLog.innerText = 'Console cleared. Ready.';
});

// App Entry Point
window.addEventListener('DOMContentLoaded', async () => {
  updateIcons();
  await fetchConfig();
  await loadIdeas();
});
