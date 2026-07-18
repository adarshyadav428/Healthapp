import { create } from 'zustand'

/**
 * What prompted the ask. Becomes the `trigger` prop on `account_saved`, so we
 * can tell which moments actually convert anonymous users and drop the ones
 * that only annoy them.
 */
export type SaveAccountTrigger =
  | 'camera_scan'
  | 'chat_log'
  | 'upgrade'
  | 'first_log'
  | 'settings'

type SaveAccountState = {
  trigger: SaveAccountTrigger | null
  open: (trigger: SaveAccountTrigger) => void
  close: () => void
}

/**
 * Drives the single SaveAccountSheet mounted in Providers. A store rather than
 * prop-drilling because the triggers are scattered across unrelated surfaces
 * (the camera hook, the chat hook, the upgrade path) that share no common
 * ancestor near enough to hold the state.
 */
export const useSaveAccountStore = create<SaveAccountState>((set) => ({
  trigger: null,
  open: (trigger) => set({ trigger }),
  close: () => set({ trigger: null }),
}))

/** Imperative opener for non-component callers (fetch handlers in hooks). */
export function openSaveAccount(trigger: SaveAccountTrigger): void {
  useSaveAccountStore.getState().open(trigger)
}

export default useSaveAccountStore
