export interface SearchItem {
	title: string;
	description: string;
	body?: string;
	tags?: string[];
}

export function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightText(text: string, query: string): string {
	if (!query) return text;
	const escapedQuery = escapeRegExp(query);
	const regex = new RegExp(`(${escapedQuery})`, 'gi');
	return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

export function calculateScore(item: SearchItem, query: string): number {
	const cleanQuery = query.trim().toLowerCase();
	if (!cleanQuery) return 0;

	let score = 0;
	const titleIdx = item.title.toLowerCase().indexOf(cleanQuery);
	const descIdx = item.description.toLowerCase().indexOf(cleanQuery);
	const bodyIdx = item.body ? item.body.toLowerCase().indexOf(cleanQuery) : -1;
	const matchedTags = item.tags
		? item.tags.filter((t) => t.toLowerCase().includes(cleanQuery)).length
		: 0;

	if (titleIdx === 0) score += 100;
	else if (titleIdx > 0) score += 80;
	if (descIdx !== -1) score += 40;
	if (matchedTags > 0) score += 30 * matchedTags;
	if (bodyIdx !== -1) score += 10;

	return score;
}
