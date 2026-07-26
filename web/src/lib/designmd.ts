import type { Brand, Item, AestheticFamily, DesignType } from './types'

/**
 * Generate a DESIGN.md that Impeccable (and any AI coding agent) consumes as
 * the committed visual world. This is the integration seam: the library
 * manufactures taste context; Impeccable's 23 commands execute inside it.
 */
export function buildDesignMd(item: Item, family: AestheticFamily | null, brand: Brand | null, designType: DesignType | null): string {
  const t = item.style_tokens || {}
  const lines: string[] = []
  lines.push(`# DESIGN.md — ${item.title}`)
  lines.push('')
  lines.push(`> Generated from design-library item on ${new Date().toISOString().slice(0, 10)}.`)
  lines.push(`> Aesthetic family: ${family?.name ?? 'unassigned'}${brand ? ` · Brand: ${brand.name}` : ''}`)
  lines.push('')
  lines.push('## Visual world')
  lines.push('')
  if (family?.description) lines.push(`${family.description}`)
  if (item.brief) { lines.push(''); lines.push(item.brief) }
  lines.push('')
  lines.push('## Tokens')
  lines.push('')
  if (t.palette?.length) {
    lines.push(`- **Palette (dominant first):** ${t.palette.join(', ')}`)
  }
  if (t.fonts) {
    if (t.fonts.display) lines.push(`- **Display type:** ${t.fonts.display}`)
    if (t.fonts.body) lines.push(`- **Body type:** ${t.fonts.body}`)
    if (t.fonts.mono_accent) lines.push(`- **Mono/label type:** ${t.fonts.mono_accent}`)
  }
  if (t.spacing) lines.push(`- **Spacing:** ${t.spacing}`)
  if (t.layout_pattern) lines.push(`- **Layout:** ${t.layout_pattern}`)
  if (t.motion) lines.push(`- **Motion:** ${t.motion}`)
  if (item.keywords?.length) {
    lines.push('')
    lines.push(`**Vocabulary:** ${item.keywords.join(' · ')}`)
  }
  if (designType?.format_profile?.constraints?.length) {
    lines.push('')
    lines.push(`## Format constraints (${designType.name})`)
    lines.push('')
    for (const c of designType.format_profile.constraints) lines.push(`- ${c}`)
  }
  if (brand && (brand.voice_rules || Object.keys(brand.tokens || {}).length)) {
    lines.push('')
    lines.push(`## Brand constraints (${brand.name})`)
    lines.push('')
    if (brand.voice_rules) lines.push(brand.voice_rules)
    if (Object.keys(brand.tokens || {}).length) {
      lines.push('')
      lines.push('```json')
      lines.push(JSON.stringify(brand.tokens, null, 2))
      lines.push('```')
    }
  }
  lines.push('')
  lines.push('## Anti-references (never do)')
  lines.push('')
  lines.push('- No Inter font. No purple-to-blue gradients. No 3D SaaS blobs.')
  lines.push('- No identical icon-card grids as page structure. No gradient text.')
  lines.push('- Match the feel of the reference, not its content.')
  lines.push('')
  if (item.designer_analysis) {
    lines.push('## Designer analysis (reference reading)')
    lines.push('')
    lines.push(item.designer_analysis)
    lines.push('')
  }
  return lines.join('\n')
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
