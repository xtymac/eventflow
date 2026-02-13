/**
 * Notion to Markdown Sync Script
 *
 * Syncs a Notion page tree to local Markdown files in docs/notion/.
 * Handles child pages, databases, and asset downloads.
 *
 * Usage:
 *   npx tsx scripts/notion-sync.ts
 *
 * Environment variables (in .env.sync):
 *   NOTION_TOKEN          - Notion internal integration token
 *   NOTION_ROOT_PAGE_ID   - Root page ID or full Notion URL
 *   NOTION_OUTPUT_DIR     - Output directory (default: docs/notion)
 *   NOTION_ASSET_DIR      - Asset directory (default: docs/notion/assets)
 *   NOTION_ASSET_MODE     - "download" or "link" (default: download)
 */

import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import {
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  createWriteStream,
} from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { dirname, join, relative, extname } from 'path';
import { createHash } from 'crypto';
import type { Readable } from 'stream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Config {
  notionToken: string;
  rootPageId: string;
  outputDir: string;
  assetDir: string;
  assetMode: 'download' | 'link';
  projectRoot: string;
}

interface PageNode {
  id: string;
  title: string;
  slug: string;
  lastEditedTime: string;
  url: string;
  children: PageNode[];
  databases: DatabaseNode[];
}

interface DatabaseNode {
  id: string;
  title: string;
  slug: string;
  url: string;
  lastEditedTime: string;
  records: PageNode[];
}

// Map of original URL -> local asset filename
type AssetMap = Map<string, string>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const MAX_DEPTH = 10;
const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50 MB
const COURTESY_DELAY_MS = 200;
const LARGE_TREE_THRESHOLD = 50;

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string, err?: unknown): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] [ERROR] ${msg}`);
  if (err instanceof Error) {
    console.error(`  ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function parsePageId(input: string): string {
  const trimmed = input.trim();

  // Full Notion URL: extract last 32 hex segment
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed);
    // pathname like /workspace/Page-Title-abcdef1234567890abcdef1234567890
    // or /abcdef1234567890abcdef1234567890
    const lastSegment = url.pathname.split('/').pop() || '';
    // Extract last 32 hex chars (may be at end after title)
    const hexMatch = lastSegment.match(/([a-f0-9]{32})$/i);
    if (hexMatch) {
      return hexMatch[1].toLowerCase();
    }
    // Try with hyphens: Notion sometimes formats as 8-4-4-4-12
    const noHyphens = lastSegment.replace(/-/g, '');
    const hexMatch2 = noHyphens.match(/([a-f0-9]{32})$/i);
    if (hexMatch2) {
      return hexMatch2[1].toLowerCase();
    }
    console.error(`Could not extract page ID from URL: ${trimmed}`);
    console.error('Expected URL like: https://www.notion.so/workspace/Page-Title-abc123...');
    process.exit(1);
  }

  // Bare ID: 32 hex chars, optionally with hyphens
  const noHyphens = trimmed.replace(/-/g, '');
  if (/^[a-f0-9]{32}$/i.test(noHyphens)) {
    return noHyphens.toLowerCase();
  }

  console.error(`Invalid NOTION_ROOT_PAGE_ID: ${trimmed}`);
  console.error('Expected: 32 hex chars, UUID format, or full Notion URL');
  process.exit(1);
}

function validateOutputDir(outputDir: string, projectRoot: string): void {
  const resolved = join(projectRoot, outputDir);
  if (!resolved.startsWith(projectRoot)) {
    console.error(`Output directory escapes project root: ${outputDir}`);
    process.exit(1);
  }
  if (!resolved.includes('docs/notion')) {
    console.error(`Output directory must contain "docs/notion" for safety: ${outputDir}`);
    process.exit(1);
  }
}

function loadConfig(): Config {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error('NOTION_TOKEN is required. Add it to .env.sync');
    process.exit(1);
  }

  const rawPageId = process.env.NOTION_ROOT_PAGE_ID;
  if (!rawPageId) {
    console.error('NOTION_ROOT_PAGE_ID is required. Add it to .env.sync');
    console.error('Accepts: page ID (32 hex chars) or full Notion URL');
    process.exit(1);
  }

  const rootPageId = parsePageId(rawPageId);
  const outputDir = process.env.NOTION_OUTPUT_DIR || 'docs/notion';
  const assetDir = process.env.NOTION_ASSET_DIR || join(outputDir, 'assets');
  const assetMode = (process.env.NOTION_ASSET_MODE || 'download') as 'download' | 'link';

  validateOutputDir(outputDir, PROJECT_ROOT);

  return {
    notionToken: token,
    rootPageId,
    outputDir,
    assetDir,
    assetMode,
    projectRoot: PROJECT_ROOT,
  };
}

