import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons.jsx';

// Модальное окно: закрытие по Esc и клику по подложке, прокрутка страницы блокируется.
export function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <IconX />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// Диалог подтверждения действия (удалить, отменить запись…)
export function ConfirmModal({
  open,
  title,
  text,
  confirmLabel = 'Подтвердить',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Подождите…' : confirmLabel}
          </button>
        </>
      }
    >
      {text}
    </Modal>
  );
}
