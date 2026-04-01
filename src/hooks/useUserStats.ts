import { useState, useEffect } from 'react';
import { UserStats } from '../types/user';
import { getUserStats } from '../api/client';

export function useUserStats(id: string) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getUserStats(id)
      .then(setStats)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { stats, loading, error };
}
