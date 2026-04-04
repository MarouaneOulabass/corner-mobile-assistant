'use client';

import { Product } from '@/types';
import { formatPrice, conditionLabels } from '@/lib/utils';

interface LabelTemplateProps {
  product: Product;
  storeName: string;
}

export default function LabelTemplate({ product, storeName }: LabelTemplateProps) {
  const isPhone = product.product_type === 'phone';

  return (
    <div className="print-area w-[62mm] p-2 bg-white border border-gray-300 font-mono text-xs leading-tight">
      {/* Product name */}
      <div className="font-bold text-sm mb-1">
        {product.brand} {product.model}
        {isPhone && product.storage ? ` — ${product.storage}` : ''}
      </div>

      {/* Details */}
      <div className="mb-1 text-gray-700">
        {product.color && <span>{product.color}</span>}
        {product.color && isPhone && ' — '}
        {isPhone && <span>{conditionLabels[product.condition] || product.condition}</span>}
      </div>

      {/* IMEI */}
      {isPhone && product.imei && (
        <div className="mb-1">
          <span className="text-gray-500">IMEI:</span> {product.imei}
        </div>
      )}

      {/* Barcode placeholder — rendered via bwip-js in BarcodeImage */}
      {isPhone && product.imei && (
        <div className="my-2">
          <BarcodeImage value={product.imei} />
        </div>
      )}

      {/* Price */}
      <div className="font-bold text-base mt-1">
        {formatPrice(product.selling_price)}
      </div>

      {/* Store */}
      <div className="text-gray-500 mt-1 text-[10px]">
        {storeName}
      </div>
    </div>
  );
}

function BarcodeImage({ value }: { value: string }) {
  const canvasId = `barcode-${value}`;

  return (
    <canvas
      id={canvasId}
      ref={(canvas) => {
        if (canvas && typeof window !== 'undefined') {
          import('bwip-js').then((bwipjs) => {
            try {
              bwipjs.toCanvas(canvas, {
                bcid: 'code128',
                text: value,
                scale: 2,
                height: 8,
                includetext: false,
              });
            } catch {
              // barcode generation failed silently
            }
          });
        }
      }}
      className="w-full"
    />
  );
}
