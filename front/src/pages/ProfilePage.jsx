import { useState } from 'react';
import { usersApi } from '../api/endpoints.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Field } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDateTime } from '../utils/format.js';
import { roleLabel } from '../utils/user.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Профиль любого авторизованного пользователя: правка имени/email и смена пароля.
export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  // --- форма профиля ---
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // --- форма пароля ---
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdFieldErrors, setPwdFieldErrors] = useState({});

  const saveProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Укажите имя';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Введите корректный email';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setProfileBusy(true);
    setProfileError('');
    try {
      const updated = await usersApi.updateMe({ name: name.trim(), email: email.trim() });
      updateUser(updated);
      toast('Профиль сохранён', 'success');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!oldPassword) errs.old = 'Введите текущий пароль';
    if (newPassword.length < 8) errs.new = 'Минимум 8 символов';
    if (repeat !== newPassword) errs.repeat = 'Пароли не совпадают';
    setPwdFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwdBusy(true);
    setPwdError('');
    try {
      await usersApi.changePassword(oldPassword, newPassword);
      toast('Пароль изменён', 'success');
      setOldPassword('');
      setNewPassword('');
      setRepeat('');
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Профиль</h1>
        <p className="page-head__sub">
          {roleLabel(user)} · аккаунт создан {fmtDateTime(user.created_at)}
        </p>
      </div>

      <div className="profile-grid">
        <form className="card card--pad" onSubmit={saveProfile} noValidate>
          <h2>Личные данные</h2>
          {profileError && <div className="form-banner" role="alert">{profileError}</div>}
          <Field label="Имя" error={fieldErrors.name}>
            <input
              className={`input${fieldErrors.name ? ' input--error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input
              className={`input${fieldErrors.email ? ' input--error' : ''}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <button className="btn btn--primary" type="submit" disabled={profileBusy}>
            {profileBusy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </form>

        <form className="card card--pad" onSubmit={changePassword} noValidate>
          <h2>Смена пароля</h2>
          {pwdError && <div className="form-banner" role="alert">{pwdError}</div>}
          <Field label="Текущий пароль" error={pwdFieldErrors.old}>
            <input
              className={`input${pwdFieldErrors.old ? ' input--error' : ''}`}
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="Новый пароль" error={pwdFieldErrors.new} hint="Минимум 8 символов">
            <input
              className={`input${pwdFieldErrors.new ? ' input--error' : ''}`}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Повторите новый пароль" error={pwdFieldErrors.repeat}>
            <input
              className={`input${pwdFieldErrors.repeat ? ' input--error' : ''}`}
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <button className="btn btn--primary" type="submit" disabled={pwdBusy}>
            {pwdBusy ? 'Меняем…' : 'Изменить пароль'}
          </button>
        </form>
      </div>
    </>
  );
}
