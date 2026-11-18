import { statusMeta } from '../utils/status.js';

// Цветной бейдж статуса заявки/сотрудника.
export function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return <span className={`badge ${meta.badge}`.trim()}>{meta.label}</span>;
}
