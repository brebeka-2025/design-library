export type ItemStatus = 'pending_review' | 'approved' | 'archived'

export interface BrandColor {
  name: string
  hex: string
  usage: string
}

export interface BrandTokens {
  positioning?: string
  audience?: string
  colors?: BrandColor[]
  typography?: { display?: string; body?: string; mono?: string; weights?: string; min_body_px?: string; fallbacks?: string }
  layout?: { density?: string; radius?: string; shadows?: string; spacing?: string }
  imagery?: string
  motion?: string
  never?: string[]
}

export interface Brand {
  id: string
  key: string
  name: string
  tokens: BrandTokens
  voice_rules: string | null
  notes: string | null
}

export interface DesignType {
  id: string
  key: string
  name: string
  format_profile: { notes?: string; constraints?: string[] }
  sort_order: number
}

export interface AestheticFamily {
  id: string
  key: string
  name: string
  description: string | null
}

export interface StyleTokens {
  palette?: string[]
  fonts?: { display?: string; body?: string; mono_accent?: string }
  spacing?: string
  layout_pattern?: string
  motion?: string
}

export interface Item {
  id: string
  title: string
  source_url: string | null
  captured_at: string
  image_path: string | null
  design_type_id: string | null
  aesthetic_family_id: string | null
  brand_id: string | null
  status: ItemStatus
  bob_note: string | null
  keywords: string[]
  style_tokens: StyleTokens
  designer_analysis: string | null
  image_recipe: string | null
  brief: string | null
  analysis_model: string | null
  analyzed_at: string | null
  created_at: string
  updated_at: string
}

export interface ItemUsage {
  id: string
  item_id: string
  project_name: string
  outcome_rating: number | null
  notes: string | null
  used_at: string
}