// ---------------------------------------------------------------------------
// Slug Generation
// ---------------------------------------------------------------------------

function toSlug(title: string, pageId?: string): string {
  let slug = title.normalize('NFC');
  slug = slug.toLowerCase();

  // Replace filesystem-dangerous characters
  slug = slug.replace(/[/\\?%*:|"<>]/g, '-');

  // Replace whitespace and underscores with hyphens
  slug = slug.replace(/[\s\t_]+/g, '-');

  // Remove characters that aren't letters, numbers, hyphens, or dots
  // Preserves CJK and other Unicode letters/digits
  slug = slug.replace(/[^\p{L}\p{N}\-\.]/gu, '');

  // Collapse multiple hyphens
  slug = slug.replace(/-{2,}/g, '-');

  // Trim leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Truncate
  if (slug.length > 80) {
    slug = slug.slice(0, 80).replace(/-+$/, '');
  }

  // Fallback for empty slugs
  if (!slug) {
    slug = pageId ? `page-${pageId.slice(0, 8)}` : 'untitled';
  }

  return slug;
}

function deduplicateSlug(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) {
    existing.add(slug);
    return slug;
  }
  let counter = 2;
  while (existing.has(`${slug}-${counter}`)) {
    counter++;
  }
  const deduped = `${slug}-${counter}`;
  existing.add(deduped);
  return deduped;
}

// ---------------------------------------------------------------------------
// Page Title Extraction
// ---------------------------------------------------------------------------

function extractPageTitle(pageProperties: Record<string, any>): string {
  // Find the property with type === "title"
  for (const prop of Object.values(pageProperties)) {
    if (prop.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t: any) => t.plain_text).join('') || 'Untitled';
    }
  }
  return 'Untitled';
}

// ---------------------------------------------------------------------------
// Page Tree Building
// ---------------------------------------------------------------------------

async function buildPageTree(
  notion: Client,
  pageId: string,
  depth: number,
  pageCount: { value: number },
): Promise<PageNode> {
  const page = await notion.pages.retrieve({ page_id: pageId }) as any;
  const title = extractPageTitle(page.properties);
  const lastEditedTime = page.last_edited_time;
  const url = page.url;

  const node: PageNode = {
    id: pageId,
    title,
    slug: toSlug(title, pageId),
    lastEditedTime,
    url,
    children: [],
    databases: [],
  };

  pageCount.value++;

  if (depth >= MAX_DEPTH) {
    log(`  Warning: max depth (${MAX_DEPTH}) reached at "${title}", skipping children`);
    return node;
  }

  // Paginate through all blocks
  let cursor: string | undefined;
  const childSlugs = new Set<string>();

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const b = block as any;

      if (b.type === 'child_page') {
        if (pageCount.value >= LARGE_TREE_THRESHOLD) {
          await delay(COURTESY_DELAY_MS);
        }
        const childNode = await buildPageTree(notion, b.id, depth + 1, pageCount);
        childNode.slug = deduplicateSlug(childNode.slug, childSlugs);
        node.children.push(childNode);
      } else if (b.type === 'child_database') {
        try {
          const dbNode = await buildDatabaseNode(notion, b.id, childSlugs);
          node.databases.push(dbNode);
        } catch (err) {
          logError(`Failed to process database ${b.id}`, err);
        }
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return node;
}

async function buildDatabaseNode(
  notion: Client,
  databaseId: string,
  parentSlugs: Set<string>,
): Promise<DatabaseNode> {
  const db = await notion.databases.retrieve({ database_id: databaseId }) as any;
  const title = db.title?.map((t: any) => t.plain_text).join('') || 'Untitled Database';

  const dbNode: DatabaseNode = {
    id: databaseId,
    title,
    slug: deduplicateSlug(toSlug(title, databaseId), parentSlugs),
    url: db.url,
    lastEditedTime: db.last_edited_time,
    records: [],
  };

  // Paginate through all records
  let cursor: string | undefined;
  const recordSlugs = new Set<string>();

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
    });

    for (const record of response.results) {
      const r = record as any;
      const recordTitle = extractPageTitle(r.properties);
      const recordSlug = deduplicateSlug(toSlug(recordTitle, r.id), recordSlugs);

      dbNode.records.push({
        id: r.id,
        title: recordTitle,
        slug: recordSlug,
        lastEditedTime: r.last_edited_time,
        url: r.url,
        children: [],
        databases: [],
      });
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return dbNode;
}

