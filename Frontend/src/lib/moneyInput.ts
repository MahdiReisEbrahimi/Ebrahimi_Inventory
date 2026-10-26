const separators = /[,٬\s]/g
const normalize = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(separators, '')

export const isMoneyInputValue = (value: string | number) =>
  /^-?\d*(?:\.\d*)?$/.test(normalize(String(value)))

export function formatMoneyInput(value: string | number): string {
  const raw = normalize(String(value)).replace(/^(-?)0+(?=\d)/, '$1')
  // Preserve invalid input for validation rather than silently changing its amount.
  if (!isMoneyInputValue(raw)) return String(value)
  const [integer = '', fraction] = raw.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return (grouped + (fraction === undefined ? '' : '.' + fraction)).replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!,
  )
}

export function editMoneyInput(
  value: string,
  cursor: number,
  previous: string,
  inputType = '',
): { value: string; cursor: number } {
  let raw = normalize(value)
  let position = normalize(value.slice(0, cursor)).length
  const leadingZeros = /^-?0+(?=\d)/.exec(raw)?.[0].replace('-', '').length || 0
  position -= Math.min(leadingZeros, Math.max(0, position - (raw.startsWith('-') ? 1 : 0)))
  raw = raw.replace(/^(-?)0+(?=\d)/, '$1')
  // Deleting just a separator should delete the adjacent digit as well.
  if (raw === normalize(previous) && value !== previous) {
    const index = inputType === 'deleteContentBackward' ? position - 1 : position
    if (
      (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') &&
      /\d/.test(raw[index] || '')
    ) {
      raw = raw.slice(0, index) + raw.slice(index + 1)
      position = index
    }
  }
  const formatted = formatMoneyInput(raw)
  if (!/^-?\d*(?:\.\d*)?$/.test(raw)) return { value, cursor }
  let formattedCursor = 0
  let consumed = 0
  while (formattedCursor < formatted.length && consumed < position) {
    if (formatted[formattedCursor] !== '٬') consumed++
    formattedCursor++
  }
  return { value: formatted, cursor: formattedCursor }
}
