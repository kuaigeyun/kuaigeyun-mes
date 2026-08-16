import FinanceNotesPage from '../shared/FinanceNotesPage';
import { NOTES_PAYABLE_RESOURCE } from '../../../services/finance/note';

export default function NotesPayablePage() {
  return (
    <FinanceNotesPage
      direction="payable"
      resource={NOTES_PAYABLE_RESOURCE}
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.notes-payable.list-v1"
    />
  );
}
