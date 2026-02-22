import { useEffect } from 'react';

export function useRefreshListener(callback: () => void) {
  useEffect(() => {
    window.addEventListener('dms-refresh', callback);
    return () => window.removeEventListener('dms-refresh', callback);
  }, [callback]);
}
