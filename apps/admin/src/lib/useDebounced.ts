import { useEffect, useState } from 'react';

/**
 * Debounce a value.
 *
 * 250 ms is the number the supplier grid uses: fast enough that typing a four
 * digit code feels instant, slow enough that it is one request rather than four
 * on a connection shared with the phones (§20.1).
 */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
