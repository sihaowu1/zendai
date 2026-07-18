import mongoose, { Schema, type Document } from 'mongoose';

export interface IMarketplaceItem extends Document {
  title: string;
  description: string;
  code: string;
  creator: { sub: string; name: string; picture?: string };
  publishedAt: Date;
}

const MarketplaceItemSchema = new Schema<IMarketplaceItem>({
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 1000 },
  code: { type: String, required: true },
  creator: {
    sub: { type: String, required: true },
    name: { type: String, required: true },
    picture: { type: String },
  },
  publishedAt: { type: Date, default: Date.now },
});

MarketplaceItemSchema.index({ publishedAt: -1 });
MarketplaceItemSchema.index({ 'creator.sub': 1 });

export const MarketplaceItem = mongoose.model<IMarketplaceItem>('MarketplaceItem', MarketplaceItemSchema);
