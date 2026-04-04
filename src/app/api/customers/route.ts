import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const phone = searchParams.get('phone');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (phone) {
      query = query.eq('phone', phone);
    } else if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: 'Nom et téléphone sont requis' },
        { status: 400 }
      );
    }

    // Check duplicate phone
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', body.phone)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Un client avec ce numéro existe déjà', customer_id: existing.id },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp || body.phone,
        email: body.email || null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
