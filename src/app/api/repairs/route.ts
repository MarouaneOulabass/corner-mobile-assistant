import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('repairs')
      .select('*, customer:customers(*), technician:users(*)', { count: 'exact' });

    // Filter by store
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (searchParams.get('store_id')) {
      query = query.eq('store_id', searchParams.get('store_id')!);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      // Search by device or customer — use inner join filter on customer
      query = query.or(
        `device_brand.ilike.%${search}%,device_model.ilike.%${search}%,imei.ilike.%${search}%,customer.name.ilike.%${search}%,customer.phone.ilike.%${search}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ repairs: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const userStore = request.headers.get('x-user-store');

    // Validate required fields
    const required = ['customer_id', 'device_brand', 'device_model', 'problem', 'estimated_cost'];
    const missing = required.filter((f) => !body[f] && body[f] !== 0);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const repair = {
      customer_id: body.customer_id,
      store_id: body.store_id || userStore,
      technician_id: body.technician_id || null,
      device_brand: body.device_brand,
      device_model: body.device_model,
      imei: body.imei || null,
      problem: body.problem,
      problem_categories: body.problem_categories || [],
      condition_on_arrival: body.condition_on_arrival || null,
      status: 'received' as const,
      estimated_cost: body.estimated_cost,
      deposit: body.deposit || 0,
      estimated_completion_date: body.estimated_completion_date || null,
    };

    const { data, error } = await supabase
      .from('repairs')
      .insert(repair)
      .select('*, customer:customers(*), technician:users(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create initial status log
    await supabase.from('repair_status_logs').insert({
      repair_id: data.id,
      status: 'received',
      changed_by: userId,
      notes: 'Réparation créée',
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
