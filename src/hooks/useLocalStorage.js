import { useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = (val) => {
    const toStore = typeof val === 'function' ? val(value) : val
    setValue(toStore)
    localStorage.setItem(key, JSON.stringify(toStore))
  }

  return [value, setStoredValue]
}
