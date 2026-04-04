import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const store_id = searchParams.get('store_id');
    const status = searchParams.get('status');
    const brand = searchParams.get('brand');
    const product_type = searchParams.get('product_type');
    const condition = searchParams.get('condition');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('products')
      .select('*, store:stores(*)', { count: 'exact' });

    // Filter by store: non-superadmin users can only see their store
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (store_id) {
      query = query.eq('store_id', store_id);
    }

    if (status) query = query.eq('status', status);
    if (brand) query = query.ilike('brand', brand);
    if (product_type) query = query.eq('product_type', product_type);
    if (condition) query = query.eq('condition', condition);

    if (search) {
      query = query.or(
        `imei.ilike.%${search}%,model.ilike.%${search}%,brand.ilike.%${search}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');

    // Validate required fields
    const required = ['product_type', 'brand', 'model', 'condition', 'purchase_price', 'selling_price', 'store_id'];
    const missing = required.filter((f) => !body[f] && body[f] !== 0);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Check duplicate IMEI
    if (body.imei) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('imei', body.imei)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'Un produit avec cet IMEI existe déjà' },
          { status: 409 }
        );
      }
    }

    const product = {
      product_type: body.product_type,
      brand: body.brand,
      model: body.model,
      storage: body.storage || null,
      color: body.color || null,
      condition: body.condition,
      purchase_price: body.purchase_price,
      selling_price: body.selling_price,
      imei: body.imei || null,
      supplier: body.supplier || null,
      notes: body.notes || null,
      purchase_date: body.purchase_date || null,
      store_id: body.store_id,
      status: 'in_stock',
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select('*, store:stores(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
