export function handlePriceInput(value: string) {
  const number = value.replace(/[^0-9]/g, '')

  if (!number) {
    return ''
  }

  return Number(number).toLocaleString('en-US')
}
