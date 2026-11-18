import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.jsx';

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Страница не найдена (404)"
      text="Проверьте адрес или вернитесь на главную."
      action={
        <Link className="btn btn--primary" to="/">
          На главную
        </Link>
      }
    />
  );
}
