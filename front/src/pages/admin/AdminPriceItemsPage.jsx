import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../api/endpoints.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { Field } from '../../components/Field.jsx';
import { ConfirmModal, Modal } from '../../components/Modal.jsx';
import { SkeletonRows } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import { fmtMoney } from '../../utils/format.js';

const EMPTY_FORM = { name: '', price: '500' };

// Позиции прайса для дополнительных расходов (масло, фильтры, колодки…).
// Их выбирает сотрудник, добавляя расход к принятой заявке.
export default function AdminPriceItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
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
      .priceItems()
      .then(setItems)
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

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, price: String(item.price) });
    setFormError('');
    setFormFieldErrors({});
    setModalOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Укажите название';
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) errs.price = 'Число, не меньше 0';
    setFormFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setFormBusy(true);
    setFormError('');
    try {
      if (editing) {
        await catalogApi.updatePriceItem(editing.id, { name: form.name.trim(), price });
        toast('Позиция обновлена', 'success');
      } else {
        await catalogApi.createPriceItem({ name: form.name.trim(), price });
        toast('Позиция добавлена', 'success');
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
      await catalogApi.deletePriceItem(deleteTarget.id);
      toast('Позиция удалена', 'success');
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
          <h1 className="page-head__title">Прайс доп. расходов</h1>
          <p className="page-head__sub">Материалы и запчасти, добавляемые сотрудником к заявке.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Добавить позицию
        </button>
      </div>

      {loadError && (
        <div className="empty" role="alert">
          <div className="empty__title">Не удалось загрузить позиции</div>
          <p className="empty__text">{loadError}</p>
        </div>
      )}

      {!loadError && !items && <SkeletonRows rows={4} />}

      {items && items.length === 0 && (
        <EmptyState title="Позиций пока нет" text="Добавьте первую позицию прайса." />
      )}

      {items && items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Позиция</th>
                <th className="table__num">Цена</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="table__num">{fmtMoney(item.price)}</td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(item)}>
                      Изменить
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget(item)}>
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
        title={editing ? `Правка: ${editing.name}` : 'Новая позиция'}
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
              placeholder="Масляный фильтр"
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
          {formError && <div className="form-banner" role="alert">{formError}</div>}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Удалить позицию"
        text={
          deleteTarget
            ? `Позиция «${deleteTarget.name}» будет удалена. Если она уже использовалась в расходах, удаление не пройдёт.`
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
