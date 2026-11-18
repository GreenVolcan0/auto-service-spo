import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/endpoints.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import { fmtDuration, fmtMoney } from '../utils/format.js';

function ServiceSkeletons() {
  return (
    <div className="services-grid" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skeleton-card">
          <Skeleton className="skeleton--title" />
          <Skeleton className="skeleton--line" />
          <Skeleton className="skeleton--line-short" />
        </div>
      ))}
    </div>
  );
}

// Публичная витрина: условия работы, каталог услуг и позиции доп. расходов.
// Данные берутся из GET /price-list — он доступен без авторизации.
export default function HomePage() {
  const { user } = useAuth();
  const [priceList, setPriceList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    catalogApi
      .priceList()
      .then((data) => alive && setPriceList(data))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  const isGuest = !user;
  const isClient = Boolean(user && user.role === 'client');

  return (
    <>
      <section className="hero">
        <h1 className="hero__title">Запись в автосервис онлайн</h1>
        <p className="hero__text">
          Выберите услугу, мастера и свободное время — заявка попадёт прямо в расписание сотрудника,
          и мастер подтвердит её. Без звонков и ожидания на линии.
        </p>
        <div className="hero__actions">
          {isGuest && (
            <>
              <Link className="btn btn--primary" to="/register">
                Создать аккаунт
              </Link>
              <Link className="btn btn--outline" to="/login">
                Войти
              </Link>
            </>
          )}
          {isClient && (
            <Link className="btn btn--primary" to="/appointments/new">
              Записаться на услугу
            </Link>
          )}
          {user && user.role === 'employee' && (
            <Link className="btn btn--outline" to="/schedule">
              Моё расписание
            </Link>
          )}
          {user && user.role === 'admin' && (
            <Link className="btn btn--outline" to="/admin/schedule">
              Все записи
            </Link>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Как это работает</h2>
        </div>
        <div className="steps">
          <div className="steps__item">
            <span className="steps__num">1</span>
            <div className="steps__text">
              <b>Выберите услугу</b>
              <span>Цены и длительность — в каталоге ниже</span>
            </div>
          </div>
          <div className="steps__item">
            <span className="steps__num">2</span>
            <div className="steps__text">
              <b>Выберите время</b>
              <span>Свободные слоты мастера на удобный день</span>
            </div>
          </div>
          <div className="steps__item">
            <span className="steps__num">3</span>
            <div className="steps__text">
              <b>Дождитесь подтверждения</b>
              <span>Статус заявки виден в личном кабинете</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Услуги</h2>
          {isClient && (
            <Link className="btn btn--outline btn--sm" to="/appointments/new">
              Записаться
            </Link>
          )}
        </div>

        {error && <EmptyState title="Не удалось загрузить услуги" text={error} />}
        {!error && !priceList && <ServiceSkeletons />}
        {priceList && priceList.services.length === 0 && (
          <EmptyState title="Услуг пока нет" text="Администратор ещё не заполнил каталог услуг." />
        )}
        {priceList && priceList.services.length > 0 && (
          <div className="services-grid">
            {priceList.services.map((s) => (
              <article key={s.id} className="card service-card">
                <div className="service-card__name">{s.name}</div>
                {s.description && <div className="service-card__desc">{s.description}</div>}
                <div className="service-card__foot">
                  <span className="price-tag">{fmtMoney(s.price)}</span>
                  <span className="muted">{fmtDuration(s.duration)}</span>
                </div>
                {isClient && (
                  <Link className="btn btn--outline btn--sm" to={`/appointments/new?service=${s.id}`}>
                    Записаться
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Дополнительные расходы</h2>
        </div>
        <p className="muted">
          Материалы и запчасти, которые сотрудник добавляет к заявке по факту работы и которые
          прибавляются к стоимости услуги.
        </p>
        {priceList && priceList.price_items.length > 0 && (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th className="table__num">Цена</th>
                </tr>
              </thead>
              <tbody>
                {priceList.price_items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className="table__num">{fmtMoney(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
