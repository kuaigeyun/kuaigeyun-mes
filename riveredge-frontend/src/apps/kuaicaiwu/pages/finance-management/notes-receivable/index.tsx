import FinanceNotesPage from '../shared/FinanceNotesPage';
import { NOTES_RECEIVABLE_RESOURCE } from '../../../services/finance/note';

export default function NotesReceivablePage() {
  return (
    <FinanceNotesPage
      direction="receivable"
      resource={NOTES_RECEIVABLE_RESOURCE}
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.notes-receivable.list-v2"
    />
  );
}
