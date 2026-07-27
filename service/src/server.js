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

// media type from storage path extension (uploads may be jpg/webp, captures are png)
function mediaTypeFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';
}


// ---- shared: resilient full-page screenshot ----
async function capturePage(url) {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    // Bot-protected/heavy sites often never reach full "load". Get the DOM,
    // then opportunistically settle, then shoot what we have.
    let navError = null;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => { navError = e; });
    if (page.url() === 'about:blank') throw navError ?? new Error('Navigation failed');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500); // settle animations/lazy images
    const title = await page.title();
    const png = await page.screenshot({ fullPage: true, type: 'png' });
    return { png, title };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---- POST /capture { url } → full-page screenshot into storage ----
app.post('/capture', requireUser, async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Provide a valid http(s) url' });
  }
  try {
    const { png, title } = await capturePage(url);

    const imagePath = `captures/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage.from('inspiration').upload(imagePath, png, {
      contentType: 'image/png',
      upsert: false,
    });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    res.json({ image_path: imagePath, title: title || url, source_url: url });
  } catch (err) {
    console.error('capture error:', err.message);
    res.status(500).json({ error: `Capture failed: ${err.message}` });
  }
});

// ---- brand extraction schema ----
const brandTool = {
  name: 'record_brand_guidelines',
  description: 'Record draft brand guidelines extracted from a website screenshot or brand asset.',
  input_schema: {
    type: 'object',
    properties: {
      positioning: { type: 'string', description: 'One-line positioning statement inferred from the material.' },
      audience: { type: 'string', description: 'Who this brand appears to speak to.' },
      colors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Role name, e.g. Primary, Accent, Ground, Text' },
            hex: { type: 'string' },
            usage: { type: 'string', description: 'Usage rule, e.g. "interactive elements only"' }
          },
          required: ['name', 'hex', 'usage']
        }
      },
      typography: {
        type: 'object',
        properties: {
          display: { type: 'string', description: 'Display face or closest classification' },
          body: { type: 'string' },
          mono: { type: 'string', description: 'Mono/label face if any, else empty' },
          weights: { type: 'string' },
          min_body_px: { type: 'string' },
          fallbacks: { type: 'string' }
        }
      },
      layout: {
        type: 'object',
        properties: {
          density: { type: 'string' },
          radius: { type: 'string' },
          shadows: { type: 'string' },
          spacing: { type: 'string' }
        }
      },
      imagery: { type: 'string', description: 'Photography/illustration style rules observed.' },
      motion: { type: 'string', description: 'Motion character, or "static/unknown".' },
      voice_rules: { type: 'string', description: 'Tone-of-voice rules inferred from copy visible in the material.' },
      never: { type: 'array', items: { type: 'string' }, description: 'Anti-references: things this brand should never do.' }
    },
    required: ['colors', 'typography']
  }
};

// ---- POST /analyze-brand { url } or { image_path } → draft guidelines (NOT saved) ----
app.post('/analyze-brand', requireUser, async (req, res) => {
  const { url, image_path } = req.body || {};
  if (!url && !image_path) return res.status(400).json({ error: 'Provide url or image_path' });
  try {
    let buf;
    if (url) {
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Provide a valid http(s) url' });
      const { png } = await capturePage(url);
      buf = png;
    } else {
      const { data: img, error: dlErr } = await admin.storage.from('inspiration').download(image_path);
      if (dlErr) throw new Error(`Image download failed: ${dlErr.message}`);
      buf = Buffer.from(await img.arrayBuffer());
    }
    if (buf.length > 4.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large for analysis (>4.5MB).' });
    }

    const msg = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 3000,
      tools: [brandTool],
      tool_choice: { type: 'tool', name: 'record_brand_guidelines' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: url ? 'image/png' : mediaTypeFor(image_path), data: buf.toString('base64') } },
          { type: 'text', text: 'You are a senior brand designer reverse-engineering brand guidelines from this material. Extract precise, defensible values: sample real hexes, name each color\'s usage rule as observed (e.g. accent only on CTAs), classify the typefaces, describe layout, imagery, and motion character, and infer tone-of-voice rules from any visible copy. Where the material gives no evidence, leave the field brief and hedged rather than inventing. Record with the record_brand_guidelines tool.' },
        ],
      }],
    });
    const toolUse = msg.content.find(c => c.type === 'tool_use');
    if (!toolUse) throw new Error('Model returned no structured guidelines');
    res.json({ draft: toolUse.input });
  } catch (err) {
    console.error('analyze-brand error:', err.message);
    res.status(500).json({ error: `Brand analysis failed: ${err.message}` });
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
          { type: 'image', source: { type: 'base64', media_type: mediaTypeFor(item.image_path), data: buf.toString('base64') } },
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

// ============ The Crit: collaborative studio critique ============

function critSystemPrompt({ profile, brand, intent, title }) {
  return `You are a world-class graphic designer — the caliber of a design director whose crits people remember for years — running a design-school style studio crit with Bob (a marketing manager who took art/architecture/design classes and values real crits). The work under review: "${title}". ${intent ? `Stated intent: ${intent}` : 'Intent not yet stated — ask for it first.'}

Opening the crit (your first message): greet briefly like a colleague at the wall, read the work aloud — what you see and the order your eye travels it, in a few sentences — then ask at most two sharp intent questions (audience? the one action wanted?). Do not evaluate before intent is established.

Studio crit rules:
- Questions before judgments. Anchor on intent: audience, single message, desired action.
- Read the work aloud: describe what you see and the order the eye travels it, before evaluating.
- Name principles precisely (alignment, contrast, balance, hierarchy, color, white space, proportion, repetition, rhythm, movement, emphasis, proximity, unity, variety; Gestalt: figure-ground, similarity, continuity, closure; 60-30-10; typography classification). Every claim needs on-canvas evidence.
- This is a conversation, not a verdict. Short turns (2-4 paragraphs max), end with a question or a concrete next consideration. Invite pushback; Bob's taste calls win.
- When you and Bob agree on something, say so plainly: "That's a ruling: ..." so it can be captured later.
- When Bob opens a message with a markdown heading naming a principle (e.g. "## Contrast"), he is convening discussion on that principle. Respond under the same heading, keep the turn focused there (evidence from this work only), and when agreement lands, state the ruling explicitly tied to that principle.

Bob's standing rules: never Inter; never purple-to-blue gradients, 3D SaaS blobs, or gradient text. Brands: driver = Driver (product) vs dis = Driver Industrial Safety (company) — never conflate. Target emotion for Driver work: recognition ("this company understands my world"); imagery documentary-industrial. US English.
${brand ? `\nBrand context (${brand.name}): ${JSON.stringify(brand.tokens || {})}${brand.voice_rules ? ` Voice: ${brand.voice_rules}` : ''}` : ''}
${profile ? `\nBob's learned style profile (v${profile.version}) — critique against these agreed rulings:\n${profile.content}` : '\nNo style profile yet — this crit may produce its first rulings.'}`;
}

// POST /crit { session_id?, new_session?: {title,image_path,item_id,brand_id,intent}, message }
app.post('/crit', requireUser, async (req, res) => {
  const { session_id, new_session, message } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'Provide a message' });
  try {
    let session;
    if (session_id) {
      const { data, error } = await admin.from('crit_sessions').select('*').eq('id', session_id).single();
      if (error || !data) return res.status(404).json({ error: 'Session not found' });
      session = data;
    } else if (new_session?.image_path && new_session?.title) {
      const { data, error } = await admin.from('crit_sessions').insert({
        title: new_session.title,
        image_path: new_session.image_path,
        item_id: new_session.item_id || null,
        brand_id: new_session.brand_id || null,
        intent: new_session.intent || null,
      }).select('*').single();
      if (error) throw error;
      session = data;
    } else {
      return res.status(400).json({ error: 'Provide session_id or new_session {title, image_path}' });
    }

    await admin.from('crit_messages').insert({ session_id: session.id, role: 'user', content: message });

    const [{ data: history }, { data: img, error: dlErr }, { data: profiles }, brandRow] = await Promise.all([
      admin.from('crit_messages').select('role,content').eq('session_id', session.id).order('created_at'),
      admin.storage.from('inspiration').download(session.image_path),
      admin.from('style_profiles').select('version,content').eq('status', 'approved').order('version', { ascending: false }).limit(1),
      session.brand_id ? admin.from('brands').select('name,tokens,voice_rules').eq('id', session.brand_id).single() : Promise.resolve({ data: null }),
    ]);
    if (dlErr) throw new Error(`Image download failed: ${dlErr.message}`);
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 4.5 * 1024 * 1024) return res.status(400).json({ error: 'Image too large for crit (>4.5MB)' });

    const apiMessages = (history || []).map((m, i) => ({
      role: m.role,
      content: i === 0 && m.role === 'user'
        ? [
            { type: 'image', source: { type: 'base64', media_type: mediaTypeFor(session.image_path), data: buf.toString('base64') } },
            { type: 'text', text: m.content },
          ]
        : m.content,
    }));

    const msg = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: critSystemPrompt({ profile: profiles?.[0] || null, brand: brandRow.data, intent: session.intent, title: session.title }),
      messages: apiMessages,
    });
    const reply = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    await admin.from('crit_messages').insert({ session_id: session.id, role: 'assistant', content: reply });

    res.json({ session_id: session.id, reply });
  } catch (err) {
    console.error('crit error:', err.message);
    res.status(500).json({ error: `Crit failed: ${err.message}` });
  }
});

// POST /crit/capture { session_id } → distill agreed rulings → style profile DRAFT
const rulingsTool = {
  name: 'record_rulings',
  description: 'Record the rulings Bob and the critic explicitly agreed on during this crit, tagged by design principle.',
  input_schema: {
    type: 'object',
    properties: {
      rulings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            principle: { type: 'string', description: 'The design principle this ruling belongs to: Alignment, Contrast, Balance, Hierarchy, Color, White space, Proportion, Repetition, Rhythm, Movement, Emphasis, Proximity, Unity, Variety — or "General" if it spans several.' },
            ruling: { type: 'string', description: 'One plain declarative sentence. Only genuinely agreed points — not the critic\'s unaccepted suggestions.' },
          },
          required: ['principle', 'ruling'],
        },
      },
    },
    required: ['rulings'],
  },
};

app.post('/crit/capture', requireUser, async (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'Provide session_id' });
  try {
    const { data: session } = await admin.from('crit_sessions').select('*').eq('id', session_id).single();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { data: history } = await admin.from('crit_messages').select('role,content').eq('session_id', session_id).order('created_at');
    if (!history?.length) return res.status(400).json({ error: 'Nothing to capture yet' });

    const transcript = history.map(m => `${m.role === 'user' ? 'BOB' : 'CRITIC'}: ${m.content}`).join('\n\n');
    const msg = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      tools: [rulingsTool],
      tool_choice: { type: 'tool', name: 'record_rulings' },
      messages: [{ role: 'user', content: `Distill this studio-crit transcript into the rulings both parties explicitly agreed on. Bob's agreement (or his own assertion) is required — do not include critic suggestions Bob didn't accept. Concise declarative sentences.\n\n${transcript}` }],
    });
    const rulings = msg.content.find(c => c.type === 'tool_use')?.input?.rulings || [];
    if (!rulings.length) return res.status(400).json({ error: 'No agreed rulings found in this crit yet' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const section = `\n\n## Rulings from crit — ${session.title} (${dateStr})\n${rulings.map(r => `- **${r.principle}:** ${r.ruling}`).join('\n')}`;

    const { data: all } = await admin.from('style_profiles').select('*').order('version', { ascending: false });
    const draft = (all || []).find(p => p.status === 'draft');
    const current = (all || []).find(p => p.status === 'approved');
    if (draft) {
      await admin.from('style_profiles').update({ content: draft.content + section }).eq('id', draft.id);
      res.json({ rulings, draft_version: draft.version });
    } else {
      const version = ((all?.[0]?.version) || 0) + 1;
      const base = current?.content || `# Bob's style profile`;
      await admin.from('style_profiles').insert({ version, content: base + section, status: 'draft' });
      res.json({ rulings, draft_version: version });
    }
  } catch (err) {
    console.error('crit capture error:', err.message);
    res.status(500).json({ error: `Capture failed: ${err.message}` });
  }
});

app.listen(PORT, () => console.log(`design-library service on :${PORT}`));
