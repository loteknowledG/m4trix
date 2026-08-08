const RERUN_OTHER_DIALOGS_ON_EDIT_KEY = 'm4trix:rerun-other-dialogs-on-edit';

export function readRerunOtherDialogsOnEdit(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RERUN_OTHER_DIALOGS_ON_EDIT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeRerunOtherDialogsOnEdit(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RERUN_OTHER_DIALOGS_ON_EDIT_KEY, String(value));
  } catch {
    /* ignore storage failures */
  }
}
