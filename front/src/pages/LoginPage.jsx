import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Field } from '../components/Field.jsx';
import { useToast } from '../components/Toast.jsx';
import { roleHome } from '../utils/user.js';

// Демо-аккаунты из seed-данных бэкенда (см. back/README.md).
// Нажатие на строку подставляет данные в форму — удобно показывать на защите.
const DEMO_ACCOUNTS = [
  { role: 'Администратор', email: 'admin@example.com', password: 'admin12345' },
  { role: 'Сотрудник Иван', email: 'ivan@example.com', password: 'employee123' },
  { role: 'Сотрудник Пётр', email: 'petr@example.com', password: 'employee123' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Заполните email и пароль');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      toast(`Здравствуйте, ${user.name}!`, 'success');
      // после входа возвращаем на страницу, с которой пользователь пришёл
      navigate(location.state ? location.state.from : roleHome(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 className="auth-title">Вход</h1>
        <p className="auth-sub">Войдите, чтобы видеть свои заявки и расписание.</p>

        {error && <div className="form-banner" role="alert">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </Field>
          <Field label="Пароль">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
            />
          </Field>
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="auth-foot">
          Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
        </p>

        <details className="demo">
          <summary>Демо-доступы для проверки</summary>
          <table>
            <tbody>
              {DEMO_ACCOUNTS.map((acc) => (
                <tr key={acc.email}>
                  <td>{acc.role}</td>
                  <td>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        setEmail(acc.email);
                        setPassword(acc.password);
                        setError('');
                      }}
                      title="Подставить в форму"
                    >
                      {acc.email}
                    </button>
                  </td>
                  <td className="mono">{acc.password}</td>
                </tr>
              ))}
              <tr>
                <td>Клиент</td>
                <td colSpan="2">зарегистрируйтесь самостоятельно</td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>
    </div>
  );
}
