import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Brand, DesignType, AestheticFamily, Item, ItemStatus } from '../lib/types'

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase.from('brands').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useDesignTypes() {
  return useQuery({
    queryKey: ['design_types'],
    queryFn: async (): Promise<DesignType[]> => {
      const { data, error } = await supabase.from('design_types').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useFamilies() {
  return useQuery({
    queryKey: ['families'],
    queryFn: async (): Promise<AestheticFamily[]> => {
      const { data, error } = await supabase.from('aesthetic_families').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useItems(status: ItemStatus | 'all' = 'approved') {
  return useQuery({
    queryKey: ['items', status],
    queryFn: async (): Promise<Item[]> => {
      let q = supabase.from('items').select('*').order('created_at', { ascending: false })
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Item> }) => {
      const { data, error } = await supabase.from('items').update(patch).eq('id', id).select('*').single()
      if (error) throw error
      return data as Item
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export interface StyleProfile {
  id: string
  version: number
  content: string
  status: 'draft' | 'approved' | 'superseded'
  created_at: string
}

export function useProfiles() {
  return useQuery({
    queryKey: ['style_profiles'],
    queryFn: async (): Promise<StyleProfile[]> => {
      const { data, error } = await supabase.from('style_profiles').select('*').order('version', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCurrentProfile(): StyleProfile | null {
  const profiles = useProfiles().data ?? []
  return profiles.find(p => p.status === 'approved') ?? null
}

export function useSaveProfileDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ content, existingDraftId, nextVersion }: { content: string; existingDraftId?: string; nextVersion: number }) => {
      if (existingDraftId) {
        const { error } = await supabase.from('style_profiles').update({ content }).eq('id', existingDraftId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('style_profiles').insert({ version: nextVersion, content, status: 'draft' })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['style_profiles'] }),
  })
}

export function useApproveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error: supErr } = await supabase.from('style_profiles').update({ status: 'superseded' }).eq('status', 'approved')
      if (supErr) throw supErr
      const { error } = await supabase.from('style_profiles').update({ status: 'approved' }).eq('id', draftId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['style_profiles'] }),
  })
}

export function useDiscardProfileDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from('style_profiles').delete().eq('id', draftId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['style_profiles'] }),
  })
}

export function useInsertItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: Partial<Item>) => {
      const { data, error } = await supabase.from('items').insert(row).select('*').single()
      if (error) throw error
      return data as Item
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries()
}
