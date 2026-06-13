import { useState, useEffect } from 'react';
import { User } from '../types/user';
import { getUsers } from '../api/client';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { users, loading, error };
}
