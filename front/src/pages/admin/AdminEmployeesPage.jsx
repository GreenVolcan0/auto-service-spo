import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ConfirmModal, Modal } from '../../components/Modal.jsx';
import { Field } from '../../components/Field.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SkeletonRows } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';

const PAGE_SIZE = 20;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const EMPTY_FORM = { name: '', email: '', password: '' };

// Управление аккаунтами сотрудников: создание, правка, смена пароля,
// деактивация (вместо удаления при наличии записей) и удаление.
export default function AdminEmployeesPage() {
  const toast = useToast();

  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- форма создания/правки ---
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = создание
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState({});

  // --- удаление ---
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Поиск с задержкой, чтобы не дёргать API на каждый символ
  useEffect(() => {
    const t = setTimeout(() => setQApplied(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminApi
      .employees({
        q: qApplied || undefined,
        is_active: activeFilter === '' ? undefined : activeFilter,
        limit: PAGE_SIZE,
        offset,
      })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [qApplied, activeFilter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormFieldErrors({});
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({ name: emp.name, email: emp.email, password: '' });
    setFormError('');
    setFormFieldErrors({});
    setModalOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Укажите имя';
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Введите корректный email';
    if (!editing && form.password.length < 8) errs.password = 'Минимум 8 символов';
    if (editing && form.password && form.password.length < 8) errs.password = 'Минимум 8 символов';
    setFormFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setFormBusy(true);
    setFormError('');
    try {
      if (editing) {
        const payload = { name: form.name.trim(), email: form.email.trim() };
        if (form.password) payload.password = form.password;
        await adminApi.updateEmployee(editing.id, payload);
        toast('Изменения сохранены', 'success');
      } else {
        await adminApi.createEmployee({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        toast('Сотрудник добавлен', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const toggleActive = async (emp) => {
    try {
      await adminApi.updateEmployee(emp.id, { is_active: !emp.is_active });
      toast(emp.is_active ? 'Аккаунт деактивирован' : 'Аккаунт снова активен', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await adminApi.deleteEmployee(deleteTarget.id);
      toast('Сотрудник удалён', 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <div className="page-head flex-between">
        <div>
          <h1 className="page-head__title">Сотрудники</h1>
          <p className="page-head__sub">
            Аккаунты мастеров{items !== null ? ` · всего: ${total}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Добавить сотрудника
        </button>
      </div>

      <div className="admin-toolbar">
        <input
          className="input"
          type="search"
          placeholder="Поиск по имени или email"
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
          }}
          aria-label="Поиск"
        />
        <select
          className="select"
          value={activeFilter}
          onChange={(e) => {
            setOffset(0);
            setActiveFilter(e.target.value);
          }}
          aria-label="Активность"
        >
          <option value="">Все статусы</option>
          <option value="true">Активные</option>
          <option value="false">Деактивированные</option>
        </select>
      </div>

      {error && (
        <div className="empty" role="alert">
          <div className="empty__title">Не удалось загрузить сотрудников</div>
          <p className="empty__text">{error}</p>
        </div>
      )}

      {!error && loading && items === null && <SkeletonRows rows={4} />}

      {items && items.length === 0 && !loading && (
        <EmptyState
          title="Сотрудников не найдено"
          text="Измените фильтры или добавьте первого сотрудника."
        />
      )}

      {items && items.length > 0 && (
        <>
          <div className="card admin-list__table table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td className="mono">{emp.email}</td>
                    <td>
                      <span className={`badge ${emp.is_active ? 'badge--active' : 'badge--inactive'}`}>
                        {emp.is_active ? 'Активен' : 'Деактивирован'}
                      </span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(emp)}>
                        Изменить
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleActive(emp)}>
                        {emp.is_active ? 'Деактивировать' : 'Активировать'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => setDeleteTarget(emp)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-list__cards">
            {items.map((emp) => (
              <div key={emp.id} className="card person-card">
                <div className="person-card__head">
                  <span className="person-card__name">{emp.name}</span>
                  <span className={`badge ${emp.is_active ? 'badge--active' : 'badge--inactive'}`}>
                    {emp.is_active ? 'Активен' : 'Деактивирован'}
                  </span>
                </div>
                <div className="person-card__meta mono">{emp.email}</div>
                <div className="person-card__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(emp)}>
                    Изменить
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleActive(emp)}>
                    {emp.is_active ? 'Деактивировать' : 'Активировать'}
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget(emp)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onPage={setOffset} />
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Правка: ${editing.name}` : 'Новый сотрудник'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)} disabled={formBusy}>
              Отмена
            </button>
            <button type="button" className="btn btn--primary" onClick={submitForm} disabled={formBusy}>
              {formBusy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </>
        }
      >
        <form onSubmit={submitForm} noValidate>
          <Field label="Имя" error={formFieldErrors.name}>
            <input
              className={`input${formFieldErrors.name ? ' input--error' : ''}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Email" error={formFieldErrors.email}>
            <input
              className={`input${formFieldErrors.email ? ' input--error' : ''}`}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field
            label="Пароль"
            error={formFieldErrors.password}
            hint={editing ? 'Оставьте пустым, чтобы не менять' : 'Минимум 8 символов'}
          >
            <input
              className={`input${formFieldErrors.password ? ' input--error' : ''}`}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
          </Field>
          {formError && <div className="form-banner" role="alert">{formError}</div>}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Удалить сотрудника"
        text={
          deleteTarget
            ? `Аккаунт «${deleteTarget.name}» (${deleteTarget.email}) будет удалён. Если у сотрудника есть записи, удаление не пройдёт — тогда используйте деактивацию.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        busy={deleteBusy}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
