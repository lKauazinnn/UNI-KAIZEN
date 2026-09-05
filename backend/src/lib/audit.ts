import { randomUUID } from 'crypto';
import supabase from './supabase';

export const logAudit = async (params: {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) => {
  const { error } = await supabase.from('audit_logs').insert({
    id: randomUUID(),
    organizationId: params.organizationId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    details: params.details ?? null,
  });

  if (error) {
    console.error('[audit] erro ao registrar evento:', JSON.stringify(error));
  }
};