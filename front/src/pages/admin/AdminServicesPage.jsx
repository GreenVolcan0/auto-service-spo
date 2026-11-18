import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../api/endpoints.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { Field } from '../../components/Field.jsx';
import { ConfirmModal, Modal } from '../../components/Modal.jsx';
import { SkeletonRows } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import { fmtDuration, fmtMoney } from '../../utils/format.js';

const EMPTY_FORM = { name: '', description: '', duration: '60', price: '1000' };

// Каталог услуг: добавление, правка и удаление (удалить услугу с записями
// нельзя — бэкенд вернёт 409, покажем его текст).
export default function AdminServicesPage() {
  const toast = useToast();
  const [services, setServices] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    catalogApi
      .services()
      .then(setServices)
      .catch((err) => setLoadError(err.message));
  }, []);

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

  const openEdit = (service) => {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description || '',
      duration: String(service.duration),
      price: String(service.price),
    });
    setFormError('');
    setFormFieldErrors({});
    setModalOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Укажите название';
    const duration = Number(form.duration);
    if (!Number.isInteger(duration) || duration <= 0) errs.duration = 'Целое число минут, больше 0';
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) errs.price = 'Число, не меньше 0';
    setFormFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setFormBusy(true);
    setFormError('');
    try {
      if (editing) {
        await catalogApi.updateService(editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          duration,
          price,
        });
        toast('Услуга обновлена', 'success');
      } else {
        await catalogApi.createService({
          name: form.name.trim(),
          description: form.description.trim() || null,
          duration,
          price,
        });
        toast('Услуга добавлена', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await catalogApi.deleteService(deleteTarget.id);
      toast('Услуга удалена', 'success');
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
          <h1 className="page-head__title">Услуги</h1>
          <p className="page-head__sub">Каталог услуг для записи клиентов.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Добавить услугу
        </button>
      </div>

      {loadError && (
        <div className="empty" role="alert">
          <div className="empty__title">Не удалось загрузить услуги</div>
          <p className="empty__text">{loadError}</p>
        </div>
      )}

      {!loadError && !services && <SkeletonRows rows={4} />}

      {services && services.length === 0 && (
        <EmptyState title="Услуг пока нет" text="Добавьте первую услугу каталога." />
      )}

      {services && services.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Длительность</th>
                <th className="table__num">Цена</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    {s.description && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 13 }}>
                          {s.description}
                        </span>
                      </>
                    )}
                  </td>
                  <td>{fmtDuration(s.duration)}</td>
                  <td className="table__num">{fmtMoney(s.price)}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(s)}>
                      Изменить
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget(s)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Правка: ${editing.name}` : 'Новая услуга'}
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
          <Field label="Название" error={formFieldErrors.name}>
            <input
              className={`input${formFieldErrors.name ? ' input--error' : ''}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Замена масла"
            />
          </Field>
          <Field label="Описание" hint="Необязательно">
            <textarea
              className="textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Короткое описание для витрины"
            />
          </Field>
          <div className="form-row">
            <Field label="Длительность, мин" error={formFieldErrors.duration}>
              <input
                className={`input${formFieldErrors.duration ? ' input--error' : ''}`}
                type="number"
                min="1"
                max="1440"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </Field>
            <Field label="Цена, ₽" error={formFieldErrors.price}>
              <input
                className={`input${formFieldErrors.price ? ' input--error' : ''}`}
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </Field>
          </div>
          {formError && <div className="form-banner" role="alert">{formError}</div>}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Удалить услугу"
        text={
          deleteTarget
            ? `Услуга «${deleteTarget.name}» будет удалена из каталога. Если она используется в записях, удаление не пройдёт.`
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
