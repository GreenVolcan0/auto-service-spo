// Универсальное поле формы: подпись, элемент ввода, подсказка и ошибка.
export function Field({ label, error, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}
