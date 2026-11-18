import { IconInbox } from './icons.jsx';

// Пустой результат списка: заголовок, пояснение и необязательная кнопка-действие.
export function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <IconInbox />
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </div>
  );
}
