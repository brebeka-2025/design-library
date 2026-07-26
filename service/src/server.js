// design-library service: URL capture (Playwright) + AI analysis (Claude vision)
// Auth: every request must carry a valid Supabase user access token (Bearer).
// Secrets live in env vars only: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional).

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import crypto from 'node:crypto';

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = 'claude-sonnet-4-5',
  PORT = 8080,
} = process.env;

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY })) {
  if (!v) { console.error(`Missing required env var: ${k}`); process.exit(1); }
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---- CORS (frontend origin is public; auth is the real gate) ----
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- auth middleware: verify Supabase user JWT ----
async function requireUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = data.user;
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// ---- POST /capture { url } → full-page screenshot into storage ----
app.post('/capture', requireUser, async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Provide a valid http(s) url' });
  }
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
      // networkidle can hang on sites with long-polling; fall back to load
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    });
    await page.waitForTimeout(1500); // settle animations/lazy images
    const title = await page.title();
    const png = await page.screenshot({ fullPage: true, type: 'png' });
    await browser.close();
    browser = null;

    const imagePath = `captures/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage.from('inspiration').upload(imagePath, png, {
      contentType: 'image/png',
      upsert: false,
    });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    res.json({ image_path: imagePath, title: title || url, source_url: url });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('capture error:', err.message);
    res.status(500).json({ error: `Capture failed: ${err.message}` });
  }
});

// ---- analysis schema forced via tool use ----
const analysisTool = {
  name: 'record_design_analysis',
  description: 'Record the structured design analysis of an inspiration screenshot.',
  input_schema: {
    type: 'object',
    properties: {
      suggested_family_key: { type: 'string', description: 'Key of the best-matching existing aesthetic family, or a new snake_case key if none fits.' },
      suggested_family_name: { type: 'string', description: 'Display name for the family (existing name, or a proposed new one).' },
      family_is_new: { type: 'boolean' },
      keywords: { type: 'array', items: { type: 'string' }, description: '5-10 short design vocabulary keywords.' },
      style_tokens: {
        type: 'object',
        properties: {
          palette: { type: 'array', items: { type: 'string' }, description: 'Dominant colors as hex strings, most dominant first.' },
          fonts: { type: 'object', properties: {
            display: { type: 'string', description: 'Display/heading face or closest classification (e.g. "high-contrast serif, Fraunces-like")' },
            body: { type: 'string' },
            mono_accent: { type: 'string', description: 'Monospace/label face if present, else empty' }
          } },
          spacing: { type: 'string', description: 'Spacing character, e.g. "generous vertical rhythm, tight intra-group"' },
          layout_pattern: { type: 'string', description: 'e.g. "single column, monumental hero, left-rail index"' },
          motion: { type: 'string', description: 'Observed/implied motion character, or "static"' }
        }
      },
      designer_analysis: { type: 'string', description: '2-4 paragraphs in a senior graphic designer voice: what is on the canvas, and which design principles are doing the work (hierarchy, contrast, grid, whitespace, color theory, typography). Specific, not generic.' },
      image_recipe: { type: 'string', description: 'A fill-in image-generation prompt template starting with "[SUBJECT: ...]" that would reproduce the hero/imagery style at 2K. Strict palette and style constraints included.' },
      brief: { type: 'string', description: 'A concise build brief capturing the aesthetic so a developer/AI could produce new work with this feel: aesthetic family, type system, palette, layout, spacing, motion, what to avoid.' },
      title_suggestion: { type: 'string', description: 'Short evocative title for this library item.' }
    },
    required: ['suggested_family_key', 'suggested_family_name', 'family_is_new', 'keywords', 'style_tokens', 'designer_analysis', 'image_recipe', 'brief', 'title_suggestion']
  }
};

function analysisPrompt(families, designType, bobNote) {
  return `You are a senior graphic designer with 20 years across editorial, brand, and digital work. Analyze this ${designType || 'design'} screenshot for a personal inspiration library.

Existing aesthetic families (prefer matching one; propose new only when nothing fits):
${families.map(f => `- ${f.key}: ${f.name}${f.description ? ` — ${f.description}` : ''}`).join('\n')}

${bobNote ? `The collector's note on why they saved it: "${bobNote}". Weigh what they responded to.` : ''}

Describe what you actually see — name the specific moves, not generic praise. Identify which design principles carry the piece. Extract precise style tokens (sample real hexes from the image). Then record everything with the record_design_analysis tool.`;
}

// ---- POST /analyze { item_id } → Claude vision → draft fields on item ----
app.post('/analyze', requireUser, async (req, res) => {
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ error: 'Provide item_id' });
  try {
    const { data: item, error: itemErr } = await admin
      .from('items')
      .select('*, design_types(name), aesthetic_families(name)')
      .eq('id', item_id)
      .single();
    if (itemErr || !item) return res.status(404).json({ error: 'Item not found' });
    if (!item.image_path) return res.status(400).json({ error: 'Item has no image to analyze' });

    const { data: img, error: dlErr } = await admin.storage.from('inspiration').download(item.image_path);
    if (dlErr) throw new Error(`Image download failed: ${dlErr.message}`);
    let buf = Buffer.from(await img.arrayBuffer());

    // Claude vision caps: keep under ~5MB / 8000px. Full-page captures can exceed both.
    if (buf.length > 4.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large for analysis (>4.5MB). Re-capture or upload a smaller crop.' });
    }

    const { data: families } = await admin.from('aesthetic_families').select('key,name,description').order('name');

    const msg = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      tools: [analysisTool],
      tool_choice: { type: 'tool', name: 'record_design_analysis' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: buf.toString('base64') } },
          { type: 'text', text: analysisPrompt(families || [], item.design_types?.name, item.bob_note) },
        ],
      }],
    });

    const toolUse = msg.content.find(c => c.type === 'tool_use');
    if (!toolUse) throw new Error('Model returned no structured analysis');
    const a = toolUse.input;

    // Resolve family: match existing by key, or create a new one (stays subject to Bob's review of the item)
    let familyId = null;
    const { data: existing } = await admin.from('aesthetic_families').select('id').eq('key', a.suggested_family_key).maybeSingle();
    if (existing) {
      familyId = existing.id;
    } else if (a.family_is_new && a.suggested_family_key) {
      const { data: created } = await admin.from('aesthetic_families')
        .insert({ key: a.suggested_family_key, name: a.suggested_family_name || a.suggested_family_key })
        .select('id').single();
      familyId = created?.id ?? null;
    }

    const { data: updated, error: upErr } = await admin.from('items').update({
      aesthetic_family_id: familyId,
      keywords: a.keywords || [],
      style_tokens: a.style_tokens || {},
      designer_analysis: a.designer_analysis,
      image_recipe: a.image_recipe,
      brief: a.brief,
      title: item.title === 'Untitled' && a.title_suggestion ? a.title_suggestion : item.title,
      analysis_model: ANTHROPIC_MODEL,
      analyzed_at: new Date().toISOString(),
    }).eq('id', item_id).select('*').single();
    if (upErr) throw new Error(`Item update failed: ${upErr.message}`);

    res.json({ item: updated });
  } catch (err) {
    console.error('analyze error:', err.message);
    res.status(500).json({ error: `Analysis failed: ${err.message}` });
  }
});

app.listen(PORT, () => console.log(`design-library service on :${PORT}`));
