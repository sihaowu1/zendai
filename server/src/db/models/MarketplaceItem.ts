import mongoose, { Schema, type Document } from 'mongoose';

export interface IMarketplaceItem extends Document {
  title: string;
  description: string;
  /** Original (static) scene module. */
  code: string;
  /** Optional animated module published alongside the original. */
  animationCode?: string;
  animationName?: string;
  creator: { sub: string; name: string; picture?: string };
  publishedAt: Date;
}

const MarketplaceItemSchema = new Schema<IMarketplaceItem>({
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  code: { type: String, required: true },
  animationCode: { type: String },
  animationName: { type: String, maxlength: 120 },
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
