/** @param {string} fileContent @param {string} siteUrl */
export function parseRedirectUrls(fileContent, siteUrl) {
	return fileContent
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => {
			const parts = line.split(/\s+/);
			const fromPath = parts[0];
			if (fromPath && fromPath.startsWith("/") && fromPath !== "/sitemap.xml") {
				return `${siteUrl}${fromPath}`;
			}
			return null;
		})
		.filter((url) => url !== null);
}
