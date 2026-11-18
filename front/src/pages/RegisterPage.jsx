import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Field } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';
import { roleHome } from '../utils/user.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', repeat: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Укажите имя';
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Введите корректный email';
    if (form.password.length < 8) errs.password = 'Минимум 8 символов';
    if (form.repeat !== form.password) errs.repeat = 'Пароли не совпадают';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const user = await register(form.name.trim(), form.email.trim(), form.password);
      toast(`Аккаунт создан. Здравствуйте, ${user.name}!`, 'success');
      navigate(roleHome(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 className="auth-title">Регистрация</h1>
        <p className="auth-sub">
          Создаётся аккаунт клиента. Аккаунты сотрудников заводит администратор.
        </p>

        {error && <div className="form-banner" role="alert">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          <Field label="Имя" error={fieldErrors.name}>
            <input
              className={`input${fieldErrors.name ? ' input--error' : ''}`}
              value={form.name}
              onChange={set('name')}
              placeholder="Иван Иванов"
              autoComplete="name"
            />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input
              className={`input${fieldErrors.email ? ' input--error' : ''}`}
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Пароль" error={fieldErrors.password} hint="Минимум 8 символов">
            <input
              className={`input${fieldErrors.password ? ' input--error' : ''}`}
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Повторите пароль" error={fieldErrors.repeat}>
            <input
              className={`input${fieldErrors.repeat ? ' input--error' : ''}`}
              type="password"
              value={form.repeat}
              onChange={set('repeat')}
              autoComplete="new-password"
            />
          </Field>
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="auth-foot">
          Уже есть аккаунт? <Link to="/login">Войдите</Link>
        </p>
      </div>
    </div>
  );
}
