import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const store_id = searchParams.get('store_id');
    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('transfers')
      .select(
        '*, product:products(*, store:stores(*)), from_store:stores!from_store_id(*), to_store:stores!to_store_id(*), initiator:users!initiated_by(*)'
      )
      .order('created_at', { ascending: false });

    // Non-superadmin users see only transfers involving their store
    if (userRole !== 'superadmin' && userStore) {
      query = query.or(`from_store_id.eq.${userStore},to_store_id.eq.${userStore}`);
    } else if (store_id) {
      query = query.or(`from_store_id.eq.${store_id},to_store_id.eq.${store_id}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transfers: data || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    // Only manager+ can create transfers
    if (!userRole || !['manager', 'superadmin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Permission refusée. Rôle manager ou supérieur requis.' },
        { status: 403 }
      );
    }

    const { product_id, from_store_id, to_store_id } = body;

    if (!product_id || !from_store_id || !to_store_id) {
      return NextResponse.json(
        { error: 'Champs requis: product_id, from_store_id, to_store_id' },
        { status: 400 }
      );
    }

    if (from_store_id === to_store_id) {
      return NextResponse.json(
        { error: 'Les magasins source et destination doivent être différents' },
        { status: 400 }
      );
    }

    // Verify product exists and is in the source store
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, status, store_id')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    if (product.store_id !== from_store_id) {
      return NextResponse.json(
        { error: 'Le produit n\'appartient pas au magasin source' },
        { status: 400 }
      );
    }

    if (product.status !== 'in_stock') {
      return NextResponse.json(
        { error: 'Seuls les produits en stock peuvent être transférés' },
        { status: 400 }
      );
    }

    // Create the transfer record
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .insert({
        product_id,
        from_store_id,
        to_store_id,
        initiated_by: userId,
      })
      .select(
        '*, product:products(*, store:stores(*)), from_store:stores!from_store_id(*), to_store:stores!to_store_id(*), initiator:users!initiated_by(*)'
      )
      .single();

    if (transferError) {
      return NextResponse.json({ error: transferError.message }, { status: 500 });
    }

    // Update the product's store_id and status
    const { error: updateError } = await supabase
      .from('products')
      .update({
        store_id: to_store_id,
        status: 'transferred',
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Find managers of the destination store and notify them
    const { data: destManagers } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', to_store_id)
      .in('role', ['manager', 'superadmin']);

    if (destManagers && destManagers.length > 0) {
      const notifications = destManagers.map((manager) => ({
        user_id: manager.id,
        type: 'transfer_received' as const,
        title: 'Transfert reçu',
        message: `Un produit a été transféré vers votre magasin.`,
        read: false,
        data: { transfer_id: transfer.id, product_id },
      }));

      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json(transfer, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
