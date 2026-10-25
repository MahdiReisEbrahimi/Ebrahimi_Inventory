export type ToastVariant = 'default' | 'success' | 'warning' | 'destructive'

function showToast(message: string, variant: ToastVariant = 'default') {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, variant } }))
}

export const toast = {
  success: (message: string) => showToast(message, 'success'),
  warning: (message: string) => showToast(message, 'warning'),
  error: (message: string) => showToast(message, 'destructive'),
  info: (message: string) => showToast(message, 'default'),
}

export async function confirmAction(message: string, title = 'تأیید عملیات') {
  return window.confirm(`${title}\n\n${message}`)
}
