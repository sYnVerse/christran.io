let searchIndex: any[] | null = null;
let modalOpen = false;
let activeIndex = -1;
let resultItems: HTMLElement[] = [];
let lastActiveElement: HTMLElement | null = null;
let initialized = false;

let modal: HTMLElement | null = null;
let container: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let closeBtn: HTMLElement | null = null;
let resultsWrapper: HTMLElement | null = null;
let suggestions: HTMLElement | null = null;
let resultsContainer: HTMLElement | null = null;
let emptyState: HTMLElement | null = null;
let queryDisplay: HTMLElement | null = null;

async function loadSearchIndex() {
	if (searchIndex) return;
	try {
		const res = await fetch('/search-index.json');
		if (!res.ok) throw new Error('Failed to fetch search index');
		searchIndex = await res.json();
	} catch (err) {
		console.error('Error loading search index:', err);
	}
}

function openModal(triggerElement: HTMLElement | null = null) {
	if (modalOpen || !modal || !input) return;
	
	lastActiveElement = triggerElement || document.activeElement as HTMLElement;
	modal.classList.add('open');
	modal.setAttribute('aria-hidden', 'false');
	document.body.style.overflow = 'hidden';
	modalOpen = true;

	setTimeout(() => {
		if (input) {
			input.focus();
		}
	}, 50);

	loadSearchIndex();
}

function closeModal() {
	if (!modalOpen || !modal) return;

	modal.classList.remove('open');
	modal.setAttribute('aria-hidden', 'true');
	document.body.style.overflow = '';
	modalOpen = false;
	activeIndex = -1;

	if (input) {
		input.value = '';
		performSearch('');
	}

	if (lastActiveElement) {
		lastActiveElement.focus();
	}
}

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): string {
	if (!query) return text;
	const escapedQuery = escapeRegExp(query);
	const regex = new RegExp(`(${escapedQuery})`, 'gi');
	return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function performSearch(query: string) {
	if (!searchIndex || !resultsContainer || !suggestions || !emptyState || !queryDisplay) return;

	const cleanQuery = query.trim().toLowerCase();

	if (cleanQuery === '') {
		suggestions.style.display = 'block';
		resultsContainer.style.display = 'none';
		emptyState.style.display = 'none';
		activeIndex = -1;
		resultItems = [];
		return;
	}

	const matches = searchIndex
		.map(item => {
			let score = 0;
			const titleIdx = item.title.toLowerCase().indexOf(cleanQuery);
			const descIdx = item.description.toLowerCase().indexOf(cleanQuery);
			const bodyIdx = item.body ? item.body.toLowerCase().indexOf(cleanQuery) : -1;
			const matchedTags = item.tags ? item.tags.filter((t: string) => t.toLowerCase().includes(cleanQuery)).length : 0;

			if (titleIdx === 0) score += 100;
			else if (titleIdx > 0) score += 80;
			if (descIdx !== -1) score += 40;
			if (matchedTags > 0) score += 30 * matchedTags;
			if (bodyIdx !== -1) score += 10;

			return { item, score };
		})
		.filter(match => match.score > 0)
		.sort((a, b) => b.score - a.score);

	if (matches.length === 0) {
		suggestions.style.display = 'none';
		resultsContainer.style.display = 'none';
		queryDisplay.textContent = query;
		emptyState.style.display = 'flex';
		activeIndex = -1;
		resultItems = [];
		return;
	}

	suggestions.style.display = 'none';
	emptyState.style.display = 'none';
	resultsContainer.style.display = 'block';

	const blogs = matches.filter(m => m.item.type === 'blog');
	const projects = matches.filter(m => m.item.type === 'project');

	let html = '';

	if (blogs.length > 0) {
		html += `<div class="results-section">
			<p class="section-title">Blog Posts (${blogs.length})</p>
			<ul class="results-list">`;
		blogs.forEach(match => {
			const dateStr = match.item.date ? new Date(match.item.date).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			}) : '';
			html += `
				<li>
					<a href="${match.item.url}" class="result-card" data-search-item>
						<div class="result-card-header">
							<span class="result-title">${highlightText(match.item.title, query)}</span>
							${dateStr ? `<span class="result-date">${dateStr}</span>` : ''}
						</div>
						<p class="result-desc">${highlightText(match.item.description, query)}</p>
					</a>
				</li>
			`;
		});
		html += `</ul></div>`;
	}

	if (projects.length > 0) {
		html += `<div class="results-section">
			<p class="section-title">Portfolio Projects (${projects.length})</p>
			<ul class="results-list">`;
		projects.forEach(match => {
			const tagsHtml = match.item.tags ? match.item.tags.slice(0, 3).map((t: string) => `<span class="result-tag">${t}</span>`).join('') : '';
			html += `
				<li>
					<a href="${match.item.url}" class="result-card" data-search-item>
						<div class="result-card-header">
							<span class="result-title">${highlightText(match.item.title, query)}</span>
							<span class="result-badge">Project</span>
						</div>
						<p class="result-desc">${highlightText(match.item.description, query)}</p>
						${tagsHtml ? `<div class="result-tags">${tagsHtml}</div>` : ''}
					</a>
				</li>
			`;
		});
		html += `</ul></div>`;
	}

	resultsContainer.innerHTML = html;
	resultItems = Array.from(resultsContainer.querySelectorAll('[data-search-item]')) as HTMLElement[];
	activeIndex = -1;
}

