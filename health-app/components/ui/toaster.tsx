'use client'

import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastAction, ToastClose } from './toast'
import { useToast } from './use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast key={t.id} duration={t.duration ?? 4000} onOpenChange={(open) => !open && dismiss(t.id)}>
          <div className="flex-1 min-w-0 pr-5">
            <ToastTitle>{t.title}</ToastTitle>
            {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
            {t.action && (
              <ToastAction altText={t.action.altText} onClick={t.action.onClick} className="mt-2.5">
                {t.action.label}
              </ToastAction>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
