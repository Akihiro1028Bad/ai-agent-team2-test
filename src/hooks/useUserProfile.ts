import { useState, useEffect } from 'react';
import { UserProfile } from '../types/user';
import { getUserProfile, updateUserProfile } from '../api/client';

export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getUserProfile(id)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    const updated = await updateUserProfile(id, data);
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, updateProfile };
}
