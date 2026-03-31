import { useState, useEffect, useCallback } from 'react';
import { UserProfile, UserProfileUpdateInput } from '../types/user';
import { getUserProfile, updateUserProfile } from '../api/client';

export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    getUserProfile(id)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  const updateProfile = useCallback(async (data: UserProfileUpdateInput) => {
    setUpdating(true);
    try {
      const updated = await updateUserProfile(id, data);
      setProfile(updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Update failed'));
      throw e;
    } finally {
      setUpdating(false);
    }
  }, [id]);

  return { profile, loading, error, updating, updateProfile };
}
