import { supabase } from './supabase'

// Actions worth recording: the ones that destroy, hide, or change who can do
// what. Ordinary edits are deliberately not logged — a log of everything is a
// log nobody reads.
export const AUDIT_ACTIONS = {
  RECORD_DELETED: 'record.deleted',
  RECORD_ARCHIVED: 'record.archived',
  RECORD_RESTORED: 'record.restored',
  DELETION_APPROVED: 'deletion.approved',
  DELETION_REJECTED: 'deletion.rejected',
  EDIT_APPROVED: 'edit.approved',
  EDIT_REJECTED: 'edit.rejected',
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_ROLE_CHANGED: 'account.role_changed',
  ACCOUNT_PASSWORD_RESET: 'account.password_reset',
  ACCOUNT_UPDATED: 'account.updated',
  ACCOUNT_DEACTIVATED: 'account.deactivated',
  ACCOUNT_ARCHIVED: 'account.archived',
  ACCOUNT_REACTIVATED: 'account.reactivated',
}

export const AUDIT_ACTION_LABELS = {
  'record.deleted': 'Deleted record',
  'record.archived': 'Archived record',
  'record.restored': 'Restored record',
  'deletion.approved': 'Approved deletion',
  'deletion.rejected': 'Rejected deletion',
  'edit.approved': 'Approved edit',
  'edit.rejected': 'Rejected edit',
  'account.created': 'Created account',
  'account.role_changed': 'Changed account role',
  'account.password_reset': 'Reset password',
  'account.updated': 'Edited account',
  'account.deactivated': 'Deactivated account',
  'account.archived': 'Archived account',
  'account.reactivated': 'Reactivated account',
}

/**
 * Record an action. Never throws and never blocks: a log write failing should
 * not undo work the user already completed successfully. A failure is
 * reported to the console, since a silently missing audit entry is worse than
 * a noisy one.
 */
export async function logAudit({ session, profile, action, sector, targetLabel, targetId, details }) {
  if (!session?.user?.id) return

  try {
    const { error } = await supabase.from('audit_logs').insert({
      // The insert policy pins this to auth.uid(), so it cannot be forged.
      actor_id: session.user.id,
      actor_name: profile?.full_name || null,
      actor_email: profile?.email || session.user.email || null,
      action,
      sector: sector || null,
      target_label: targetLabel || null,
      target_id: targetId || null,
      details: details || null,
    })
    if (error) console.error('Could not write audit entry', action, error)
  } catch (error) {
    console.error('Could not write audit entry', action, error)
  }
}