function updateActiveItem(direction: 'up' | 'down') {
	if (resultItems.length === 0) return;

	if (activeIndex >= 0 && activeIndex < resultItems.length) {
		resultItems[activeIndex].classList.remove('active');
	}

	if (direction === 'down') {
		activeIndex = (activeIndex + 1) % resultItems.length;
	} else {
		activeIndex = (activeIndex - 1 + resultItems.length) % resultItems.length;
	}

	const newActiveItem = resultItems[activeIndex];
	newActiveItem.classList.add('active');
	newActiveItem.scrollIntoView({ block: 'nearest' });
}

export function initSearch() {
	if (initialized) return { open: openModal, close: closeModal, performSearch, executeFromAgent };
	initialized = true;

	modal = document.getElementById('search-modal');
	container = document.getElementById('search-modal-container');
	input = document.getElementById('search-input') as HTMLInputElement;
	closeBtn = document.getElementById('search-close-btn');
	resultsWrapper = document.getElementById('search-results-wrapper');
	suggestions = document.getElementById('search-suggestions');
	resultsContainer = document.getElementById('search-results');
	emptyState = document.getElementById('search-empty-state');
	queryDisplay = document.getElementById('search-query-display');

	// Register event listeners
	document.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const trigger = target.closest('.search-trigger');
		if (trigger) {
			e.preventDefault();
			openModal(trigger as HTMLElement);
		}
	});

	if (modal) {
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				closeModal();
			}
		});
	}

	if (closeBtn) {
		closeBtn.addEventListener('click', closeModal);
	}

	if (input) {
		input.addEventListener('input', (e) => {
			const val = (e.target as HTMLInputElement).value;
			performSearch(val);
		});

		input.addEventListener('focus', loadSearchIndex);
	}

	document.addEventListener('mouseover', (e) => {
		const target = e.target as HTMLElement;
		if (target.closest('.search-trigger')) {
			loadSearchIndex();
		}
	});

	document.addEventListener('keydown', (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			if (modalOpen) {
				closeModal();
			} else {
				openModal();
			}
		}

		if (!modalOpen) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			closeModal();
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			updateActiveItem('down');
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			updateActiveItem('up');
		}

		if (e.key === 'Enter') {
			if (activeIndex >= 0 && activeIndex < resultItems.length) {
				e.preventDefault();
				resultItems[activeIndex].click();
			}
		}

		if (e.key === 'Tab') {
			const focusableElements = Array.from(container?.querySelectorAll('input, button, [data-search-item]') || []) as HTMLElement[];
			if (focusableElements.length === 0) return;

			const first = focusableElements[0];
			const last = focusableElements[focusableElements.length - 1];

			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}
	});

	return { open: openModal, close: closeModal, performSearch, executeFromAgent };
}

async function executeFromAgent(query: string) {
	await loadSearchIndex();
	openModal();
	if (input) {
		input.value = query;
	}
	performSearch(query);

	if (!searchIndex) {
		throw new Error('Search index failed to load.');
	}

	const cleanQuery = query.trim().toLowerCase();
	if (cleanQuery === '') {
		return JSON.stringify({ results: [] });
	}

	const matches = searchIndex
		.map(item => {
			let score = 0;
			const titleIdx = item.title.toLowerCase().indexOf(cleanQuery);
			const descIdx = item.description.toLowerCase().indexOf(cleanQuery);
			const bodyIdx = item.body ? item.body.toLowerCase().indexOf(cleanQuery) : -1;
			const matchedTags = item.tags ? item.tags.filter((t: string) => t.toLowerCase().includes(cleanQuery)).length : 0;

			if (titleIdx === 0) score += 100;
			else if (titleIdx > 0) score += 80;
			if (descIdx !== -1) score += 40;
			if (matchedTags > 0) score += 30 * matchedTags;
			if (bodyIdx !== -1) score += 10;

			return { item, score };
		})
		.filter(match => match.score > 0)
		.sort((a, b) => b.score - a.score)
		.map(match => ({
			title: match.item.title,
			description: match.item.description,
			url: match.item.url,
			type: match.item.type,
			tags: match.item.tags || []
		}));

	return JSON.stringify({
		query: query,
		totalResultsCount: matches.length,
		results: matches.slice(0, 10)
	});
}
