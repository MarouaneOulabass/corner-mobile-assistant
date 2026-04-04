import { NextRequest, NextResponse } from 'next/server';
import {
  generateSalesInsight,
  suggestPrice,
  generateCustomerSummary,
  parseNaturalLanguageQuery,
  suggestRepairDiagnosis,
} from '@/lib/ai';

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: { type: string; data: any };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json({ error: 'Type et données requis' }, { status: 400 });
  }

  try {
    switch (type) {
      case 'sales_insight': {
        const result = await generateSalesInsight(data, userId);
        return NextResponse.json(result);
      }

      case 'price_suggestion': {
        const { model, condition, storage, historicalPrices } = data;
        const result = await suggestPrice(model, condition, storage, historicalPrices, userId);
        return NextResponse.json(result);
      }

      case 'customer_summary': {
        const { customerName, purchases } = data;
        const result = await generateCustomerSummary(customerName, purchases, userId);
        return NextResponse.json(result);
      }

      case 'nl_query': {
        const { query } = data;
        const result = await parseNaturalLanguageQuery(query, userId);
        return NextResponse.json(result);
      }

      case 'repair_diagnosis': {
        const { deviceModel, problemDescription } = data;
        const result = await suggestRepairDiagnosis(deviceModel, problemDescription, userId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Type inconnu: ${type}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
