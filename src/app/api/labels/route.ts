import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// POST - Log label print
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const { product_ids } = await request.json();
    if (!product_ids || !Array.isArray(product_ids)) {
      return NextResponse.json({ error: 'product_ids requis' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const logs = product_ids.map((pid: string) => ({
      product_id: pid,
      printed_by: userId,
    }));

    const { error } = await supabase.from('labels_log').insert(logs);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: product_ids.length });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
