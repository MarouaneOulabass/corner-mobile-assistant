import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from './supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AiResult<T> {
  data: T | null;
  error: string | null;
}

async function logAiCall(feature: string, prompt: string, response: string, userId: string) {
  const supabase = createServiceClient();
  await supabase.from('ai_logs').insert({
    feature,
    prompt: prompt.substring(0, 5000),
    response: response.substring(0, 5000),
    user_id: userId,
  });
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

export async function suggestPrice(
  model: string,
  condition: string,
  storage: string,
  historicalPrices: { selling_price: number; condition: string }[],
  userId: string
): Promise<AiResult<{ price: number; confidence: string }>> {
  try {
    const prompt = `Produit: ${model}, État: ${condition}, Stockage: ${storage}
Historique des ventes similaires: ${JSON.stringify(historicalPrices)}
Suggère un prix de vente en MAD (Dirham marocain). Réponds en JSON: {"price": number, "confidence": "texte en français"}`;

    const system = "Tu es un expert en pricing de smartphones d'occasion au Maroc. Réponds uniquement en JSON valide.";
    const result = await callClaude(system, prompt);
    await logAiCall('price_suggestion', prompt, result, userId);

    const parsed = JSON.parse(result);
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: 'Analyse indisponible' };
  }
}

export async function generateCustomerSummary(
  customerName: string,
  purchases: { model: string; price: number; date: string }[],
  userId: string
): Promise<AiResult<string>> {
  try {
    const prompt = `Client: ${customerName}
Historique d'achats: ${JSON.stringify(purchases)}
Génère un résumé comportemental en français (3-4 phrases).`;

    const system = "Tu es un analyste CRM pour un magasin de smartphones au Maroc. Réponds en français.";
    const result = await callClaude(system, prompt);
    await logAiCall('customer_summary', prompt, result, userId);
    return { data: result, error: null };
  } catch {
    return { data: null, error: 'Analyse indisponible' };
  }
}

export async function generateSalesInsight(
  salesData: Record<string, unknown>,
  userId: string
): Promise<AiResult<string>> {
  try {
    const prompt = `Données de ventes: ${JSON.stringify(salesData)}
Génère une analyse et des recommandations en français (4-5 phrases).`;

    const system = "Tu es un consultant business pour un réseau de magasins de smartphones au Maroc. Réponds en français avec des recommandations actionnables.";
    const result = await callClaude(system, prompt);
    await logAiCall('sales_insight', prompt, result, userId);
    return { data: result, error: null };
  } catch {
    return { data: null, error: 'Analyse indisponible' };
  }
}

export async function parseNaturalLanguageQuery(
  query: string,
  userId: string
): Promise<AiResult<Record<string, string | number | boolean>>> {
  try {
    const prompt = `Requête utilisateur: "${query}"
Extrais les filtres de recherche pour un inventaire de smartphones. Réponds en JSON avec les clés possibles: brand, model, condition (new/like_new/good/fair/poor), max_price, min_price, storage, status, product_type.`;

    const system = "Tu es un parser de requêtes en langage naturel français pour un système d'inventaire. Réponds uniquement en JSON valide.";
    const result = await callClaude(system, prompt);
    await logAiCall('nl_query', query, result, userId);

    const parsed = JSON.parse(result);
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: 'Analyse indisponible' };
  }
}

export async function suggestRepairDiagnosis(
  deviceModel: string,
  problemDescription: string,
  userId: string
): Promise<AiResult<{ diagnosis: string; parts: string[] }>> {
  try {
    const prompt = `Appareil: ${deviceModel}
Problème décrit: ${problemDescription}
Suggère un diagnostic et les pièces probablement nécessaires. Réponds en JSON: {"diagnosis": "texte en français", "parts": ["pièce1", "pièce2"]}`;

    const system = "Tu es un technicien expert en réparation de smartphones. Réponds uniquement en JSON valide, en français.";
    const result = await callClaude(system, prompt);
    await logAiCall('repair_diagnosis', prompt, result, userId);

    const parsed = JSON.parse(result);
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: 'Analyse indisponible' };
  }
}

export async function normalizeCSVColumns(
  headers: string[],
  sampleRows: string[][],
  userId: string
): Promise<AiResult<Record<string, string>>> {
  try {
    const prompt = `En-têtes CSV: ${JSON.stringify(headers)}
Exemples de données: ${JSON.stringify(sampleRows.slice(0, 3))}
Mappe ces colonnes vers les champs suivants: imei, product_type, brand, model, storage, color, condition, purchase_price, selling_price, supplier, notes.
Réponds en JSON: {"colonne_originale": "champ_mappé"} — utilise null pour les colonnes à ignorer.`;

    const system = "Tu es un expert en normalisation de données. Réponds uniquement en JSON valide.";
    const result = await callClaude(system, prompt);
    await logAiCall('csv_normalize', prompt, result, userId);

    const parsed = JSON.parse(result);
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: 'Normalisation indisponible' };
  }
}