// ---------------------------------------------------------------------------
// Asset Handling
// ---------------------------------------------------------------------------

function resolveExtension(
  url: string,
  contentType?: string | null,
  notionFileName?: string,
): string {
  // Priority 1: Notion's original filename
  if (notionFileName) {
    const ext = extname(notionFileName);
    if (ext) return ext.toLowerCase();
  }

  // Priority 2: Content-Type header
  if (contentType) {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  }

  // Priority 3: URL path extension
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname);
    if (ext && ext.length <= 6) return ext.toLowerCase();
  } catch {
    // ignore
  }

  // Fallback
  return '.bin';
}

async function downloadAsset(
  url: string,
  assetDir: string,
  notionFileName?: string,
): Promise<{ localName: string; skipped: boolean }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      logError(`Asset download failed (${response.status}): ${url}`);
      return { localName: '', skipped: true };
    }

    // Check size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_ASSET_SIZE) {
      log(`  Skipped (>${MAX_ASSET_SIZE / 1024 / 1024}MB): ${notionFileName || url}`);
      return { localName: '', skipped: true };
    }

    const contentType = response.headers.get('content-type');
    const ext = resolveExtension(url, contentType, notionFileName);
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 12);
    const localName = `${hash}${ext}`;
    const localPath = join(assetDir, localName);

    if (existsSync(localPath)) {
      return { localName, skipped: false };
    }

    const body = response.body as unknown as Readable;
    await pipeline(body, createWriteStream(localPath));

    const sizeKB = contentLength ? Math.round(parseInt(contentLength, 10) / 1024) : '?';
    log(`  Downloaded: ${notionFileName || 'asset'} -> ${localName} (${sizeKB} KB)`);

    return { localName, skipped: false };
  } catch (err) {
    logError(`Asset download error: ${url}`, err);
    return { localName: '', skipped: true };
  }
}

