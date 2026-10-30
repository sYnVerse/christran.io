import { z } from "zod";

export const blogSchema = z.object({
	title: z.string(),
	description: z.string(),
	// Transform string to Date object
	pubDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	heroImage: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

export const portfolioSchema = z.object({
	title: z.string(),
	description: z.string(),
	category: z.enum(["app", "infrastructure", "community"]),
	tags: z.array(z.string()),
	techStack: z.array(z.string()),
	image: z.string().optional(),
	liveUrl: z.string().optional(),
	sourceUrl: z.string().optional(),
	featured: z.boolean(),
	order: z.number(),
});
