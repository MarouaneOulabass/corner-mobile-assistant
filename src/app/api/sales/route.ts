import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const store_id = searchParams.get('store_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const seller_id = searchParams.get('seller_id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('sales')
      .select(
        '*, seller:users(*), customer:customers(*), items:sale_items(*, product:products(*))',
        { count: 'exact' }
      );

    // Filter by store: non-superadmin users can only see their store
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (store_id) {
      query = query.eq('store_id', store_id);
    }

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to + 'T23:59:59');
    if (seller_id) query = query.eq('seller_id', seller_id);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sales: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const sellerId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!sellerId || !storeId) {
      return NextResponse.json(
        { error: 'Utilisateur non authentifié' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Le panier est vide' },
        { status: 400 }
      );
    }

    if (!body.payment_method) {
      return NextResponse.json(
        { error: 'Méthode de paiement requise' },
        { status: 400 }
      );
    }

    // Handle customer creation if phone provided but no customer_id
    let customerId = body.customer_id || null;

    if (!customerId && body.customer_phone) {
      // Check if customer exists by phone
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', body.customer_phone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({
            name: body.customer_name || 'Client',
            phone: body.customer_phone,
            whatsapp: body.customer_phone,
          })
          .select('id')
          .single();

        if (custError) {
          return NextResponse.json(
            { error: 'Erreur lors de la création du client: ' + custError.message },
            { status: 500 }
          );
        }
        customerId = newCustomer.id;
      }
    }

    // Calculate total
    const subtotal = body.items.reduce(
      (sum: number, item: { quantity: number; unit_price: number }) =>
        sum + item.quantity * item.unit_price,
      0
    );

    let discountAmount = 0;
    if (body.discount_amount && body.discount_amount > 0) {
      if (body.discount_type === 'percentage') {
        discountAmount = Math.round((subtotal * body.discount_amount) / 100);
      } else {
        discountAmount = body.discount_amount;
      }
    }

    const total = subtotal - discountAmount;

    // Create sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        store_id: storeId,
        seller_id: sellerId,
        customer_id: customerId,
        total,
        discount_amount: discountAmount,
        discount_type: body.discount_type || null,
        payment_method: body.payment_method,
        payment_details: body.payment_details || null,
      })
      .select('*')
      .single();

    if (saleError) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de la vente: ' + saleError.message },
        { status: 500 }
      );
    }

    // Create sale items
    const saleItems = body.items.map(
      (item: {
        product_id: string;
        quantity: number;
        unit_price: number;
        original_price: number;
      }) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: item.original_price,
      })
    );

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      // Rollback: delete the sale
      await supabase.from('sales').delete().eq('id', sale.id);
      return NextResponse.json(
        { error: 'Erreur lors de la création des articles: ' + itemsError.message },
        { status: 500 }
      );
    }

    // Update product statuses to 'sold'
    const productIds = body.items
      .filter((item: { product_id: string }) => item.product_id)
      .map((item: { product_id: string }) => item.product_id);

    if (productIds.length > 0) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ status: 'sold', updated_at: new Date().toISOString() })
        .in('id', productIds);

      if (updateError) {
        console.error('Erreur mise à jour statut produits:', updateError.message);
      }
    }

    // Fetch the complete sale with relations
    const { data: completeSale, error: fetchError } = await supabase
      .from('sales')
      .select(
        '*, seller:users(*), customer:customers(*), items:sale_items(*, product:products(*))'
      )
      .eq('id', sale.id)
      .single();

    if (fetchError) {
      return NextResponse.json(sale, { status: 201 });
    }

    return NextResponse.json(completeSale, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
