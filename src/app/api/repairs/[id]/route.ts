import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { validRepairTransitions } from '@/lib/utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('repairs')
      .select('*, customer:customers(*), technician:users(*)')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Réparation introuvable' }, { status: 404 });
    }

    // Fetch status logs with user info
    const { data: logs } = await supabase
      .from('repair_status_logs')
      .select('*, user:users(*)')
      .eq('repair_id', params.id)
      .order('changed_at', { ascending: true });

    return NextResponse.json({ ...data, status_logs: logs || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');

    // Get current repair
    const { data: current, error: fetchError } = await supabase
      .from('repairs')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Réparation introuvable' }, { status: 404 });
    }

    // If status is changing, validate the transition
    if (body.status && body.status !== current.status) {
      const allowed = validRepairTransitions[current.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Transition invalide: ${current.status} -> ${body.status}. Transitions autorisées: ${allowed.join(', ') || 'aucune'}`,
          },
          { status: 400 }
        );
      }
    }

    // Build update object — strip fields that shouldn't be updated
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _r1, created_at: _r2, customer: _r3, technician: _r4, status_logs: _r5, ...updates } = body;

    const { data, error } = await supabase
      .from('repairs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*, customer:customers(*), technician:users(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If status changed, create status log
    if (body.status && body.status !== current.status) {
      await supabase.from('repair_status_logs').insert({
        repair_id: params.id,
        status: body.status,
        changed_by: userId,
        notes: body.status_note || null,
      });

      // If new status is 'ready', notify store managers
      if (body.status === 'ready') {
        const { data: managers } = await supabase
          .from('users')
          .select('id')
          .eq('store_id', current.store_id)
          .in('role', ['manager', 'superadmin']);

        if (managers && managers.length > 0) {
          const notifications = managers.map((m) => ({
            user_id: m.id,
            type: 'repair_ready' as const,
            title: 'Réparation prête',
            message: `La réparation ${data.device_brand} ${data.device_model} est prête pour le client.`,
            read: false,
            data: { repair_id: params.id },
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }
    }

    // Fetch updated logs
    const { data: logs } = await supabase
      .from('repair_status_logs')
      .select('*, user:users(*)')
      .eq('repair_id', params.id)
      .order('changed_at', { ascending: true });

    return NextResponse.json({ ...data, status_logs: logs || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
