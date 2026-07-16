import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  let graphData = { nodes: [], links: [], directed: false };
  let labels = {};

  try {
    const graphPath = path.resolve('graphify-out/graph.json');
    if (fs.existsSync(graphPath)) {
      const content = fs.readFileSync(graphPath, 'utf-8');
      graphData = JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to read graph.json', error);
  }

  try {
    const labelsPath = path.resolve('graphify-out/.graphify_labels.json');
    if (fs.existsSync(labelsPath)) {
      const content = fs.readFileSync(labelsPath, 'utf-8');
      labels = JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to read .graphify_labels.json', error);
  }

  // Optimize and process nodes
  const processedNodes = graphData.nodes.map((node: any) => {
    const src = node.source_file || '';
    
    // Determine category / tags
    let isSystem = false;
    let isTool = false;
    let url = '';

    if (
      src.endsWith('.d.ts') || 
      src === 'tsconfig.json' || 
      src === 'package.json' || 
      src.startsWith('.agents/') ||
      node.id === 'package' || 
      node.id.startsWith('package_') ||
      src.includes('node_modules')
    ) {
      isSystem = true;
    } else if (src.startsWith('tools/')) {
      isTool = true;
    }

    // Map content source file to a public URL on the site
    if (src.startsWith('src/content/blog/')) {
      // e.g., src/content/blog/foo.mdx -> /blog/foo/
      const basename = path.basename(src);
      const id = basename.replace(/\.(mdx|md)$/, '');
      url = `/blog/${id}/`;
    } else if (src.startsWith('src/content/portfolio/')) {
      // e.g., src/content/portfolio/bar.mdx -> /portfolio/bar/
      const basename = path.basename(src);
      const id = basename.replace(/\.(mdx|md)$/, '');
      url = `/portfolio/${id}/`;
    }

    const commId = String(node.community);
    const commName = labels[commId] || `Community ${commId}`;

    return {
      id: node.id,
      label: node.label,
      file_type: node.file_type || 'concept',
      source_file: src,
      community: node.community,
      communityName: commName,
      isSystem,
      isTool,
      url
    };
  });

  // Make sure we only return valid links
  const nodeIds = new Set(processedNodes.map(n => n.id));
  const processedLinks = (graphData.links || [])
    .filter((link: any) => {
      // Ensure endpoints exist in our node list
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    })
    .map((link: any) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return {
        source: sourceId,
        target: targetId,
        relation: link.relation || '',
        confidence: link.confidence || 'EXTRACTED',
        confidence_score: link.confidence_score || 1.0,
        weight: link.weight || 1.0
      };
    });

  return new Response(
    JSON.stringify({
      nodes: processedNodes,
      links: processedLinks,
      directed: graphData.directed || false
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
    }
  );
}
