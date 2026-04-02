'use client';

import React, { useState } from 'react';
import { UserProfile } from '../types/user';
import { useFormValidation } from '../hooks/useFormValidation';
import { ValidationRules } from '../types/validation';
import styles from './ProfileEditForm.module.css';

type ProfileFormField = 'name' | 'bio' | 'location' | 'website';

const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

const PROFILE_VALIDATION_RULES: ValidationRules<ProfileFormField> = {
  name: [
    { type: 'required', message: '名前は必須です' },
    { type: 'maxLength', maxLength: 50, message: '名前は50文字以内で入力してください' },
  ],
  bio: [
    { type: 'maxLength', maxLength: 200, message: '自己紹介は200文字以内で入力してください' },
  ],
  location: [
    { type: 'maxLength', maxLength: 100, message: '所在地は100文字以内で入力してください' },
  ],
  website: [
    {
      type: 'pattern',
      pattern: URL_REGEX,
      message: 'URLは http:// または https:// で始まる正しい形式で入力してください',
    },
  ],
};

interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  profile,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { errors, validateField, validateAll, hasErrors } =
    useFormValidation<ProfileFormField>(PROFILE_VALIDATION_RULES);

  const handleBlur = (field: ProfileFormField, value: string) => {
    validateField(field, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateAll({
      name,
      bio,
      location,
      website,
    });
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '保存に失敗しました'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>プロフィール編集</h2>

      <div className={styles.field}>
        <label htmlFor="name">名前 *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur('name', name)}
          maxLength={50}
          className={errors.name ? styles.inputError : undefined}
        />
        {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
      </div>

      <div className={styles.field}>
        <label>メールアドレス</label>
        <div className={styles.readOnly}>{profile.email}</div>
      </div>

      <div className={styles.field}>
        <label htmlFor="bio">自己紹介</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          onBlur={() => handleBlur('bio', bio)}
          maxLength={200}
          className={errors.bio ? styles.inputError : undefined}
        />
        <div className={styles.charCount}>{bio.length}/200</div>
        {errors.bio && <div className={styles.fieldError}>{errors.bio}</div>}
      </div>

      <div className={styles.field}>
        <label htmlFor="location">所在地</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => handleBlur('location', location)}
          maxLength={100}
          className={errors.location ? styles.inputError : undefined}
        />
        {errors.location && (
          <div className={styles.fieldError}>{errors.location}</div>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="website">Webサイト</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          onBlur={() => handleBlur('website', website)}
          placeholder="https://example.com"
          className={errors.website ? styles.inputError : undefined}
        />
        {errors.website && (
          <div className={styles.fieldError}>{errors.website}</div>
        )}
      </div>

      <div className={styles.field}>
        <label>登録日</label>
        <div className={styles.readOnly}>
          {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
        </div>
      </div>

      {saveError && <div className={styles.errorMessage}>{saveError}</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSaving || hasErrors}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSaving}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
};