function rewriteAssetLinks(
  markdown: string,
  assetMap: AssetMap,
  mdFilePath: string,
  assetDirAbsolute: string,
): string {
  let result = markdown;

  for (const [originalUrl, localName] of assetMap) {
    if (!localName) continue;
    const relDir = relative(dirname(mdFilePath), assetDirAbsolute).replace(/\\/g, '/');
    const relPath = `${relDir}/${localName}`;
    // Replace all occurrences of the original URL
    result = result.split(originalUrl).join(relPath);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Markdown Generation
// ---------------------------------------------------------------------------

function buildFrontmatter(page: PageNode, syncTime: string): string {
  const escapedTitle = page.title.replace(/"/g, '\\"');
  return [
    '---',
    `title: "${escapedTitle}"`,
    `notion_url: "${page.url}"`,
    `last_edited: "${page.lastEditedTime}"`,
    `synced_at: "${syncTime}"`,
    '---',
    '',
  ].join('\n');
}

function buildDatabaseFrontmatter(db: DatabaseNode, recordCount: number, syncTime: string): string {
  const escapedTitle = db.title.replace(/"/g, '\\"');
  return [
    '---',
    `title: "${escapedTitle}"`,
    `notion_url: "${db.url}"`,
    `type: "database"`,
    `record_count: ${recordCount}`,
    `last_edited: "${db.lastEditedTime}"`,
    `synced_at: "${syncTime}"`,
    '---',
    '',
  ].join('\n');
}

function buildDatabaseIndex(db: DatabaseNode, syncTime: string): string {
  let md = buildDatabaseFrontmatter(db, db.records.length, syncTime);
  md += `# ${db.title}\n\n`;

  if (db.records.length === 0) {
    md += '*No records*\n';
  } else {
    md += `| Title | Last Edited |\n`;
    md += `|-------|-------------|\n`;
    for (const record of db.records) {
      const date = record.lastEditedTime.split('T')[0];
      md += `| [${record.title}](${record.slug}.md) | ${date} |\n`;
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// File Writing
// ---------------------------------------------------------------------------

interface WriteStats {
  pagesWritten: number;
  recordsWritten: number;
  assetsDownloaded: number;
  assetsSkipped: number;
}

async function writePageTree(
  node: PageNode,
  basePath: string,
  n2m: NotionToMarkdown,
  config: Config,
  syncTime: string,
  stats: WriteStats,
  isRoot: boolean,
): Promise<void> {
  const dirPath = isRoot ? basePath : join(basePath, node.slug);
  mkdirSync(dirPath, { recursive: true });

  const mdFilePath = join(dirPath, 'index.md');

  try {
    // Render page content
    const mdBlocks = await n2m.pageToMarkdown(node.id);
    let mdString = n2m.toMarkdownString(mdBlocks).parent;

    // Collect and download assets
    const assetMap: AssetMap = new Map();
    if (config.assetMode === 'download') {
      const assetDirAbsolute = join(config.projectRoot, config.assetDir);

      // Match markdown image and link URLs
      const urlRegex = /(?:!\[[^\]]*\]\(|(?<!!)\[[^\]]*\]\()([^)]+)\)/g;
      let match;
      const urls = new Set<string>();

      while ((match = urlRegex.exec(mdString)) !== null) {
        const url = match[1];
        if (url.startsWith('http://') || url.startsWith('https://')) {
          urls.add(url);
        }
      }

      // Also match raw image URLs from Notion (secure.notion-static.com, etc.)
      const rawUrlRegex = /https:\/\/(?:prod-files-secure|s3)[^\s)>"]+/g;
      let rawMatch;
      while ((rawMatch = rawUrlRegex.exec(mdString)) !== null) {
        urls.add(rawMatch[0]);
      }

      for (const url of urls) {
        if (!assetMap.has(url)) {
          const { localName, skipped } = await downloadAsset(url, assetDirAbsolute);
          if (skipped) {
            stats.assetsSkipped++;
          } else {
            stats.assetsDownloaded++;
          }
          assetMap.set(url, localName);
        }
      }

      mdString = rewriteAssetLinks(mdString, assetMap, mdFilePath, assetDirAbsolute);
    }

    const frontmatter = buildFrontmatter(node, syncTime);
    writeFileSync(mdFilePath, frontmatter + mdString);
    stats.pagesWritten++;

    const idx = stats.pagesWritten + stats.recordsWritten;
    log(`  [${idx}] ${isRoot ? 'index.md' : node.slug + '/index.md'}`);
  } catch (err) {
    logError(`Failed to render page "${node.title}" (${node.id})`, err);
    const placeholder = buildFrontmatter(node, syncTime) +
      `# ${node.title}\n\n<!-- Render failed: ${err instanceof Error ? err.message : 'unknown error'} -->\n`;
    writeFileSync(mdFilePath, placeholder);
    stats.pagesWritten++;
  }

  // Write child pages
  for (const child of node.children) {
    await writePageTree(child, dirPath, n2m, config, syncTime, stats, false);
  }

  // Write databases
  for (const db of node.databases) {
    await writeDatabaseTree(db, dirPath, n2m, config, syncTime, stats);
  }
}

async function writeDatabaseTree(
  db: DatabaseNode,
  parentDir: string,
  n2m: NotionToMarkdown,
  config: Config,
  syncTime: string,
  stats: WriteStats,
): Promise<void> {
  const dbDir = join(parentDir, db.slug);
  mkdirSync(dbDir, { recursive: true });

  // Write database index
  const indexContent = buildDatabaseIndex(db, syncTime);
  writeFileSync(join(dbDir, 'index.md'), indexContent);
  log(`  [db] ${db.slug}/index.md (${db.records.length} records)`);

  // Write each record
  for (const record of db.records) {
    const mdFilePath = join(dbDir, `${record.slug}.md`);

    try {
      const mdBlocks = await n2m.pageToMarkdown(record.id);
      let mdString = n2m.toMarkdownString(mdBlocks).parent;

      // Asset handling for records
      const assetMap: AssetMap = new Map();
      if (config.assetMode === 'download') {
        const assetDirAbsolute = join(config.projectRoot, config.assetDir);

        const urlRegex = /(?:!\[[^\]]*\]\(|(?<!!)\[[^\]]*\]\()([^)]+)\)/g;
        let match;
        const urls = new Set<string>();

        while ((match = urlRegex.exec(mdString)) !== null) {
          const url = match[1];
          if (url.startsWith('http://') || url.startsWith('https://')) {
            urls.add(url);
          }
        }

        const rawUrlRegex = /https:\/\/(?:prod-files-secure|s3)[^\s)>"]+/g;
        let rawMatch;
        while ((rawMatch = rawUrlRegex.exec(mdString)) !== null) {
          urls.add(rawMatch[0]);
        }

        for (const url of urls) {
          if (!assetMap.has(url)) {
            const { localName, skipped } = await downloadAsset(url, assetDirAbsolute);
            if (skipped) {
              stats.assetsSkipped++;
            } else {
              stats.assetsDownloaded++;
            }
            assetMap.set(url, localName);
          }
        }

        mdString = rewriteAssetLinks(mdString, assetMap, mdFilePath, assetDirAbsolute);
      }

      const frontmatter = buildFrontmatter(record, syncTime);
      writeFileSync(mdFilePath, frontmatter + mdString);
      stats.recordsWritten++;
    } catch (err) {
      logError(`Failed to render record "${record.title}" (${record.id})`, err);
      const placeholder = buildFrontmatter(record, syncTime) +
        `# ${record.title}\n\n<!-- Render failed: ${err instanceof Error ? err.message : 'unknown error'} -->\n`;
      writeFileSync(mdFilePath, placeholder);
      stats.recordsWritten++;
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countTree(node: PageNode): { pages: number; databases: number; records: number; maxDepth: number } {
  let pages = 1;
  let databases = node.databases.length;
  let records = node.databases.reduce((sum, db) => sum + db.records.length, 0);
  let maxDepth = 0;

  for (const child of node.children) {
    const sub = countTree(child);
    pages += sub.pages;
    databases += sub.databases;
    records += sub.records;
    maxDepth = Math.max(maxDepth, sub.maxDepth + 1);
  }

  return { pages, databases, records, maxDepth };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Notion Sync ===\n');

  const config = loadConfig();
  const outputDirAbsolute = join(config.projectRoot, config.outputDir);
  const assetDirAbsolute = join(config.projectRoot, config.assetDir);

  log(`Root page ID: ${config.rootPageId}`);
  log(`Output: ${config.outputDir}`);
  log(`Asset mode: ${config.assetMode}`);

  // Initialize clients
  const notion = new Client({ auth: config.notionToken });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  // Clean and recreate output directory
  if (existsSync(outputDirAbsolute)) {
    rmSync(outputDirAbsolute, { recursive: true, force: true });
  }
  mkdirSync(outputDirAbsolute, { recursive: true });
  mkdirSync(assetDirAbsolute, { recursive: true });

  // Build page tree
  log('Building page tree...');
  const startTime = Date.now();
  const pageCount = { value: 0 };
  const tree = await buildPageTree(notion, config.rootPageId, 0, pageCount);

  const treeCounts = countTree(tree);
  log(`  Found ${treeCounts.pages} pages, ${treeCounts.databases} databases, ${treeCounts.records} records (max depth: ${treeCounts.maxDepth})`);

  // Write all pages
  log('Rendering pages...');
  const syncTime = new Date().toISOString();
  const stats: WriteStats = {
    pagesWritten: 0,
    recordsWritten: 0,
    assetsDownloaded: 0,
    assetsSkipped: 0,
  };

  await writePageTree(tree, outputDirAbsolute, n2m, config, syncTime, stats, true);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Summary ===');
  console.log(`  Pages synced: ${stats.pagesWritten}`);
  console.log(`  Database records: ${stats.recordsWritten}`);
  console.log(`  Assets downloaded: ${stats.assetsDownloaded}${stats.assetsSkipped ? ` (${stats.assetsSkipped} skipped)` : ''}`);
  console.log(`  Output: ${config.outputDir}/`);
  console.log(`  Elapsed: ${elapsed}s`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
