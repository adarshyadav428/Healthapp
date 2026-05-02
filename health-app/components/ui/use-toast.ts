import { create } from 'zustand'

export type ToastVariant = 'default' | 'success' | 'error'

export type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
}

type ToastItem = ToastOptions & { id: string }

type ToastState = {
  toasts: ToastItem[]
  add: (toast: ToastOptions) => void
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  return useToastStore()
}

export function toast(options: ToastOptions) {
  useToastStore.getState().add(options)
}
